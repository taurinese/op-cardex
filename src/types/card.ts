export type CardCategory = "Leader" | "Character" | "Event" | "Stage" | "Don"

export type CardRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "SuperRare"
  | "SecretRare"
  | "Leader"
  | "Special"
  | "TreasureRare"
  | "Promo"

export type CardColor = "Red" | "Green" | "Blue" | "Purple" | "Black" | "Yellow"

export type Lang = "en" | "fr" | "jp"

/** A card variant (alternate art, parallel, etc.) — same game data, different art */
export type CardVariant = {
  id: string
  img_full_url: string
  img_url: string
}

export type Card = {
  id: string
  pack_id: string
  name: string
  rarity: CardRarity
  category: CardCategory
  img_url: string
  img_full_url: string
  colors: CardColor[]
  cost: number | null
  power: number | null
  counter: number | null
  attributes: string[]
  types: string[]
  effect: string | null
  trigger: string | null
  variants: CardVariant[]
}

export type SetMeta = {
  id: string       // "OP01"
  name: string     // "ROMANCE DAWN"
  prefix: string   // "BOOSTER PACK" | "STARTER DECK" | ...
  card_count: number
  langs: Lang[]
}

export type DataIndex = {
  sets: SetMeta[]
}
