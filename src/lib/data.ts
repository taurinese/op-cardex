import type { Card, DataIndex, Lang } from "@/types/card"

function dataUrl(path: string) {
  return `${import.meta.env.BASE_URL}data/${path}`
}

const R2_BASE = "https://pub-6a5c5f1c4c814f3fb6ec33fee8a3d921.r2.dev"

export function cardImageUrl(cardId: string, lang: Lang = "en") {
  return `${R2_BASE}/${lang}/${cardId}.png`
}

export async function fetchIndex(): Promise<DataIndex> {
  const res = await fetch(dataUrl("index.json"))
  if (!res.ok) throw new Error("Failed to load index.json")
  return res.json()
}

export async function fetchSet(setId: string, lang: Lang = "en"): Promise<Card[]> {
  const res = await fetch(dataUrl(`${lang}/${setId}.json`))
  if (!res.ok) return []
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return []
  return res.json()
}
