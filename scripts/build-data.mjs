/**
 * Build script — aggregates punk-records card data into public/data/
 * and downloads card images into public/images/cards/
 *
 * Usage:
 *   node scripts/build-data.mjs              # data + images
 *   node scripts/build-data.mjs --no-images  # data only
 *
 * Cross-set variants (e.g. SP cards released in a later booster) are attached
 * to the base card as variants with { set_id, set_name } fields, and also
 * appear as standalone tiles in the set they belong to.
 */

import { execSync } from "child_process"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs"
import { basename, join } from "path"

const PUNK_RECORDS_URL = "https://github.com/buhbbl/punk-records.git"
const CACHE_DIR = ".punk-records-cache"
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

function fetchPunkRecords() {
  if (existsSync(CACHE_DIR)) {
    console.log("Updating punk-records cache...")
    execSync(`git -C ${CACHE_DIR} pull`, { stdio: "inherit" })
  } else {
    console.log("Cloning punk-records (shallow)...")
    execSync(`git clone --depth 1 ${PUNK_RECORDS_URL} ${CACHE_DIR}`, {
      stdio: "inherit",
    })
  }
}

/** Derive the normalised set ID from a pack object (e.g. "OP-09" → "OP09") */
function deriveSetId(pack, packDir) {
  const rawLabel =
    pack.title_parts?.label ??
    pack.raw_title?.match(/[【\[]([A-Z0-9]+-?[A-Z]{2}\d+|[A-Z]{2}-?\d+)[】\]]/)?.[1]
  if (!rawLabel) {
    // Detect promo set by presence of base cards with P-XXX IDs
    if (packDir && existsSync(packDir)) {
      const promoCount = readdirSync(packDir).filter(
        (f) => /^P-\d+\.json$/.test(f)
      ).length
      if (promoCount >= 5) return "PROMO"
    }
    return null
  }
  return rawLabel?.replace(/-/g, "")             // strip all hyphens: "OP-01" → "OP01"
}

