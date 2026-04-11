/**
 * Build script — aggregates vegapull card data into public/data/
 * and downloads card images into public/images/cards/
 *
 * Raw data is fetched via Docker (see scripts/update-data.sh which calls
 * Dockerfile.vegapull). This script just reads the local cache and
 * transforms it into the app's JSON format.
 *
 * Usage:
 *   node scripts/build-data.mjs              # data + images
 *   node scripts/build-data.mjs --no-images  # data only
 *
 * Cross-set variants (e.g. SP cards released in a later booster) are attached
 * to the base card as variants with { set_id, set_name } fields, and also
 * appear as standalone tiles in the set they belong to.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs"
import { join } from "path"

const CACHE_DIR = ".vegapull-cache"
const OUTPUT_DIR = "public/data"
const IMAGES_BASE_DIR = "public/images/cards"
const DOWNLOAD_IMAGES = !process.argv.includes("--no-images")
const IMAGE_CONCURRENCY = 10

const LANG_MAP = {
  english: "en",
  french: "fr",
  japanese: "jp",
}

// ---------------------------------------------------------------------------

/** Derive the normalised set ID from a pack object (e.g. "OP-09" → "OP09") */
function deriveSetId(pack, cards) {
  const rawLabel =
    pack.title_parts?.label ??
    pack.raw_title?.match(/[【\[]([A-Z0-9]+-?[A-Z]{2}\d+|[A-Z]{2}-?\d+)[】\]]/)?.[1]

  if (!rawLabel) {
    // Detect promo set by presence of cards with P-XXX IDs
    const promoCount = cards.filter((c) => /^P-\d+$/.test(c.id)).length
    if (promoCount >= 5) return "PROMO"
    return null
  }

  return rawLabel.replace(/-/g, "") // "OP-01" → "OP01"
}

/** Normalise a raw label for display: "OP14-EB04" → "OP-14 / EB-04", "OP-01" → "OP-01" */
function normaliseLabel(rawLabel) {
  if (!rawLabel) return rawLabel
  const withHyphens = rawLabel.replace(/([A-Z]+)(\d+)/g, "$1-$2")
  return withHyphens.replace(/-(?=[A-Z])/g, " / ")
}

const HTML_ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" }

function decodeEntities(obj) {
  if (typeof obj === "string") return obj.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m] ?? m)
  if (Array.isArray(obj)) return obj.map(decodeEntities)
  if (obj && typeof obj === "object") return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, decodeEntities(v)]))
  return obj
}

function isVariantId(id) {
  return /_[pr]\d+$/.test(id)
}

function baseIdOf(variantId) {
  return variantId.replace(/_[pr]\d+$/, "")
}

// ---------------------------------------------------------------------------

async function downloadImage(langCode, cardId, url) {
  const dest = join(IMAGES_BASE_DIR, langCode, `${cardId}.png`)
  if (existsSync(dest)) return false

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    return true
  } catch (err) {
    console.warn(`  ⚠ Failed to download ${langCode}/${cardId}: ${err.message}`)
    return false
  }
}

async function runConcurrent(tasks, limit) {
  const results = []
  const queue = [...tasks]

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()
      results.push(await task())
    }
  }

  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

// ---------------------------------------------------------------------------

