import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/auth"
import type { Lang } from "@/types/card"

// Internally stored as "lang/cardId" — e.g. "en/OP01-001"
function key(cardId: string, lang: Lang) {
  return `${lang}/${cardId}`
}

type CollectionContextValue = {
  owned: Set<string>
  toggle: (cardId: string, lang: Lang) => Promise<void>
  isOwned: (cardId: string, lang: Lang) => boolean
}

const CollectionContext = React.createContext<CollectionContextValue | null>(null)

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [owned, setOwned] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!user) {
      setOwned(new Set())
      return
    }

    supabase
      .from("collection")
      .select("card_id, lang")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setOwned(new Set(data.map((r) => key(r.card_id, r.lang))))
      })
  }, [user])

  async function toggle(cardId: string, lang: Lang) {
    if (!user) return
    const k = key(cardId, lang)

    if (owned.has(k)) {
      setOwned((prev) => { const next = new Set(prev); next.delete(k); return next })
      await supabase.from("collection").delete()
        .eq("user_id", user.id).eq("card_id", cardId).eq("lang", lang)
    } else {
      setOwned((prev) => new Set(prev).add(k))
      await supabase.from("collection").insert({ user_id: user.id, card_id: cardId, lang })
    }
  }

  function isOwned(cardId: string, lang: Lang) {
    return owned.has(key(cardId, lang))
  }

  return (
    <CollectionContext.Provider value={{ owned, toggle, isOwned }}>
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollection() {
  const ctx = React.useContext(CollectionContext)
  if (!ctx) throw new Error("useCollection must be used within CollectionProvider")
  return ctx
}
