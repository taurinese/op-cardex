import { useCollection } from "@/lib/collection.tsx"
import { cn } from "@/lib/utils"
import { GRID_COLS } from "@/lib/constants"
import type { Card, Lang } from "@/types/card"

import { CardTile } from "./card-tile"

function tileRarity(card: Card, versionIndex: number): string {
  return versionIndex === 0
    ? card.rarity
    : (card.variants[versionIndex - 1]?.rarity ?? card.rarity)
}

export function CardGrid({
  cards,
  lang,
  cardFilter,
  rarityFilter,
  columns,
  selectMode,
  selectedIds,
  onCardClick,
  onToggleSelect,
  ownFilter,
  dimUnowned = false,
  emptyMessage,
}: {
  cards: Card[]
  lang: Lang
  cardFilter: "all" | "base" | "alt"
  rarityFilter: Set<string>
  columns: number
  selectMode: boolean
  selectedIds: Set<string>
  onCardClick: (card: Card, versionIndex: number) => void
  onToggleSelect: (cardId: string) => void
  ownFilter?: "all" | "owned" | "unowned"
  dimUnowned?: boolean
  emptyMessage?: string
}) {
  const { isOwned } = useCollection()

  const items = cards
    .flatMap((card) => [
      { card, versionIndex: 0 },
      ...card.variants
        .map((v, i) => ({ card, versionIndex: i + 1, variant: v }))
        .filter(({ variant }) => variant.set_id === undefined),
    ])
    .filter(({ versionIndex }) =>
      cardFilter === "all" ? true : cardFilter === "base" ? versionIndex === 0 : versionIndex > 0
    )
    .filter(({ card, versionIndex }) => {
      if (rarityFilter.size === 0) return true
      return rarityFilter.has(tileRarity(card, versionIndex))
    })
    .sort((a, b) => {
      const ra = tileRarity(a.card, a.versionIndex)
      const rb = tileRarity(b.card, b.versionIndex)
      const rank = (r: string) => r === "TreasureRare" ? 2 : r === "Special" ? 1 : 0
      return rank(ra) - rank(rb)
    })

  const displayed = !ownFilter || ownFilter === "all"
    ? items
    : items.filter(({ card, versionIndex }) => {
        const id = versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
        return ownFilter === "owned" ? isOwned(id, lang) : !isOwned(id, lang)
      })

  if (displayed.length === 0 && emptyMessage) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className={cn("grid gap-3", GRID_COLS[columns])}>
      {displayed.map(({ card, versionIndex }) => {
        const displayId = versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
        return (
          <CardTile
            key={displayId}
            card={card}
            versionIndex={versionIndex}
            lang={lang}
            selectMode={selectMode}
            isSelected={selectedIds.has(displayId)}
            dimUnowned={dimUnowned}
            onClick={() => onCardClick(card, versionIndex)}
            onToggleSelect={() => onToggleSelect(displayId)}
          />
        )
      })}
    </div>
  )
}
