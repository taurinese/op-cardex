import * as React from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Check, CheckSquare, Square, X } from "lucide-react"

import { CardModal } from "@/components/card-modal"
import { cardImageUrl, fetchIndex, fetchSet } from "@/lib/data"
import { useCollection } from "@/lib/collection.tsx"
import { useAuth } from "@/context/auth"
import type { Card, Lang, SetMeta } from "@/types/card"
import { cn } from "@/lib/utils"


// ---------------------------------------------------------------------------
// Search params

type SeriesSearch = {
  set?: string
  lang: Lang
}

function validateSearch(search: Record<string, unknown>): SeriesSearch {
  const lang = (["en", "fr", "jp"] as const).includes(search.lang as Lang)
    ? (search.lang as Lang)
    : "en"
  return {
    set: typeof search.set === "string" ? search.set : undefined,
    lang,
  }
}

// ---------------------------------------------------------------------------

export const Route = createFileRoute("/series/")({
  validateSearch,
  loaderDeps: ({ search }) => ({ set: search.set, lang: search.lang }),
  loader: async ({ deps: { set, lang } }) => {
    const index = await fetchIndex()

    if (!set) {
      const firstSet = index.sets.find((s) => s.langs?.includes(lang))
      if (firstSet) {
        throw redirect({ to: "/series", search: { set: firstSet.id, lang } })
      }
    }

    const cards = set ? await fetchSet(set, lang) : null
    return { index, cards }
  },
  component: SeriesPage,
})

// ---------------------------------------------------------------------------


const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "jp", label: "日本語" },
]

