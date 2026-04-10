import * as React from "react"
import { Dialog } from "radix-ui"
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react"

import { cardImageUrl } from "@/lib/data"
import { useCollection } from "@/lib/collection.tsx"
import { useAuth } from "@/context/auth"
import type { Card, Lang } from "@/types/card"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------

type CardModalProps = {
  card: Card | null
  lang?: Lang
  initialVersionIndex?: number
  onClose: () => void
}

const COLOR_CLASS: Record<string, string> = {
  Red: "bg-red-500/15 text-red-400 border-red-500/20",
  Green: "bg-green-500/15 text-green-400 border-green-500/20",
  Blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Black: "bg-slate-500/15 text-slate-300 border-slate-500/20",
  Yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
}

const RARITY_CLASS: Record<string, string> = {
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

function getVersions(card: Card) {
  return [
    { id: card.id, label: "Base", setLabel: undefined as string | undefined },
    ...card.variants.map((v, i) => ({
      id: v.id,
      label: v.set_id !== undefined ? `Para` : `Variante ${i + 1}`,
      setLabel: v.set_id !== undefined ? (v.set_label ?? "PROMO") : undefined,
    })),
  ]
}

// ---------------------------------------------------------------------------

export function CardModal({ card, lang = "en", initialVersionIndex = 0, onClose }: CardModalProps) {
  const [versionIndex, setVersionIndex] = React.useState(initialVersionIndex)
  const [zoomed, setZoomed] = React.useState(false)
  const { user } = useAuth()
  const { isOwned, toggle } = useCollection()

  React.useEffect(() => { setVersionIndex(initialVersionIndex); setZoomed(false) }, [card?.id, initialVersionIndex])

  const versions = card ? getVersions(card) : []
  const currentId = versions[versionIndex]?.id ?? card?.id

  return (
    <Dialog.Root open={!!card} onOpenChange={(open) => { if (!open) { if (zoomed) { setZoomed(false) } else { onClose() } } }}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn(
          "fixed inset-0 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          zoomed ? "bg-black/90" : "bg-black/70"
        )} />

        <Dialog.Content
          className={cn(
            "fixed z-50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            zoomed
              ? "inset-0 flex items-center justify-center"
              : "left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2"
          )}
        >
          {card && !zoomed && (
            <div className="relative mx-4 flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl md:flex-row">
              <Dialog.Close className="absolute right-3 top-3 z-10 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="size-4" />
              </Dialog.Close>

              {/* Left — card image + variant switcher */}
              <div className="flex flex-col items-center gap-4 bg-muted/30 p-6 md:w-72 md:shrink-0">
                <div className="group relative w-full max-w-[200px]">
                  <div
                    className="relative cursor-zoom-in overflow-hidden rounded-xl border border-border/30 aspect-[63/88] shadow-xl"
                    onClick={() => setZoomed(true)}
                  >
                    <img
                      src={cardImageUrl(currentId ?? card.id, lang)}
                      alt={card.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                      <Expand className="size-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                </div>

                {/* Variant switcher */}
                {versions.length > 1 && (
                  <VariantSwitcher
                    versions={versions}
                    versionIndex={versionIndex}
                    onChangeIndex={setVersionIndex}
                  />
                )}
              </div>

              {/* Right — card details */}
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded px-2 py-0.5 text-xs font-bold", RARITY_CLASS[card.rarity] ?? RARITY_CLASS.Common)}>
                      {card.rarity}
                    </span>
                    <span className="text-xs text-muted-foreground">{card.id}</span>
                  </div>
                  <Dialog.Title className="text-xl font-bold">{card.name}</Dialog.Title>
                  <p className="mt-0.5 text-sm text-muted-foreground">{card.category}</p>
                </div>

                {card.colors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {card.colors.map((color) => (
                      <span key={color} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", COLOR_CLASS[color] ?? "bg-muted text-muted-foreground")}>
                        {color}
                      </span>
                    ))}
                  </div>
                )}

                {user && (() => {
                  const currentVersion = versions[versionIndex]
                  const currentOwned = currentVersion ? isOwned(currentVersion.id, lang) : false
                  const otherVersions = versions.filter((_, i) => i !== versionIndex)
                  return (
                    <div className="flex flex-col gap-2">
                      {/* Primary toggle — for currently viewed version */}
                      {currentVersion && (
                        <button
                          onClick={() => toggle(currentVersion.id, lang)}
                          className={cn(
                            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                            currentOwned
                              ? "border-amber-400/50 bg-amber-400/15 text-amber-400 hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-400"
                              : "border-border bg-muted/50 text-muted-foreground hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-400"
                          )}
                        >
                          {currentOwned ? "✓ Dans ma collection" : "+ Ajouter à ma collection"}
                        </button>
                      )}
                      {/* Other versions — smaller pills */}
                      {otherVersions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {versions.map((v, i) => {
                            if (i === versionIndex) return null
                            const owned = isOwned(v.id, lang)
                            const label = i === 0 ? "Base" : (v.setLabel ? `${v.setLabel} — Para` : `Variante ${i}`)
                            return (
                              <button
                                key={v.id}
                                onClick={() => toggle(v.id, lang)}
                                className={cn(
                                  "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                                  owned
                                    ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                                )}
                              >
                                {label}{owned ? " ✓" : " +"}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Coût" value={card.cost} />
                  <Stat label="Power" value={card.power != null ? card.power.toLocaleString() : null} />
                  <Stat label="Counter" value={card.counter} />
                </div>

                {card.attributes.length > 0 && (
                  <InfoRow label="Attributs" value={card.attributes.join(", ")} />
                )}
                {card.types.length > 0 && (
                  <InfoRow label="Types" value={card.types.join(", ")} />
                )}

                {card.effect && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Effet</p>
                    <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{card.effect}</p>
                  </div>
                )}

                {card.trigger && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Trigger</p>
                    <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{card.trigger}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Zoomed view — inside Dialog.Content so Radix doesn't interfere */}
          {card && zoomed && (
            <>
              <Dialog.Title className="sr-only">{card.name}</Dialog.Title>

              <img
                src={cardImageUrl(currentId ?? card.id, lang)}
                alt={card.name}
                className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
              />

              {/* Close zoom */}
              <button
                className="absolute right-4 top-4 cursor-pointer rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                onClick={() => setZoomed(false)}
              >
                <X className="size-5" />
              </button>

              {/* Variant navigation */}
              {versions.length > 1 && (
                <>
                  <button
                    className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20",
                      versionIndex === 0 && "opacity-20"
                    )}
                    onClick={() => setVersionIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    className={cn(
                      "absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20",
                      versionIndex === versions.length - 1 && "opacity-20"
                    )}
                    onClick={() => setVersionIndex((i) => Math.min(versions.length - 1, i + 1))}
                  >
                    <ChevronRight className="size-6" />
                  </button>

                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                    <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
                      {versions[versionIndex].label} ({versionIndex + 1}/{versions.length})
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------

function VariantSwitcher({
  versions,
  versionIndex,
  onChangeIndex,
}: {
  versions: { id: string; label: string; setLabel?: string }[]
  versionIndex: number
  onChangeIndex: (i: number) => void
}) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap justify-center">
        {versions[versionIndex].setLabel && (
          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300 font-medium">
            {versions[versionIndex].setLabel}
          </span>
        )}
        {versions[versionIndex].label}
        <span className="text-muted-foreground/50">({versionIndex + 1}/{versions.length})</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChangeIndex(Math.max(0, versionIndex - 1))}
          disabled={versionIndex === 0}
          className="cursor-pointer rounded-md p-1 transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex gap-1.5">
          {versions.map((v, i) => (
            <button
              key={v.id}
              onClick={() => onChangeIndex(i)}
              className={cn(
                "size-2 cursor-pointer rounded-full transition-all",
                i === versionIndex
                  ? "bg-amber-400 scale-125"
                  : "bg-muted-foreground/40 hover:bg-muted-foreground"
              )}
            />
          ))}
        </div>
        <button
          onClick={() => onChangeIndex(Math.min(versions.length - 1, versionIndex + 1))}
          disabled={versionIndex === versions.length - 1}
          className="cursor-pointer rounded-md p-1 transition-colors hover:bg-accent disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value ?? "—"}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <p className="w-20 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
