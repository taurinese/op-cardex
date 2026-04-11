import * as React from "react"
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { RARITY_ORDER, RARITY_SHORT, RARITY_COLOR, RARITY_COLOR_ACTIVE } from "@/lib/constants"
import type { Card } from "@/types/card"

export function RarityFilter({
  cards,
  active,
  onChange,
}: {
  cards: Card[]
  active: Set<string>
  onChange: (rarity: Set<string>) => void
}) {
  const tiles = React.useMemo(() => cards.flatMap((card) => [
    card.rarity,
    ...card.variants.filter((v) => v.set_id === undefined).map((v) => v.rarity ?? card.rarity),
  ]), [cards])

  const available = React.useMemo(() => RARITY_ORDER.filter((r) => tiles.includes(r)), [tiles])

  if (available.length === 0) return null

  function toggle(rarity: string) {
    const next = new Set(active)
    if (next.has(rarity)) next.delete(rarity)
    else next.add(rarity)
    onChange(next)
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {available.map((rarity) => {
        const count = tiles.filter((r) => r === rarity).length
        const isActive = active.has(rarity)

        return (
          <button
            key={rarity}
            onClick={() => toggle(rarity)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
              isActive
                ? RARITY_COLOR_ACTIVE[rarity] ?? "border-border bg-muted text-foreground"
                : (RARITY_COLOR[rarity] ?? RARITY_COLOR.Common)
            )}
          >
            {RARITY_SHORT[rarity] ?? rarity}
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
              isActive ? "bg-black/20" : "bg-background/50"
            )}>
              {count}
            </span>
          </button>
        )
      })}

      {active.size < available.length && (
        <button
          onClick={() => onChange(new Set(available))}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Check className="size-3" />
          Toutes
        </button>
      )}

      {active.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <X className="size-3" />
          Effacer
        </button>
      )}
    </div>
  )
}