const RARITY_BADGE: Record<string, string> = {
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

// Rarity display order
const RARITY_ORDER = [
  "Leader",
  "SecretRare",
  "TreasureRare",
  "SuperRare",
  "Rare",
  "Uncommon",
  "Common",
  "Special",
  "Promo",
]

const RARITY_SHORT: Record<string, string> = {
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

const COLOR_DOT: Record<string, string> = {
  Red: "bg-red-500",
  Green: "bg-green-500",
  Blue: "bg-blue-500",
  Purple: "bg-purple-500",
  Black: "bg-slate-400",
  Yellow: "bg-yellow-400",
}

// ---------------------------------------------------------------------------

function SeriesPage() {
  const { index, cards } = Route.useLoaderData()
  const { set, lang } = Route.useSearch()
  const navigate = useNavigate({ from: "/series/" })
  const { user } = useAuth()
  const { isOwned, toggle } = useCollection()
  const [selectedCard, setSelectedCard] = React.useState<{ card: Card; versionIndex: number } | null>(null)
  const [rarityFilter, setRarityFilter] = React.useState<string | null>(null)
  const [cardFilter, setCardFilter] = React.useState<"all" | "base" | "alt">("all")
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  // Reset filters + select mode when set changes
  React.useEffect(() => {
    setRarityFilter(null)
    setCardFilter("all")
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [set])

  const currentSet = set ? index.sets.find((s) => s.id === set) : null

  function handleSetChange(value: string) {
    navigate({ search: (prev) => ({ ...prev, set: value || undefined }) })
  }

  function handleLangChange(value: Lang) {
    const setsInLang = index.sets.filter((s) => s.langs?.includes(value))
    const keepSet = set && setsInLang.some((s) => s.id === set)
    navigate({
      search: (prev) => ({
        ...prev,
        lang: value,
        set: keepSet ? prev.set : setsInLang[0]?.id,
      }),
    })
  }

  function handleToggleSelect(cardId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  async function handleConfirmSelect() {
    for (const cardId of selectedIds) {
      if (!isOwned(cardId, lang)) await toggle(cardId, lang)
    }
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const setsForLang = index.sets
    .filter((s) => s.langs?.includes(lang))
    .sort((a, b) => a.id.slice(0, 4).localeCompare(b.id.slice(0, 4)))

  const filteredCards = cards
    ? rarityFilter ? cards.filter((c) => c.rarity === rarityFilter) : cards
    : null

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Filters bar */}
      <div className="mb-8 flex flex-wrap items-end gap-4">
        {/* Series select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Série
          </label>
          <select
            value={set ?? ""}
            onChange={(e) => handleSetChange(e.target.value)}
            className="h-9 w-72 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Choisir une série —</option>
            {setsForLang.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Language select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Langue
          </label>
          <div className="flex h-9 overflow-hidden rounded-md border border-border">
            {LANG_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleLangChange(value)}
                className={`px-4 text-sm font-medium transition-colors hover:text-foreground cursor-pointer ${
                  lang === value
                    ? "bg-amber-400 text-black"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Card type filter */}
        {cards && cards.some((c) => c.variants.length > 0) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Version
            </label>
            <div className="flex h-9 overflow-hidden rounded-md border border-border">
              {(["all", "base", "alt"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCardFilter(f)}
                  className={`px-3 text-sm font-medium transition-colors hover:text-foreground cursor-pointer ${
                    cardFilter === f ? "bg-amber-400 text-black" : "bg-background text-muted-foreground"
                  }`}
                >
                  {f === "all" ? "Toutes" : f === "base" ? "Base" : "Alt"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Set info */}
        {currentSet && (
          <p className="ml-auto text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{currentSet.name}</span>
            {" — "}
            {currentSet.card_count} cartes
          </p>
        )}

        {/* Select mode toggle */}
        {user && cards && cards.length > 0 && (
          <button
            onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()) }}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
              selectMode
                ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {selectMode ? <X className="size-3.5" /> : <CheckSquare className="size-3.5" />}
            {selectMode ? "Annuler" : "Sélectionner"}
          </button>
        )}
      </div>

      {/* Rarity filter */}
      {cards && cards.length > 0 && (
        <RarityFilter cards={cards} active={rarityFilter} onChange={setRarityFilter} />
      )}

      {/* Content */}
      {!set ? (
        <EmptyState sets={setsForLang} onSelect={handleSetChange} />
      ) : !filteredCards ? null : (
        <CardsGrid
          cards={filteredCards}
          lang={lang}
          cardFilter={cardFilter}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onCardClick={(card, versionIndex) => setSelectedCard({ card, versionIndex })}
          onToggleSelect={handleToggleSelect}
        />
      )}

      {/* Multi-select bottom bar */}
      {selectMode && (
        <div className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-md transition-all",
          selectedIds.size > 0 ? "translate-y-0" : "translate-y-full"
        )}>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedIds.size}</span> carte{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </p>
            <button
              onClick={handleConfirmSelect}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-300"
            >
              <Check className="size-4" />
              Ajouter à ma collection
            </button>
          </div>
        </div>
      )}

      <CardModal
        card={selectedCard?.card ?? null}
        lang={lang}
        initialVersionIndex={selectedCard?.versionIndex ?? 0}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function RarityFilter({
  cards,
  active,
  onChange,
}: {
  cards: Card[]
  active: string | null
  onChange: (rarity: string | null) => void
}) {
  const available = RARITY_ORDER.filter((r) => cards.some((c) => c.rarity === r))

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {available.map((rarity) => {
        const count = cards.filter((c) => c.rarity === rarity).length
        const isActive = active === rarity
        const badgeClass = RARITY_BADGE[rarity] ?? RARITY_BADGE.Common

        return (
          <button
            key={rarity}
            onClick={() => onChange(isActive ? null : rarity)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? `${badgeClass} border-current`
                : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {RARITY_SHORT[rarity] ?? rarity}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-black/10" : "bg-muted"}`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function EmptyState({
  sets,
  onSelect,
}: {
  sets: SetMeta[]
  onSelect: (id: string) => void
}) {
  const recent = sets.filter((s) => s.id.startsWith("OP")).slice(-4).reverse()

  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center">
      <div>
        <p className="text-lg font-medium">Choisis une série pour commencer</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {sets.length} séries disponibles
        </p>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Derniers boosters
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {recent.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="rounded-lg border border-border/50 bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-amber-400/30 hover:bg-amber-400/5 cursor-pointer"
              >
                {s.id} — {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function CardsGrid({
  cards,
  lang,
  cardFilter,
  selectMode,
  selectedIds,
  onCardClick,
  onToggleSelect,
}: {
  cards: Card[]
  lang: Lang
  cardFilter: "all" | "base" | "alt"
  selectMode: boolean
  selectedIds: Set<string>
  onCardClick: (card: Card, versionIndex: number) => void
  onToggleSelect: (cardId: string) => void
}) {
  const items = cards.flatMap((card) => [
    { card, versionIndex: 0 },
    ...card.variants.map((_, i) => ({ card, versionIndex: i + 1 })),
  ]).filter(({ versionIndex }) =>
    cardFilter === "all" ? true : cardFilter === "base" ? versionIndex === 0 : versionIndex > 0
  )

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
      {items.map(({ card, versionIndex }) => {
        const displayId = versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
        return (
          <CardTile
            key={displayId}
            card={card}
            versionIndex={versionIndex}
            lang={lang}
            selectMode={selectMode}
            isSelected={selectedIds.has(displayId)}
            onClick={() => onCardClick(card, versionIndex)}
            onToggleSelect={() => onToggleSelect(displayId)}
          />
        )
      })}
    </div>
  )
}

function CardTile({
  card,
  versionIndex,
  lang,
  selectMode,
  isSelected,
  onClick,
  onToggleSelect,
}: {
  card: Card
  versionIndex: number
  lang: Lang
  selectMode: boolean
  isSelected: boolean
  onClick: () => void
  onToggleSelect: () => void
}) {
  const rarityClass = RARITY_BADGE[card.rarity] ?? RARITY_BADGE.Common
  const { user } = useAuth()
  const { isOwned, toggle } = useCollection()

  const displayId = versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
  const isVariant = versionIndex > 0
  const owned = isOwned(displayId, lang)

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation()
    toggle(displayId, lang)
  }

  function handleClick() {
    if (selectMode) {
      onToggleSelect()
    } else {
      onClick()
    }
  }

  return (
    <div className="group flex cursor-pointer flex-col gap-1.5" onClick={handleClick}>
      <div className={cn(
        "relative overflow-hidden rounded-lg border bg-muted aspect-[63/88] transition-all group-hover:-translate-y-0.5",
        isSelected
          ? "border-amber-400 ring-2 ring-amber-400/30"
          : "border-border/30 group-hover:border-amber-400/40 group-hover:shadow-lg group-hover:shadow-amber-400/5"
      )}>
        <img
          src={cardImageUrl(displayId, lang)}
          alt={card.name}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />

        {/* Variant label */}
        {isVariant && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            alt
          </span>
        )}

        {/* Owned badge */}
        {owned && !selectMode && (
          <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-black">
            ✓
          </span>
        )}

        {/* Select mode checkbox */}
        {selectMode && (
          <div className={cn("absolute left-1 top-1 rounded p-0.5", isSelected ? "text-amber-400" : "text-white/70")}>
            {isSelected ? <CheckSquare className="size-4 drop-shadow" /> : <Square className="size-4 drop-shadow" />}
          </div>
        )}

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
            {RARITY_SHORT[card.rarity] ?? card.rarity}
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
