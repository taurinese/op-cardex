import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { Anchor, BookOpen, LayoutGrid, LogIn, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth"
import { cn } from "@/lib/utils"

function NavLink({ to, search, children }: { to: string; search?: Record<string, unknown>; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      search={search as never}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        "[&.active]:bg-accent [&.active]:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}

function Navbar() {
  const { user, loading, signInWithDiscord, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Anchor className="size-5 text-amber-400" />
          <span className="text-sm tracking-wide">OP Cardex</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/series" search={{ lang: "en" }}>
            <LayoutGrid className="size-3.5" />
            Séries
          </NavLink>
          <NavLink to="/collection" search={{ lang: "en", view: "overview", hideUnowned: false }}>
            <BookOpen className="size-3.5" />
            Collection
          </NavLink>
        </nav>

        {!loading && (
          user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{user.user_metadata?.full_name ?? user.email}</span>
              <Button size="sm" variant="outline" className="gap-2 text-xs cursor-pointer" onClick={signOut}>
                <LogOut className="size-3.5" />
                Déconnexion
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-2 text-xs cursor-pointer" onClick={signInWithDiscord}>
              <LogIn className="size-3.5" />
              Connexion Discord
            </Button>
          )
        )}
      </div>
    </header>
  )
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-svh">
      <Navbar />
      <Outlet />
    </div>
  ),
})
