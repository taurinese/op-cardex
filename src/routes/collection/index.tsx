import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, CheckSquare, LayoutGrid, List, Square, X } from "lucide-react"

import { CardModal } from "@/components/card-modal"
import { cardImageUrl, fetchIndex, fetchSet } from "@/lib/data"
import { useCollection } from "@/lib/collection.tsx"
import { useAuth } from "@/context/auth"
import { cn } from "@/lib/utils"
import type { Card, Lang, SetMeta } from "@/types/card"

// ---------------------------------------------------------------------------
// Search params

type CollectionSearch = {
  set?: string
  lang: Lang
  view: "sets" | "overview"
  hideUnowned: boolean
}

function validateSearch(search: Record<string, unknown>): CollectionSearch {
  const lang = (["en", "fr", "jp"] as const).includes(search.lang as Lang)
    ? (search.lang as Lang)
    : "en"
  return {
    set: typeof search.set === "string" ? search.set : undefined,
    lang,
    view: search.view === "overview" ? "overview" : "sets",
    hideUnowned: search.hideUnowned === true || search.hideUnowned === "true",
  }
}

// ---------------------------------------------------------------------------

export const Route = createFileRoute("/collection/")({
  validateSearch,
  loaderDeps: ({ search }) => ({ set: search.set, lang: search.lang }),
  loader: async ({ deps: { set, lang } }) => {
    const index = await fetchIndex()
    const cards = set ? await fetchSet(set, lang) : null
    return { index, cards }
  },
  component: CollectionPage,
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

function CollectionPage() {
  const { index, cards } = Route.useLoaderData()
  const { set, lang, view, hideUnowned } = Route.useSearch()
  const navigate = useNavigate({ from: "/collection/" })
  const { user } = useAuth()
  const { owned, isOwned } = useCollection()
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null)
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [set])

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
      if (!isOwned(cardId)) await toggle(cardId)
    }
    setSelectedIds(new Set())
    setSelectMode(false)
  }

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
        set: keepSet ? prev.set : undefined,
      }),
    })
  }

  const setsForLang = index.sets
    .filter((s) => s.langs?.includes(lang))
    .sort((a, b) => a.id.slice(0, 4).localeCompare(b.id.slice(0, 4)))

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium">Connecte-toi pour accéder à ta collection</p>
        <p className="text-xs text-muted-foreground">La collection est synchronisée avec ton compte Discord</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Ma collection</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{owned.size} cartes possédées</p>
        </div>

        {/* View toggle */}
        <div className="flex h-9 overflow-hidden rounded-md border border-border">
          <button
            onClick={() => navigate({ search: (prev) => ({ ...prev, view: "sets" }) })}
            className={cn(
              "flex items-center gap-1.5 px-3 text-sm font-medium transition-colors cursor-pointer",
              view === "sets" ? "bg-amber-400 text-black" : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" />
            Vue sets
          </button>
          <button
            onClick={() => navigate({ search: (prev) => ({ ...prev, view: "overview" }) })}
            className={cn(
              "flex items-center gap-1.5 px-3 text-sm font-medium transition-colors cursor-pointer",
              view === "overview" ? "bg-amber-400 text-black" : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-3.5" />
            Vue globale
          </button>
        </div>
      </div>

      {view === "overview" ? (
        <OverviewView sets={setsForLang} lang={lang} onSelectSet={(id) => {
          navigate({ search: (prev) => ({ ...prev, set: id, view: "sets" }) })
        }} />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Série</label>
              <select
                value={set ?? ""}
                onChange={(e) => handleSetChange(e.target.value)}
                className="h-9 w-72 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Choisir une série —</option>
                {setsForLang.map((s) => (
                  <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Langue</label>
              <div className="flex h-9 overflow-hidden rounded-md border border-border">
                {LANG_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleLangChange(value)}
                    className={cn(
                      "px-4 text-sm font-medium transition-colors hover:text-foreground cursor-pointer",
                      lang === value ? "bg-amber-400 text-black" : "bg-background text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {cards && (
              <>
                <button
                  onClick={() => navigate({ search: (prev) => ({ ...prev, hideUnowned: !hideUnowned }) })}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                    hideUnowned
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {hideUnowned ? "Afficher toutes les cartes" : "Masquer les non-possédées"}
                </button>
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
              </>
            )}
          </div>

          {/* Cards grid */}
          {!set ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Choisis une série pour voir ta collection</p>
          ) : !cards ? null : (
            <SetView
              cards={cards}
              lang={lang}
              hideUnowned={hideUnowned}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onCardClick={setSelectedCard}
              onToggleSelect={handleToggleSelect}
            />
          )}
        </>
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

      <CardModal card={selectedCard} lang={lang} onClose={() => setSelectedCard(null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function OverviewView({ sets, lang, onSelectSet }: { sets: SetMeta[]; lang: Lang; onSelectSet: (id: string) => void }) {
  const { owned } = useCollection()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sets.map((s) => {
        // Count owned cards for this set (card IDs start with the set ID)
        const prefix = s.id + "-"
        const ownedInSet = Array.from(owned).filter((id) => id.startsWith(prefix)).length
        const total = s.card_count
        const pct = total > 0 ? Math.round((ownedInSet / total) * 100) : 0

        return (
          <button
            key={s.id}
            onClick={() => onSelectSet(s.id)}
            className="group cursor-pointer rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:border-amber-400/30 hover:bg-amber-400/5"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-amber-400">{s.id}</p>
                <p className="mt-0.5 text-sm font-medium leading-tight">{s.name}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">
                {ownedInSet}<span className="font-normal text-muted-foreground/60">/{total}</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{pct}%</p>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function SetView({
  cards,
  lang,
  hideUnowned,
  selectMode,
  selectedIds,
  onCardClick,
  onToggleSelect,
}: {
  cards: Card[]
  lang: Lang
  hideUnowned: boolean
  selectMode: boolean
  selectedIds: Set<string>
  onCardClick: (card: Card) => void
  onToggleSelect: (cardId: string) => void
}) {
  const { isOwned } = useCollection()
  const displayed = hideUnowned
    ? cards.filter((c) => [c.id, ...c.variants.map((v) => v.id)].some(isOwned))
    : cards

  if (displayed.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Aucune carte possédée dans cette série
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
      {displayed.map((card) => (
        <CollectionCardTile
          key={card.id}
          card={card}
          lang={lang}
          selectMode={selectMode}
          isSelected={selectedIds.has(card.id)}
          onClick={() => onCardClick(card)}
          onToggleSelect={() => onToggleSelect(card.id)}
        />
      ))}
    </div>
  )
}

function CollectionCardTile({
  card,
  lang,
  selectMode,
  isSelected,
  onClick,
  onToggleSelect,
}: {
  card: Card
  lang: Lang
  selectMode: boolean
  isSelected: boolean
  onClick: () => void
  onToggleSelect: () => void
}) {
  const rarityClass = RARITY_BADGE[card.rarity] ?? RARITY_BADGE.Common
  const { isOwned, toggle } = useCollection()

  const ownedIds = [card.id, ...card.variants.map((v) => v.id)]
  const ownedCount = ownedIds.filter(isOwned).length
  const isAnyOwned = ownedCount > 0
  const isBaseOwned = isOwned(card.id)
  const hasVariants = card.variants.length > 0

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation()
    if (hasVariants) onClick()
    else toggle(card.id)
  }

  function handleClick() {
    if (selectMode) onToggleSelect()
    else onClick()
  }

  return (
    <div className="group flex cursor-pointer flex-col gap-1.5" onClick={handleClick}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border aspect-[63/88] transition-all group-hover:-translate-y-0.5",
          isSelected
            ? "border-amber-400 ring-2 ring-amber-400/30 bg-muted"
            : isAnyOwned
              ? "border-amber-400/30 bg-muted group-hover:border-amber-400/60 group-hover:shadow-lg group-hover:shadow-amber-400/10"
              : "border-border/30 bg-muted group-hover:border-border/60"
        )}
      >
        <img
          src={cardImageUrl(card.id, lang)}
          alt={card.name}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-all",
            !isAnyOwned && "opacity-30 grayscale group-hover:opacity-60 group-hover:grayscale-0"
          )}
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
        {card.variants.length > 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            +{card.variants.length}
          </span>
        )}

        {/* Owned badge / select checkbox */}
        {selectMode ? (
          <div className={cn("absolute left-1 top-1 rounded p-0.5", isSelected ? "text-amber-400" : "text-white/70")}>
            {isSelected ? <CheckSquare className="size-4 drop-shadow" /> : <Square className="size-4 drop-shadow" />}
          </div>
        ) : isAnyOwned ? (
          <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-black">
            {ownedCount > 1 ? `${ownedCount}×` : "✓"}
          </span>
        ) : null}

        {/* Quick add button */}
        {!selectMode && (
          <button
            onClick={handleQuickAdd}
            className={cn(
              "absolute bottom-1 left-1 cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm transition-all",
              "opacity-0 group-hover:opacity-100",
              isBaseOwned && !hasVariants
                ? "bg-amber-400/90 text-black"
                : "bg-black/70 text-white hover:bg-amber-400/90 hover:text-black"
            )}
          >
            {hasVariants ? "···" : isBaseOwned ? "✓" : "+"}
          </button>
        )}
      </div>

      <div className="flex items-start justify-between gap-1 px-0.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-tight">{card.name}</p>
          <p className="text-[10px] text-muted-foreground">{card.id}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${rarityClass}`}>
            {RARITY_SHORT[card.rarity] ?? card.rarity}
          </span>
          <div className="flex gap-0.5">
            {card.colors.map((color) => (
              <span key={color} className={`size-2 rounded-full ${COLOR_DOT[color] ?? "bg-muted"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
