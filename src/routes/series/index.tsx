import * as React from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Check, CheckSquare, X } from "lucide-react"
import GB from "country-flag-icons/react/3x2/GB"
import FR from "country-flag-icons/react/3x2/FR"
import JP from "country-flag-icons/react/3x2/JP"

import { CardModal } from "@/components/card-modal"
import { CardGrid } from "@/components/card-grid"
import { RarityFilter } from "@/components/card-grid/rarity-filter"
import { fetchIndex, fetchSet } from "@/lib/data"
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
  const tileCount = cards
    ? cards.reduce((n, c) => n + 1 + c.variants.filter((v) => v.set_id === undefined).length, 0)
    : (currentSet?.card_count ?? 0)

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
          {tileCount} cartes
        </p>
      )}

      {/* Rarity filter */}
      {cards && cards.length > 0 && (
        <RarityFilter cards={cards} active={rarityFilter} onChange={setRarityFilter} />
      )}

      {/* Content */}
      {!set ? (
        <EmptyState sets={setsForLang} onSelect={handleSetChange} />
      ) : !cards ? null : (
        <CardGrid
          cards={cards}
          lang={lang}
          cardFilter={cardFilter}
          rarityFilter={rarityFilter}
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
