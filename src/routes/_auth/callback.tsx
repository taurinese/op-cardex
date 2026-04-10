import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { supabase } from "@/lib/supabase"

export const Route = createFileRoute("/_auth/callback")({
  component: CallbackPage,
})

function CallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get("error_description") ?? params.get("error")
    if (urlError) {
      setError(decodeURIComponent(urlError))
      return
    }

    const code = params.get("code")

    if (code) {
      supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
        if (error) setError(error.message)
        else navigate({ to: "/" })
      })
      return
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message)
      else if (data.session) navigate({ to: "/" })
      else setError("Aucune session trouvée. Réessaie de te connecter.")
    })
  }, [navigate])

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-sm font-medium text-destructive">Erreur de connexion</p>
        <p className="max-w-md text-center text-xs text-muted-foreground">{error}</p>
        <button
          className="cursor-pointer text-xs text-amber-400 underline-offset-4 hover:underline"
          onClick={() => navigate({ to: "/" })}
        >
          Retourner à l'accueil
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Connexion en cours…</p>
    </div>
  )
}
