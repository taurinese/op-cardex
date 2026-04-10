import { createFileRoute, Link } from "@tanstack/react-router"
import { Anchor, BookOpen, LayoutGrid } from "lucide-react"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Anchor className="size-6 text-amber-400" />
          <h1 className="text-2xl font-bold">OP Cardex</h1>
        </div>
        <p className="text-muted-foreground max-w-md">
          Un petit site pour browser les cartes du TCG One Piece et tracker sa collection.
          Fait entre potes, rien de compliqué.
        </p>
      </div>

      {/* Main links */}
      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <Link
          to="/series"
          search={{ lang: "en" }}
          className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-amber-400/30 hover:bg-amber-400/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <LayoutGrid className="size-5 text-amber-400" />
            <span className="font-medium">Parcourir les séries</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Tous les boosters et starters, en EN / FR / JP.
          </p>
        </Link>

        <Link
          to="/collection"
          search={{ lang: "en", view: "sets", hideUnowned: false }}
          className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-amber-400/30 hover:bg-amber-400/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="size-5 text-amber-400" />
            <span className="font-medium">Ma collection</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Marque les cartes que t'as, suis ta progression par set.
          </p>
        </Link>
      </div>

      {/* Small note */}
      <p className="mt-12 text-xs text-muted-foreground/50">
        Données issues de{" "}
        <a
          href="https://github.com/buhbbl/punk-records"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-muted-foreground"
        >
          punk-records
        </a>
        {" "}· Images © Bandai
      </p>
    </main>
  )
}