/** Normalise a raw label for display: "OP14-EB04" → "OP-14 / EB-04", "OP-01" → "OP-01" */
function normaliseLabel(rawLabel) {
  if (!rawLabel) return rawLabel
  // Step 1: insert hyphen between adjacent letters+digits: "OP14" → "OP-14"
  // (only when not already separated by a hyphen)
  const withHyphens = rawLabel.replace(/([A-Z]+)(\d+)/g, "$1-$2")
  // Step 2: replace the compound separator (hyphen before an uppercase letter) with " / "
  // "OP-14-EB-04" → "OP-14 / EB-04"
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

async function processLanguage(langPath, langCode, indexSets, imageTasks) {
  const packsRaw = JSON.parse(readFileSync(join(langPath, "packs.json"), "utf-8"))
  const packs = Object.values(packsRaw)

  // ── Phase 1: global scan ──────────────────────────────────────────────────
  // Collect every card file across every pack so we can resolve cross-set variants.
  //
  // variantsByBase : baseId → [{ id, packId, setId, setName, card }]
  // basesInPack   : packId → Map<baseId, card>

  const variantsByBase = new Map()
  const basesInPack = new Map()

  for (const pack of packs) {
    const packDir = join(langPath, "cards", pack.id)
    if (!existsSync(packDir)) continue

    const setId = deriveSetId(pack, join(langPath, "cards", pack.id))
    const setName = pack.title_parts?.title ?? pack.raw_title
    const packBases = new Map()

    for (const file of readdirSync(packDir).filter((f) => f.endsWith(".json"))) {
      const cardId = basename(file, ".json")
      const card = decodeEntities(JSON.parse(readFileSync(join(packDir, file), "utf-8")))

      if (isVariantId(cardId)) {
        const baseId = baseIdOf(cardId)
        if (!variantsByBase.has(baseId)) variantsByBase.set(baseId, [])
        const setLabel = pack.title_parts?.label ?? (setId === "PROMO" ? "PROMO" : null)
        variantsByBase.get(baseId).push({ id: cardId, packId: pack.id, setId, setLabel, card })
      } else {
        packBases.set(cardId, card)
      }
    }

    basesInPack.set(pack.id, packBases)
  }

  // ── Phase 2: build one JSON per set ──────────────────────────────────────

  const outputLangDir = join(OUTPUT_DIR, langCode)
  mkdirSync(outputLangDir, { recursive: true })
  if (DOWNLOAD_IMAGES) mkdirSync(join(IMAGES_BASE_DIR, langCode), { recursive: true })

  for (const pack of packs) {
    const setId = deriveSetId(pack, join(langPath, "cards", pack.id))
    if (!setId) continue

    const packBases = basesInPack.get(pack.id)
    const packDir = join(langPath, "cards", pack.id)
    if (!existsSync(packDir)) continue

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
            // Only add set info for cross-pack variants
            ...(isSamePack ? {} : { set_id: v.setId ?? null, set_label: v.setLabel ?? null }),
          }
        })
        // Same-pack first, then cross-set sorted by setId
        .sort((a, b) => {
          if (!a.set_id && !b.set_id) return a.id.localeCompare(b.id)
          if (!a.set_id) return -1
          if (!b.set_id) return 1
          return (a.set_id ?? "").localeCompare(b.set_id ?? "")
        })

      cards.push({ ...baseCard, variants: allVariants })
    }

    // ── Orphan variants: variant cards whose base card lives in another pack ─
    // Group by base ID: first orphan becomes the tile, others become its variants.
    const orphansByBase = new Map()
    for (const file of readdirSync(packDir).filter((f) => f.endsWith(".json"))) {
      const cardId = basename(file, ".json")
      if (!isVariantId(cardId)) continue

      const baseId = baseIdOf(cardId)
      if (packBases?.has(baseId)) continue // base is same pack → already handled

      const card = decodeEntities(JSON.parse(readFileSync(join(packDir, file), "utf-8")))
      if (!orphansByBase.has(baseId)) orphansByBase.set(baseId, [])
      orphansByBase.get(baseId).push({ id: cardId, card })
    }

    for (const group of orphansByBase.values()) {
      group.sort((a, b) => a.id.localeCompare(b.id))
      const [first, ...rest] = group
      const variants = rest.map((v) => ({
        id: v.id,
        img_url: v.card.img_url,
        img_full_url: v.card.img_full_url,
        rarity: v.card.rarity,
      }))
      cards.push({ ...first.card, variants })
    }

    if (cards.length === 0) continue

    cards.sort((a, b) => a.id.localeCompare(b.id))

    writeFileSync(
      join(outputLangDir, `${setId}.json`),
      JSON.stringify(cards, null, 2)
    )

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
  fetchPunkRecords()

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const indexSets = []
  const imageTasks = []

  for (const [langDir, langCode] of Object.entries(LANG_MAP)) {
    const langPath = join(CACHE_DIR, langDir)
    if (!existsSync(langPath)) {
      console.warn(`  ⚠ Language folder not found: ${langDir}`)
      continue
    }
    await processLanguage(langPath, langCode, indexSets, imageTasks)
  }

  // Sort by release order: OP first (by number), then ST, EB, PRB, PROMO
  // Sort: OP first, then ST, EB, PRB, PROMO — most recent (highest number) within each group
  const TYPE_PRIORITY = { OP: 0, ST: 1, EB: 2, PRB: 3, PROMO: 4 }
  function setKey(id) {
    const m = id.match(/^([A-Z]+)(\d+)/)
    if (!m) return `9_0000`
    const [, type, num] = m
    const typePriority = (TYPE_PRIORITY[type] ?? 8).toString()
    const numDesc = (9999 - parseInt(num, 10)).toString().padStart(4, "0")
    return `${typePriority}_${numDesc}`
  }
  indexSets.sort((a, b) => setKey(a.id).localeCompare(setKey(b.id)))
  writeFileSync(
    join(OUTPUT_DIR, "index.json"),
    JSON.stringify({ sets: indexSets }, null, 2)
  )
  console.log(`\n${indexSets.length} sets written to ${OUTPUT_DIR}/`)

  if (DOWNLOAD_IMAGES && imageTasks.length > 0) {
    console.log(
      `\nDownloading ${imageTasks.length} images (concurrency: ${IMAGE_CONCURRENCY})...`
    )
    const results = await runConcurrent(imageTasks, IMAGE_CONCURRENCY)
    const downloaded = results.filter(Boolean).length
    console.log(
      `  ✓ ${downloaded} downloaded, ${results.length - downloaded} already cached`
    )
  }

  console.log("\nDone!")
}

main()
