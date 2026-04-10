import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/auth"

type CollectionContextValue = {
  owned: Set<string>
  toggle: (cardId: string) => Promise<void>
  isOwned: (cardId: string) => boolean
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
      .select("card_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setOwned(new Set(data.map((r) => r.card_id)))
      })
  }, [user])

  async function toggle(cardId: string) {
    if (!user) return

    if (owned.has(cardId)) {
      setOwned((prev) => { const next = new Set(prev); next.delete(cardId); return next })
      await supabase.from("collection").delete().eq("user_id", user.id).eq("card_id", cardId)
    } else {
      setOwned((prev) => new Set(prev).add(cardId))
      await supabase.from("collection").insert({ user_id: user.id, card_id: cardId })
    }
  }

  function isOwned(cardId: string) {
    return owned.has(cardId)
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
