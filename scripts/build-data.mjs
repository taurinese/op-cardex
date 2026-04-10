/**
 * Build script — aggregates punk-records card data into public/data/
 * and downloads card images into public/images/cards/
 *
 * Usage:
 *   node scripts/build-data.mjs              # data + images
 *   node scripts/build-data.mjs --no-images  # data only
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

function processPackCards(packDir) {
  const files = readdirSync(packDir).filter((f) => f.endsWith(".json"))

  const baseCards = new Map()
  const variantIds = []

  for (const file of files) {
    const id = basename(file, ".json")
    const card = JSON.parse(readFileSync(join(packDir, file), "utf-8"))

    if (/_p\d+$/.test(id)) {
      variantIds.push(id)
    } else {
      baseCards.set(id, { ...card, variants: [] })
    }
  }

  for (const variantId of variantIds) {
    const baseId = variantId.replace(/_p\d+$/, "")
    if (baseCards.has(baseId)) {
      const variant = JSON.parse(
        readFileSync(join(packDir, `${variantId}.json`), "utf-8")
      )
      baseCards.get(baseId).variants.push(variant)
    }
  }

  return Array.from(baseCards.values()).sort((a, b) =>
    a.id.localeCompare(b.id)
  )
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

    const packs = Object.values(
      JSON.parse(readFileSync(join(langPath, "packs.json"), "utf-8"))
    )
    const outputLangDir = join(OUTPUT_DIR, langCode)
    mkdirSync(outputLangDir, { recursive: true })
    if (DOWNLOAD_IMAGES) mkdirSync(join(IMAGES_BASE_DIR, langCode), { recursive: true })

    for (const pack of packs) {
      const rawLabel =
        pack.title_parts?.label ??
        pack.raw_title?.match(/[【\[]([A-Z0-9]+-?[A-Z]{2}\d+|[A-Z]{2}-?\d+)[】\]]/)?.[1]
      // Normalize: "OP14-EB04" → "EB04", "EB-04" → "EB04"
      const setId = rawLabel
        ?.replace(/^[A-Z0-9]+-(?=[A-Z]{2}\d)/, "") // strip "OP14-" prefix
        ?.replace("-", "")                           // strip remaining hyphens
      if (!setId) continue

      const packDir = join(langPath, "cards", pack.id)
      if (!existsSync(packDir)) continue

      const cards = processPackCards(packDir)

      writeFileSync(
        join(outputLangDir, `${setId}.json`),
        JSON.stringify(cards, null, 2)
      )

      // Track which languages are available for each set
      const existing = indexSets.find((s) => s.id === setId)
      if (existing) {
        existing.langs.push(langCode)
      } else {
        indexSets.push({
          id: setId,
          name: pack.title_parts?.title ?? pack.raw_title,
          prefix: pack.title_parts?.prefix ?? "",
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

  indexSets.sort((a, b) => a.id.localeCompare(b.id))
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
