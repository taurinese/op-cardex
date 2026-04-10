/**
 * Upload card images to Cloudflare R2
 *
 * Usage:
 *   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx node scripts/upload-images.mjs
 *
 * Prerequisites:
 *   - Run `node scripts/build-data.mjs` first to download images locally
 *   - Create an R2 API token at: Cloudflare Dashboard → R2 → Manage R2 API tokens
 *     (needs "Object Read & Write" permissions on the op-cardex-images bucket)
 *   - Your R2 Account ID is visible at: Cloudflare Dashboard → R2 → Overview
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"
import { readdirSync, readFileSync, existsSync } from "fs"
import { join } from "path"

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = "op-cardex"
const IMAGES_BASE = "public/images/cards"
const CONCURRENCY = 20

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error(
    "Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY."
  )
  process.exit(1)
}

if (!existsSync(IMAGES_BASE)) {
  console.error(`Images folder not found: ${IMAGES_BASE}`)
  console.error("Run `node scripts/build-data.mjs` first.")
  process.exit(1)
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
})

function collectImages() {
  const files = []
  for (const lang of readdirSync(IMAGES_BASE)) {
    const langDir = join(IMAGES_BASE, lang)
    for (const file of readdirSync(langDir)) {
      if (file.endsWith(".png")) {
        files.push({ key: `${lang}/${file}`, path: join(langDir, file) })
      }
    }
  }
  return files
}

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function upload(key, filePath) {
  if (await exists(key)) return "skipped"
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: readFileSync(filePath),
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return "uploaded"
}

async function runConcurrent(tasks, limit) {
  const queue = [...tasks]
  const results = []
  async function worker() {
    while (queue.length > 0) {
      results.push(await queue.shift()())
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

async function main() {
  const images = collectImages()
  console.log(`Found ${images.length} images to sync...`)

  const tasks = images.map(({ key, path }) => async () => {
    const result = await upload(key, path)
    if (result === "uploaded") process.stdout.write(".")
    return result
  })

  const results = await runConcurrent(tasks, CONCURRENCY)
  const uploaded = results.filter((r) => r === "uploaded").length
  const skipped = results.filter((r) => r === "skipped").length

  console.log(`\n\nDone! ${uploaded} uploaded, ${skipped} already in R2.`)
}

main()
