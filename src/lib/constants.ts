export const GRID_COLS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
}

export const RARITY_BADGE: Record<string, string> = {
  Leader: "bg-amber-400/15 text-amber-400",
  SecretRare: "bg-pink-400/15 text-pink-400",
  TreasureRare: "bg-yellow-400/15 text-yellow-400",
  SuperRare: "bg-purple-400/15 text-purple-400",
  Rare: "bg-blue-400/15 text-blue-400",
  Uncommon: "bg-green-400/15 text-green-400",
  Common: "bg-muted text-muted-foreground",
  Special: "bg-orange-400/15 text-orange-400",
  Promo: "bg-cyan-400/15 text-cyan-400",
}

export const RARITY_ORDER = [
  "Leader",
  "Common",
  "Uncommon",
  "Rare",
  "SuperRare",
  "SecretRare",
  "Special",
  "TreasureRare",
  "Promo",
]

export const RARITY_SHORT: Record<string, string> = {
  Leader: "L",
  SecretRare: "SEC",
  TreasureRare: "TR",
  SuperRare: "SR",
  Rare: "R",
  Uncommon: "UC",
  Common: "C",
  Special: "SP",
  Promo: "P",
}

export const RARITY_COLOR: Record<string, string> = {
  Leader:       "border-amber-400/60 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20",
  SecretRare:   "border-pink-400/60 bg-pink-400/10 text-pink-400 hover:bg-pink-400/20",
  TreasureRare: "border-yellow-400/60 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20",
  SuperRare:    "border-purple-400/60 bg-purple-400/10 text-purple-400 hover:bg-purple-400/20",
  Rare:         "border-blue-400/60 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20",
  Uncommon:     "border-green-400/60 bg-green-400/10 text-green-400 hover:bg-green-400/20",
  Common:       "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
  Special:      "border-orange-400/60 bg-orange-400/10 text-orange-400 hover:bg-orange-400/20",
  Promo:        "border-cyan-400/60 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20",
}

export const RARITY_COLOR_ACTIVE: Record<string, string> = {
  Leader:       "border-amber-400 bg-amber-400 text-black",
  SecretRare:   "border-pink-400 bg-pink-400 text-black",
  TreasureRare: "border-yellow-400 bg-yellow-400 text-black",
  SuperRare:    "border-purple-400 bg-purple-400 text-white",
  Rare:         "border-blue-400 bg-blue-400 text-white",
  Uncommon:     "border-green-400 bg-green-400 text-black",
  Common:       "border-border bg-muted text-foreground",
  Special:      "border-orange-400 bg-orange-400 text-black",
  Promo:        "border-cyan-400 bg-cyan-400 text-black",
}

export const COLOR_DOT: Record<string, string> = {
  Red: "bg-red-500",
  Green: "bg-green-500",
  Blue: "bg-blue-500",
  Purple: "bg-purple-500",
  Black: "bg-slate-400",
  Yellow: "bg-yellow-400",
}
