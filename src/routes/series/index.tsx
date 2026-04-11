import * as React from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Check, CheckSquare, Square, X } from "lucide-react"
import GB from "country-flag-icons/react/3x2/GB"
import FR from "country-flag-icons/react/3x2/FR"
import JP from "country-flag-icons/react/3x2/JP"

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


const LANG_FLAGS: Record<Lang, React.ElementType> = {
  en: GB,
  fr: FR,
  jp: JP,
}

const LANG_OPTIONS: { value: Lang }[] = [
  { value: "en" },
  { value: "fr" },
  { value: "jp" },
]

const GRID_COLS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
}

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

// Rarity display order — least rare first (left)
const RARITY_ORDER = [
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
  const [rarityFilter, setRarityFilter] = React.useState<Set<string>>(new Set())
  const [cardFilter, setCardFilter] = React.useState<"all" | "base" | "alt">("all")
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [columns, setColumns] = React.useState(() =>
    Math.min(10, Math.max(3, parseInt(localStorage.getItem("collection-columns") ?? "7", 10)))
  )

  React.useEffect(() => {
    localStorage.setItem("collection-columns", String(columns))
  }, [columns])

  // Reset filters + select mode when set changes
  React.useEffect(() => {
    setRarityFilter(new Set())
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

  const filteredCards = cards
    ? rarityFilter.size > 0 ? cards.filter((c) => rarityFilter.has(c.rarity)) : cards
    : null

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Filters — row 1: controls */}
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Série</label>
          <select
            value={set ?? ""}
            onChange={(e) => handleSetChange(e.target.value)}
            className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Choisir une série —</option>
            {setsForLang.map((s) => (
              <option key={s.id} value={s.id}>{s.label} — {s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Langue</label>
          <div className="flex h-9 overflow-hidden rounded-md border border-border">
            {LANG_OPTIONS.map(({ value }) => {
              const Flag = LANG_FLAGS[value]
              return (
                <button
                  key={value}
                  onClick={() => handleLangChange(value)}
                  className={`px-3 transition-colors hover:opacity-100 cursor-pointer ${
                    lang === value ? "bg-amber-400/20 opacity-100" : "bg-background opacity-50"
                  }`}
                >
                  <Flag className="h-4 w-6 rounded-sm" />
                </button>
              )
            })}
          </div>
        </div>

        {cards && cards.some((c) => c.variants.length > 0) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Version</label>
            <div className="flex h-9 overflow-hidden rounded-md border border-border">
              {(["all", "base", "alt"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCardFilter(f)}
                  className={`px-3 text-sm font-medium transition-colors hover:text-foreground cursor-pointer ${
                    cardFilter === f ? "bg-amber-400 text-black" : "bg-background text-muted-foreground"
                  }`}
                >
                  {f === "all" ? "Toutes" : f === "base" ? "Base" : "Parallèles"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Column picker */}
        {cards && cards.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Colonnes</label>
            <div className="flex h-9 items-center overflow-hidden rounded-md border border-border">
              <button
                onClick={() => setColumns((c) => Math.max(3, c - 1))}
                disabled={columns <= 3}
                className="cursor-pointer px-2.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >−</button>
              <span className="w-6 text-center text-sm font-medium tabular-nums">{columns}</span>
              <button
                onClick={() => setColumns((c) => Math.min(10, c + 1))}
                disabled={columns >= 10}
                className="cursor-pointer px-2.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              >+</button>
            </div>
          </div>
        )}

        {/* Sélectionner always pinned to the right */}
        {user && cards && cards.length > 0 && (
          <div className="ml-auto flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider invisible">.</span>
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
          </div>
        )}
      </div>

      {/* Filters — row 2: set info */}
      {currentSet && (
        <p className="mb-6 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{currentSet.name}</span>
          {" — "}
          {currentSet.card_count} cartes
        </p>
      )}

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
          columns={columns}
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

const RARITY_COLOR: Record<string, string> = {
  Leader:      "border-amber-400/60 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20",
  SecretRare:  "border-pink-400/60 bg-pink-400/10 text-pink-400 hover:bg-pink-400/20",
  TreasureRare:"border-yellow-400/60 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20",
  SuperRare:   "border-purple-400/60 bg-purple-400/10 text-purple-400 hover:bg-purple-400/20",
  Rare:        "border-blue-400/60 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20",
  Uncommon:    "border-green-400/60 bg-green-400/10 text-green-400 hover:bg-green-400/20",
  Common:      "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
  Special:     "border-orange-400/60 bg-orange-400/10 text-orange-400 hover:bg-orange-400/20",
  Promo:       "border-cyan-400/60 bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20",
}

const RARITY_COLOR_ACTIVE: Record<string, string> = {
  Leader:      "border-amber-400 bg-amber-400 text-black",
  SecretRare:  "border-pink-400 bg-pink-400 text-black",
  TreasureRare:"border-yellow-400 bg-yellow-400 text-black",
  SuperRare:   "border-purple-400 bg-purple-400 text-white",
  Rare:        "border-blue-400 bg-blue-400 text-white",
  Uncommon:    "border-green-400 bg-green-400 text-black",
  Common:      "border-border bg-muted text-foreground",
  Special:     "border-orange-400 bg-orange-400 text-black",
  Promo:       "border-cyan-400 bg-cyan-400 text-black",
}

function RarityFilter({
  cards,
  active,
  onChange,
}: {
  cards: Card[]
  active: Set<string>
  onChange: (rarity: Set<string>) => void
}) {
  const available = RARITY_ORDER.filter((r) => cards.some((c) => c.rarity === r))

  function toggle(rarity: string) {
    const next = new Set(active)
    if (next.has(rarity)) next.delete(rarity)
    else next.add(rarity)
    onChange(next)
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {available.map((rarity) => {
        const count = cards.filter((c) => c.rarity === rarity).length
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
                {s.label} — {s.name}
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
  columns,
  selectMode,
  selectedIds,
  onCardClick,
  onToggleSelect,
}: {
  cards: Card[]
  lang: Lang
  cardFilter: "all" | "base" | "alt"
  columns: number
  selectMode: boolean
  selectedIds: Set<string>
  onCardClick: (card: Card, versionIndex: number) => void
  onToggleSelect: (cardId: string) => void
}) {
  const items = cards.flatMap((card) => [
    { card, versionIndex: 0 },
    // Exclude cross-set variants (set_id defined) — they appear as standalone tiles in their own set
    ...card.variants
      .map((v, i) => ({ card, versionIndex: i + 1, variant: v }))
      .filter(({ variant }) => variant.set_id === undefined),
  ]).filter(({ versionIndex }) =>
    cardFilter === "all" ? true : cardFilter === "base" ? versionIndex === 0 : versionIndex > 0
  ).sort((a, b) => {
    const ra = a.versionIndex === 0 ? a.card.rarity : (a.card.variants[a.versionIndex - 1].rarity ?? a.card.rarity)
    const rb = b.versionIndex === 0 ? b.card.rarity : (b.card.variants[b.versionIndex - 1].rarity ?? b.card.rarity)
    const rank = (r: string) => r === "TreasureRare" ? 2 : r === "Special" ? 1 : 0
    return rank(ra) - rank(rb)
  })

  return (
    <div className={cn("grid gap-3", GRID_COLS[columns])}>
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
            para
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
