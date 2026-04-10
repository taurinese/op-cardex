import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Check, CheckSquare, Download, LayoutGrid, List, Square, Upload, X } from "lucide-react"
import GB from "country-flag-icons/react/3x2/GB"
import FR from "country-flag-icons/react/3x2/FR"
import JP from "country-flag-icons/react/3x2/JP"

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
  ownFilter: "all" | "owned" | "unowned"
}

function validateSearch(search: Record<string, unknown>): CollectionSearch {
  const lang = (["en", "fr", "jp"] as const).includes(search.lang as Lang)
    ? (search.lang as Lang)
    : "en"
  const ownFilter = (["all", "owned", "unowned"] as const).includes(
    search.ownFilter as "all" | "owned" | "unowned"
  )
    ? (search.ownFilter as "all" | "owned" | "unowned")
    : "all"
  return {
    set: typeof search.set === "string" ? search.set : undefined,
    lang,
    view: search.view === "sets" ? "sets" : "overview",
    ownFilter,
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
  const { set, lang, view, ownFilter } = Route.useSearch()
  const navigate = useNavigate({ from: "/collection/" })
  const { user } = useAuth()
  const { owned, isOwned, toggle, exportCollection, bulkImport } = useCollection()
  const importRef = React.useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = React.useState<string | null>(null)

  function handleExport() {
    const data = exportCollection()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "op-cardex-collection.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error("Format invalide")
      const count = await bulkImport(data)
      setImportStatus(`${count} carte${count !== 1 ? "s" : ""} importée${count !== 1 ? "s" : ""}`)
    } catch {
      setImportStatus("Erreur : fichier invalide")
    }
    setTimeout(() => setImportStatus(null), 3000)
  }
  const [selectedCard, setSelectedCard] = React.useState<{
    card: Card
    versionIndex: number
  } | null>(null)
  const [cardFilter, setCardFilter] = React.useState<"all" | "base" | "alt">(
    "all"
  )
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [columns, setColumns] = React.useState(() =>
    Math.min(10, Math.max(3, parseInt(localStorage.getItem("collection-columns") ?? "4", 10)))
  )

  React.useEffect(() => {
    localStorage.setItem("collection-columns", String(columns))
  }, [columns])

  React.useEffect(() => {
    setCardFilter("all")
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
      if (!isOwned(cardId, lang)) await toggle(cardId, lang)
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
    .filter((s) =>
      Array.from(owned).some((k) => k.startsWith(`${lang}/${s.id}-`))
    )

  // Auto-select first set when entering vue sets with no set chosen
  React.useEffect(() => {
    if (view === "sets" && !set && setsForLang.length > 0) {
      navigate({ search: (prev) => ({ ...prev, set: setsForLang[0].id }) })
    }
  }, [view, set, setsForLang.length])

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium">
          Connecte-toi pour accéder à ta collection
        </p>
        <p className="text-xs text-muted-foreground">
          La collection est synchronisée avec ton compte Discord
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Ma collection</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {owned.size} cartes possédées
          </p>
        </div>

        {/* View toggle */}
        <div className="flex h-9 overflow-hidden rounded-md border border-border">
          <button
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, view: "sets" }) })
            }
            className={cn(
              "flex cursor-pointer items-center gap-1.5 px-3 text-sm font-medium transition-colors",
              view === "sets"
                ? "bg-amber-400 text-black"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" />
            Vue sets
          </button>
          <button
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, view: "overview" }) })
            }
            className={cn(
              "flex cursor-pointer items-center gap-1.5 px-3 text-sm font-medium transition-colors",
              view === "overview"
                ? "bg-amber-400 text-black"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-3.5" />
            Vue globale
          </button>
        </div>
      </div>

      {view === "overview" ? (
        <OverviewView
          sets={setsForLang}
          lang={lang}
          onSelectSet={(id) => {
            navigate({ search: (prev) => ({ ...prev, set: id, view: "sets" }) })
          }}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Série
              </label>
              <select
                value={set ?? ""}
                onChange={(e) => handleSetChange(e.target.value)}
                className="h-9 w-72 rounded-md border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              >
                <option value="">— Choisir une série —</option>
                {setsForLang.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Langue
              </label>
              <div className="flex h-9 overflow-hidden rounded-md border border-border">
                {LANG_OPTIONS.map(({ value }) => {
                  const Flag = LANG_FLAGS[value]
                  return (
                    <button
                      key={value}
                      onClick={() => handleLangChange(value)}
                      className={cn(
                        "cursor-pointer px-3 transition-colors",
                        lang === value ? "bg-amber-400/20 opacity-100" : "bg-background opacity-50"
                      )}
                    >
                      <Flag className="h-4 w-6 rounded-sm" />
                    </button>
                  )
                })}
              </div>
            </div>

            {cards && cards.some((c) => c.variants.length > 0) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Version
                </label>
                <div className="flex h-9 overflow-hidden rounded-md border border-border">
                  {(["all", "base", "alt"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setCardFilter(f)}
                      className={`cursor-pointer px-3 text-sm font-medium transition-colors hover:text-foreground ${
                        cardFilter === f
                          ? "bg-amber-400 text-black"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {f === "all" ? "Toutes" : f === "base" ? "Base" : "Parallèles"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cards && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Possession
                  </label>
                  <div className="flex h-9 overflow-hidden rounded-md border border-border">
                    {(["all", "owned", "unowned"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          navigate({ search: (prev) => ({ ...prev, ownFilter: f }) })
                        }
                        className={cn(
                          "cursor-pointer px-3 text-sm font-medium transition-colors hover:text-foreground",
                          ownFilter === f
                            ? "bg-amber-400 text-black"
                            : "bg-background text-muted-foreground"
                        )}
                      >
                        {f === "all" ? "Toutes" : f === "owned" ? "Possédées" : "Manquantes"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Colonnes
                  </label>
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
                <button
                  onClick={() => {
                    setSelectMode((v) => !v)
                    setSelectedIds(new Set())
                  }}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                    selectMode
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {selectMode ? (
                    <X className="size-3.5" />
                  ) : (
                    <CheckSquare className="size-3.5" />
                  )}
                  {selectMode ? "Annuler" : "Sélectionner"}
                </button>

                {/* Export / Import */}
                {user && <div className="flex flex-col gap-1.5">
                  <label className="invisible text-xs font-medium tracking-wider text-muted-foreground uppercase">.</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleExport}
                      disabled={owned.size === 0}
                      className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      title="Exporter ma collection"
                    >
                      <Download className="size-3.5" />
                      Export
                    </button>
                    <button
                      onClick={() => importRef.current?.click()}
                      className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      title="Importer une collection"
                    >
                      <Upload className="size-3.5" />
                      Import
                    </button>
                    <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                    {importStatus && (
                      <span className="text-xs text-muted-foreground">{importStatus}</span>
                    )}
                  </div>
                </div>}
              </>
            )}
          </div>

          {/* Cards grid */}
          {!set ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Choisis une série pour voir ta collection
            </p>
          ) : !cards ? null : (
            <SetView
              cards={cards}
              lang={lang}
              cardFilter={cardFilter}
              ownFilter={ownFilter}
              columns={columns}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onCardClick={(card, versionIndex) =>
                setSelectedCard({ card, versionIndex })
              }
              onToggleSelect={handleToggleSelect}
            />
          )}
        </>
      )}

      {/* Multi-select bottom bar */}
      {selectMode && (
        <div
          className={cn(
            "fixed right-0 bottom-0 left-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-md transition-all",
            selectedIds.size > 0 ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {selectedIds.size}
              </span>{" "}
              carte{selectedIds.size > 1 ? "s" : ""} sélectionnée
              {selectedIds.size > 1 ? "s" : ""}
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

function OverviewView({
  sets,
  lang,
  onSelectSet,
}: {
  sets: SetMeta[]
  lang: Lang
  onSelectSet: (id: string) => void
}) {
  const { owned } = useCollection()

  const setsWithCards = sets.filter((s) =>
    Array.from(owned).some((k) => k.startsWith(`${lang}/${s.id}-`))
  )

  if (setsWithCards.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Aucune carte dans ta collection pour l'instant.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {setsWithCards.map((s) => {
        // Count owned cards for this set in the current language
        const ownedInSet = Array.from(owned).filter((k) =>
          k.startsWith(`${lang}/${s.id}-`)
        ).length
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
                <p className="text-xs font-bold text-amber-400">{s.label}</p>
                <p className="mt-0.5 text-sm leading-tight font-medium">
                  {s.name}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">
                {ownedInSet}
                <span className="font-normal text-muted-foreground/60">
                  /{total}
                </span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
              {pct}%
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

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

function SetView({
  cards,
  lang,
  cardFilter,
  ownFilter,
  columns,
  selectMode,
  selectedIds,
  onCardClick,
  onToggleSelect,
}: {
  cards: Card[]
  lang: Lang
  ownFilter: "all" | "owned" | "unowned"
  columns: number
  selectMode: boolean
  selectedIds: Set<string>
  cardFilter: "all" | "base" | "alt"
  onCardClick: (card: Card, versionIndex: number) => void
  onToggleSelect: (cardId: string) => void
}) {
  const { isOwned } = useCollection()

  const items = cards
    .flatMap((card) => [
      { card, versionIndex: 0 },
      ...card.variants.map((_, i) => ({ card, versionIndex: i + 1 })),
    ])
    .filter(({ versionIndex }) =>
      cardFilter === "all"
        ? true
        : cardFilter === "base"
          ? versionIndex === 0
          : versionIndex > 0
    )

  const displayed = ownFilter === "all"
    ? items
    : items.filter(({ card, versionIndex }) => {
        const id = versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
        return ownFilter === "owned" ? isOwned(id, lang) : !isOwned(id, lang)
      })

  if (displayed.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {ownFilter === "owned"
          ? "Aucune carte possédée dans cette série"
          : ownFilter === "unowned"
            ? "Tu possèdes toutes les cartes de cette série"
            : "Aucune carte dans cette série"}
      </p>
    )
  }

  return (
    <div className={cn("grid gap-3", GRID_COLS[columns])}>
      {displayed.map(({ card, versionIndex }) => {
        const displayId =
          versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
        return (
          <CollectionCardTile
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

function CollectionCardTile({
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

  const displayId =
    versionIndex === 0 ? card.id : card.variants[versionIndex - 1].id
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
    <div
      className="group flex cursor-pointer flex-col gap-1.5"
      onClick={handleClick}
    >
      <div
        className={cn(
          "relative aspect-[63/88] overflow-hidden rounded-lg border transition-all group-hover:-translate-y-0.5",
          isSelected
            ? "border-amber-400 bg-muted ring-2 ring-amber-400/30"
            : owned
              ? "border-amber-400/30 bg-muted group-hover:border-amber-400/60 group-hover:shadow-lg group-hover:shadow-amber-400/10"
              : "border-border/30 bg-muted group-hover:border-border/60"
        )}
      >
        <img
          src={cardImageUrl(displayId, lang)}
          alt={card.name}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-all",
            !owned &&
              "opacity-30 grayscale group-hover:opacity-60 group-hover:grayscale-0"
          )}
          onError={(e) => {
            e.currentTarget.style.display = "none"
          }}
        />

        {/* Variant label */}
        {isVariant && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            para
          </span>
        )}

        {/* Owned badge / select checkbox */}
        {selectMode ? (
          <div
            className={cn(
              "absolute top-1 left-1 rounded p-0.5",
              isSelected ? "text-amber-400" : "text-white/70"
            )}
          >
            {isSelected ? (
              <CheckSquare className="size-4 drop-shadow" />
            ) : (
              <Square className="size-4 drop-shadow" />
            )}
          </div>
        ) : owned ? (
          <span className="absolute top-1 left-1 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-black">
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
              owned
                ? "bg-amber-400/90 text-black"
                : "bg-black/70 text-white hover:bg-amber-400/90 hover:text-black"
            )}
          >
            {owned ? "✓" : "+"}
          </button>
        )}
      </div>

      <div className="flex items-start justify-between gap-1 px-0.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] leading-tight font-medium">
            {card.name}
          </p>
          <p className="text-[10px] text-muted-foreground">{displayId}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded px-1 py-0.5 text-[9px] font-bold ${rarityClass}`}
          >
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
