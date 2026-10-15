import Link from "next/link";
import { LogOut, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions";

// The bar at the top of every signed-in screen.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Wheat className="h-4 w-4" aria-hidden />
          </span>
          RPS1
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