async function processLanguage(langPath, langCode, indexSets, imageTasks, cardMap) {
  const packsPath = join(langPath, "json", "packs.json")
  if (!existsSync(packsPath)) {
    console.warn(`  ⚠ No packs.json found for ${langCode}, skipping`)
    return
  }

  const packs = Object.values(decodeEntities(JSON.parse(readFileSync(packsPath, "utf-8"))))

  // ── Phase 1: global scan ──────────────────────────────────────────────────
  // Load all cards per pack, then resolve cross-set variants.
  //
  // variantsByBase : baseId → [{ id, packId, setId, setLabel, card }]
  // basesInPack   : packId → Map<baseId, card>

  const variantsByBase = new Map()
  const basesInPack = new Map()
  const cardsByPack = new Map() // packId → Card[]
  const packMeta = new Map()    // packId → { setId, setLabel }

  for (const pack of packs) {
    const cardsFile = join(langPath, "json", `cards_${pack.id}.json`)
    if (!existsSync(cardsFile)) continue

    const rawCards = decodeEntities(JSON.parse(readFileSync(cardsFile, "utf-8")))
    cardsByPack.set(pack.id, rawCards)

    const setId = deriveSetId(pack, rawCards)
    const setLabel = pack.title_parts?.label ?? (setId === "PROMO" ? "PROMO" : null)
    packMeta.set(pack.id, { setId, setLabel })

    const packBases = new Map()

    for (const card of rawCards) {
      const cardId = card.id
      if (isVariantId(cardId)) {
        const baseId = baseIdOf(cardId)
        if (!variantsByBase.has(baseId)) variantsByBase.set(baseId, [])
        variantsByBase.get(baseId).push({ id: cardId, packId: pack.id, setId, setLabel, card })
      } else {
        packBases.set(cardId, card)
      }
    }

    basesInPack.set(pack.id, packBases)
  }

  // basesById: baseId → { card, packId, setId, setLabel } — used to attach cross-set relatives to orphan tiles
  const basesById = new Map()
  for (const [packId, packBases] of basesInPack) {
    const meta = packMeta.get(packId)
    for (const [baseId, baseCard] of packBases) {
      basesById.set(baseId, { card: baseCard, packId, setId: meta?.setId, setLabel: meta?.setLabel })
    }
  }

  // ── Phase 2: build one JSON per set ──────────────────────────────────────

  const outputLangDir = join(OUTPUT_DIR, langCode)
  mkdirSync(outputLangDir, { recursive: true })
  if (DOWNLOAD_IMAGES) mkdirSync(join(IMAGES_BASE_DIR, langCode), { recursive: true })

  for (const pack of packs) {
    const rawCards = cardsByPack.get(pack.id)
    if (!rawCards) continue

    const setId = deriveSetId(pack, rawCards)
    if (!setId) continue

    const packBases = basesInPack.get(pack.id)
    const cards = []

    // ── Base cards: attach all variants across all packs ──────────────────
    for (const [baseId, baseCard] of (packBases ?? new Map())) {
      const allVariants = (variantsByBase.get(baseId) ?? [])
        .map((v) => {
          const isSamePack = v.packId === pack.id
          return {
            id: v.id,
            img_url: v.card.img_url,
            img_full_url: v.card.img_full_url,
            rarity: v.card.rarity,
            ...(isSamePack ? {} : { set_id: v.setId ?? null, set_label: v.setLabel ?? null }),
          }
        })
        .sort((a, b) => {
          if (!a.set_id && !b.set_id) return a.id.localeCompare(b.id)
          if (!a.set_id) return -1
          if (!b.set_id) return 1
          return (a.set_id ?? "").localeCompare(b.set_id ?? "")
        })

      cards.push({ ...baseCard, tile_set_id: setId, variants: allVariants })
    }

    // ── Orphan variants: variant cards whose base card lives in another pack ─
    const orphansByBase = new Map()
    for (const card of rawCards) {
      const cardId = card.id
      if (!isVariantId(cardId)) continue
      const baseId = baseIdOf(cardId)
      if (packBases?.has(baseId)) continue // base is same pack → already handled
      if (!orphansByBase.has(baseId)) orphansByBase.set(baseId, [])
      orphansByBase.get(baseId).push({ id: cardId, card })
    }

    for (const group of orphansByBase.values()) {
      group.sort((a, b) => a.id.localeCompare(b.id))
      const [first, ...rest] = group
      const baseId = baseIdOf(first.id)

      // Same-pack sibling orphans (e.g. two SPs of the same base in this pack)
      const samePackVariants = rest.map((v) => ({
        id: v.id,
        img_url: v.card.img_url,
        img_full_url: v.card.img_full_url,
        rarity: v.card.rarity,
      }))

      // Cross-set relatives: the original base card + any variants from other packs
      const crossSetVariants = []
      const baseInfo = basesById.get(baseId)
      if (baseInfo) {
        crossSetVariants.push({
          id: baseId,
          img_url: baseInfo.card.img_url,
          img_full_url: baseInfo.card.img_full_url,
          rarity: baseInfo.card.rarity,
          set_id: baseInfo.setId ?? null,
          set_label: baseInfo.setLabel ?? null,
        })
      }
      for (const v of variantsByBase.get(baseId) ?? []) {
        if (v.packId === pack.id) continue // already in samePackVariants
        crossSetVariants.push({
          id: v.id,
          img_url: v.card.img_url,
          img_full_url: v.card.img_full_url,
          rarity: v.card.rarity,
          set_id: v.setId ?? null,
          set_label: v.setLabel ?? null,
        })
      }

      const variants = [...samePackVariants, ...crossSetVariants]
      cards.push({ ...first.card, tile_set_id: setId, variants })
    }

    if (cards.length === 0) continue

    cards.sort((a, b) => a.id.localeCompare(b.id))

    writeFileSync(
      join(outputLangDir, `${setId}.json`),
      JSON.stringify(cards, null, 2)
    )

    // Populate cardMap (lang/cardId → setId) — per-language
    for (const card of cards) {
      cardMap.set(`${langCode}/${card.id}`, setId)
      for (const v of card.variants ?? []) {
        if (!v.set_id) cardMap.set(`${langCode}/${v.id}`, setId)
      }
    }

    // Update index
    const existing = indexSets.find((s) => s.id === setId)
    if (existing) {
      if (!existing.langs.includes(langCode)) existing.langs.push(langCode)
    } else {
      indexSets.push({
        id: setId,
        name: decodeEntities(pack.title_parts?.title ?? pack.raw_title),
        prefix: pack.title_parts?.prefix ?? "",
        label: normaliseLabel(pack.title_parts?.label ?? setId) ?? setId,
        card_count: cards.length,
        langs: [langCode],
      })
    }

    if (DOWNLOAD_IMAGES) {
      for (const card of cards) {
        if (card.img_full_url) {
          imageTasks.push(() => downloadImage(langCode, card.id, card.img_full_url))
        }
        for (const variant of card.variants ?? []) {
          if (variant.img_full_url) {
            imageTasks.push(() => downloadImage(langCode, variant.id, variant.img_full_url))
          }
        }
      }
    }

    console.log(`  ✓ ${langCode}/${setId} — ${cards.length} cards`)
  }
}

// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(CACHE_DIR)) {
    console.error(`Cache not found: ${CACHE_DIR}`)
    console.error("Run ./scripts/update-data.sh first to fetch card data.")
    process.exit(1)
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const indexSets = []
  const imageTasks = []
  const cardMap = new Map()

  for (const [langDir, langCode] of Object.entries(LANG_MAP)) {
    const langPath = join(CACHE_DIR, langDir)
    if (!existsSync(langPath)) {
      console.warn(`  ⚠ Language folder not found: ${langDir}`)
      continue
    }
    await processLanguage(langPath, langCode, indexSets, imageTasks, cardMap)
  }

  // Sort sets: OP first, then ST, EB, PRB, PROMO — most recent first within each group
  const TYPE_PRIORITY = { OP: 0, ST: 1, EB: 2, PRB: 3, PROMO: 4 }
  function setKey(id) {
    const m = id.match(/^([A-Z]+)(\d+)/)
    if (!m) return `9_0000`
    const [, type, num] = m
    return `${(TYPE_PRIORITY[type] ?? 8)}_${(9999 - parseInt(num, 10)).toString().padStart(4, "0")}`
  }
  indexSets.sort((a, b) => setKey(a.id).localeCompare(setKey(b.id)))

  writeFileSync(join(OUTPUT_DIR, "index.json"), JSON.stringify({ sets: indexSets }, null, 2))
  writeFileSync(join(OUTPUT_DIR, "cardmap.json"), JSON.stringify(Object.fromEntries(cardMap)))

  console.log(`\n${indexSets.length} sets written to ${OUTPUT_DIR}/`)
  console.log(`${cardMap.size} cards in cardmap.json`)

  if (DOWNLOAD_IMAGES && imageTasks.length > 0) {
    console.log(`\nDownloading ${imageTasks.length} images (concurrency: ${IMAGE_CONCURRENCY})...`)
    const results = await runConcurrent(imageTasks, IMAGE_CONCURRENCY)
    const downloaded = results.filter(Boolean).length
    console.log(`  ✓ ${downloaded} downloaded, ${results.length - downloaded} already cached`)
  }

  console.log("\nDone!")
}

main()
