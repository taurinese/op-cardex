import { CheckSquare, Square } from "lucide-react"

import { cardImageUrl } from "@/lib/data"
import { useCollection } from "@/lib/collection.tsx"
import { useAuth } from "@/context/auth"
import { cn } from "@/lib/utils"
import { RARITY_BADGE, RARITY_SHORT, COLOR_DOT } from "@/lib/constants"
import type { Card, Lang } from "@/types/card"

export function CardTile({
  card,
  versionIndex,
  lang,
  selectMode,
  isSelected,
  dimUnowned = false,
  onClick,
  onToggleSelect,
}: {
  card: Card
  versionIndex: number
  lang: Lang
  selectMode: boolean
  isSelected: boolean
  dimUnowned?: boolean
  onClick: () => void
  onToggleSelect: () => void
}) {
  const { user } = useAuth()
  const { isOwned, toggle } = useCollection()

  const displayId = versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
  const currentRarity = versionIndex === 0 ? card.rarity : (card.variants[versionIndex - 1]?.rarity ?? card.rarity)
  const rarityClass = RARITY_BADGE[currentRarity] ?? RARITY_BADGE.Common
  const isVariant = versionIndex > 0
  const owned = isOwned(displayId, lang)

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation()
    toggle(displayId, lang)
  }

  function handleClick() {
    if (selectMode) onToggleSelect()
    else onClick()
  }

  return (
    <div className="group flex cursor-pointer flex-col gap-1.5" onClick={handleClick}>
      <div className={cn(
        "relative overflow-hidden rounded-lg border bg-muted aspect-[63/88] transition-all group-hover:-translate-y-0.5",
        isSelected
          ? "border-amber-400 ring-2 ring-amber-400/30"
          : dimUnowned
            ? owned
              ? "border-amber-400/30 group-hover:border-amber-400/60 group-hover:shadow-lg group-hover:shadow-amber-400/10"
              : "border-border/30 group-hover:border-border/60"
            : "border-border/30 group-hover:border-amber-400/40 group-hover:shadow-lg group-hover:shadow-amber-400/5"
      )}>
        <img
          src={cardImageUrl(displayId, lang)}
          alt={card.name}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover",
            dimUnowned && !owned && "opacity-30 grayscale transition-all group-hover:opacity-60 group-hover:grayscale-0"
          )}
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />

        {/* Variant label */}
        {isVariant && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            para
          </span>
        )}

        {/* Owned badge / select checkbox */}
        {selectMode ? (
          <div className={cn("absolute left-1 top-1 rounded p-0.5", isSelected ? "text-amber-400" : "text-white/70")}>
            {isSelected ? <CheckSquare className="size-4 drop-shadow" /> : <Square className="size-4 drop-shadow" />}
          </div>
        ) : owned ? (
          <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-black">
            ✓
          </span>
        ) : null}

        {/* Quick add button */}
        {user && !selectMode && (
          <button
            onClick={handleQuickAdd}
            className={cn(
              "absolute bottom-1 left-1 cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm transition-all",
              "opacity-0 group-hover:opacity-100",
              owned ? "bg-amber-400/90 text-black" : "bg-black/70 text-white hover:bg-amber-400/90 hover:text-black"
            )}
          >
            {owned ? "✓" : "+"}
          </button>
        )}
      </div>

      <div className="flex items-start justify-between gap-1 px-0.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-tight">{card.name}</p>
          <p className="text-[10px] text-muted-foreground">{displayId}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${rarityClass}`}>
            {RARITY_SHORT[currentRarity] ?? currentRarity}
          </span>
          <div className="flex gap-0.5">
            {card.colors.map((color) => (
              <span
                key={color}
                className={`size-2 rounded-full ${COLOR_DOT[color] ?? "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
