"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { useState } from "react";
import { StorageTransfer } from "~/components/storage_transfer";
import { NumberInput } from "~/components/ui/number_input";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Pencil } from "lucide-react";
import { useConvexAuth } from "convex/react";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";
import { authClient } from "~/lib/auth-client";

export function TopNav() {
  const pathname = usePathname();
  const isLiquiditySection =
    pathname === "/liquiditaetsplan" || pathname === "/liquiditaetsauswertung";
  const [includeRefinancing, setIncludeRefinancing] = useAtom(
    includeRefinancingAtom,
  );
  const [analysisHorizonYears, setAnalysisHorizonYears] = useAtom(
    analysisHorizonYearsAtom,
  );
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data);
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } =
    useConvexAuth();

  function updateHorizon(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.min(50, Math.max(5, Math.round(value)));
    setAnalysisHorizonYears(next);
  }

  return (
    <nav className="mb-3 space-y-3 border-b border-neutral-300 pb-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 rounded-lg bg-neutral-100 p-1">
          <Link
            href="/"
            className={`rounded-md px-3 py-2 text-center font-medium transition-colors ${
              !isLiquiditySection
                ? "bg-white text-black shadow-sm"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            Finanzierung
          </Link>
          <Link
            href="/liquiditaetsplan"
            className={`rounded-md px-3 py-2 text-center font-medium transition-colors ${
              isLiquiditySection
                ? "bg-white text-black shadow-sm"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            Liquidität
          </Link>
        </div>
        {!session.isPending && !isSignedIn && (
          <AuthDialog>
            <Button type="button" size="sm" variant="outline">
              Anmelden
            </Button>
          </AuthDialog>
        )}
        {isSignedIn && (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {isConvexLoading
                ? "Verbinde..."
                : isConvexAuthenticated
                  ? "Synchronisiert"
                  : "Sync nicht verbunden"}
            </span>
            <span className="hidden max-w-40 truncate text-xs text-neutral-500 md:inline">
              {session.data?.user.email}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void authClient.signOut()}
            >
              Abmelden
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-neutral-200">
        {isLiquiditySection ? (
          <>
            <SubNavigationLink
              href="/liquiditaetsplan"
              active={pathname === "/liquiditaetsplan"}
            >
              Eingaben
            </SubNavigationLink>
            <SubNavigationLink
              href="/liquiditaetsauswertung"
              active={pathname === "/liquiditaetsauswertung"}
            >
              Auswertung
            </SubNavigationLink>
          </>
        ) : (
          <>
            <SubNavigationLink href="/" active={pathname === "/"}>
              Konditionen
            </SubNavigationLink>
            <SubNavigationLink
              href="/finanzplan"
              active={pathname === "/finanzplan"}
            >
              Finanzplan
            </SubNavigationLink>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2">
        <p className="min-w-0 text-xs font-medium text-neutral-700">
          {includeRefinancing
            ? `Berechnet über ${analysisHorizonYears} Jahre`
            : "Berechnet bis Zinsbindung"}
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 border-neutral-300 bg-white px-2.5 text-neutral-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              Ändern
            </Button>
          </DialogTrigger>
          <DialogContent className="border-neutral-300 bg-white text-black shadow-2xl sm:max-w-md">
            <DialogTitle>Berechnung anpassen</DialogTitle>
            <DialogDescription className="text-neutral-600">
              Lege fest, wie Restschulden nach dem Ende der Zinsbindung
              behandelt werden.
            </DialogDescription>

            <div className="space-y-4">
              <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
                <h3 className="font-medium">Berechnungsumfang</h3>
                <div className="space-y-2" role="radiogroup">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!includeRefinancing}
                    className={`flex w-full gap-3 rounded-lg border p-3 text-left transition-colors ${
                      !includeRefinancing
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    onClick={() => setIncludeRefinancing(false)}
                  >
                    <SelectionIndicator selected={!includeRefinancing} />
                    <span>
                      <span className="block text-sm font-medium">
                        Nur bis zum Ende der Zinsbindung
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        Danach verbleibende Schulden werden als fällig
                        angezeigt.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={includeRefinancing}
                    className={`flex w-full gap-3 rounded-lg border p-3 text-left transition-colors ${
                      includeRefinancing
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                    onClick={() => setIncludeRefinancing(true)}
                  >
                    <SelectionIndicator selected={includeRefinancing} />
                    <span>
                      <span className="block text-sm font-medium">
                        Mit Weiterfinanzierung
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        Verbleibende Schulden werden mit den aktuellen
                        Konditionen weiterberechnet.
                      </span>
                    </span>
                  </button>
                </div>
                {includeRefinancing && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Betrachtungszeitraum
                    </label>
                    <NumberInput
                      value={analysisHorizonYears}
                      onChange={updateHorizon}
                      unit="J"
                      className="h-9 border-neutral-300 bg-white text-right text-black"
                    />
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
                <div>
                  <h3 className="font-medium">Datensicherung</h3>
                  <p className="text-xs text-neutral-500">
                    Szenarien und Einstellungen als JSON-Datei sichern oder
                    wiederherstellen.
                  </p>
                </div>
                <StorageTransfer className="w-full" />
              </section>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}

function AuthDialog({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim() || email,
          email,
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Registrierung fehlgeschlagen.");
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Anmeldung fehlgeschlagen.");
          return;
        }
      }
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Authentifizierung fehlgeschlagen.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="border-neutral-300 bg-white text-black shadow-2xl sm:max-w-md">
        <DialogTitle>
          {mode === "signin" ? "Anmelden" : "Konto erstellen"}
        </DialogTitle>
        <DialogDescription className="text-neutral-600">
          {mode === "signin"
            ? "Melde dich an, um deine Szenarien über Convex zu synchronisieren."
            : "Erstelle ein Konto, um deine Szenarien geräteübergreifend zu speichern."}
        </DialogDescription>

        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">E-Mail</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Passwort</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              minLength={8}
              required
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError("");
                setMode(mode === "signin" ? "signup" : "signin");
              }}
            >
              {mode === "signin" ? "Registrieren" : "Zur Anmeldung"}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Bitte warten..."
                : mode === "signin"
                  ? "Anmelden"
                  : "Konto erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-neutral-900" : "border-neutral-400"
      }`}
    >
      {selected && <span className="h-2 w-2 rounded-full bg-neutral-900" />}
    </span>
  );
}

function SubNavigationLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`border-b-2 px-3 py-2 text-center font-medium transition-colors ${
        active
          ? "border-neutral-900 text-black"
          : "border-transparent text-neutral-500 hover:text-black"
      }`}
    >
      {children}
    </Link>
  );
}
