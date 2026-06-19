"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { useState, type FormEvent, type ReactNode } from "react";
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
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  LogOut,
  Pencil,
  UserRound,
  WifiOff,
} from "lucide-react";
import { useConvexAuth } from "convex/react";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";
import { authClient } from "~/lib/auth-client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

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

  function updateHorizon(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.min(50, Math.max(5, Math.round(value)));
    setAnalysisHorizonYears(next);
  }

  return (
    <nav className="mb-3 text-sm">
      <div className="space-y-3 border-b border-neutral-300 pb-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <PrimaryNavigation isLiquiditySection={isLiquiditySection} />
          </div>
          <AuthStatus />
        </div>
        <ContextNavigation
          isLiquiditySection={isLiquiditySection}
          pathname={pathname}
        />
        <CalculationStatus
          includeRefinancing={includeRefinancing}
          analysisHorizonYears={analysisHorizonYears}
          setIncludeRefinancing={setIncludeRefinancing}
          updateHorizon={updateHorizon}
        />
      </div>

      <div className="hidden lg:block">
        <div className="flex items-center gap-8 border-b border-neutral-200">
          <Link
            href="/"
            className="shrink-0 pb-3 text-lg font-semibold text-black"
          >
            Zinsrechner
          </Link>
          <div className="flex items-center gap-6">
            <DesktopNavigationGroup>
              <DesktopMenuLink
                href="/"
                active={pathname === "/"}
                activeClass="border-blue-600 text-blue-800"
              >
                Konditionen
              </DesktopMenuLink>
              <DesktopMenuLink
                href="/finanzplan"
                active={pathname === "/finanzplan"}
                activeClass="border-blue-600 text-blue-800"
              >
                Finanzplan
              </DesktopMenuLink>
            </DesktopNavigationGroup>
            <DesktopNavigationGroup>
              <DesktopMenuLink
                href="/liquiditaetsplan"
                active={pathname === "/liquiditaetsplan"}
                activeClass="border-emerald-600 text-emerald-800"
              >
                Eingaben
              </DesktopMenuLink>
              <DesktopMenuLink
                href="/liquiditaetsauswertung"
                active={pathname === "/liquiditaetsauswertung"}
                activeClass="border-emerald-600 text-emerald-800"
              >
                Auswertung
              </DesktopMenuLink>
            </DesktopNavigationGroup>
          </div>
          <div className="ml-auto flex items-center gap-3 pb-3">
            <CalculationStatus
              includeRefinancing={includeRefinancing}
              analysisHorizonYears={analysisHorizonYears}
              setIncludeRefinancing={setIncludeRefinancing}
              updateHorizon={updateHorizon}
              desktop
            />
            <AuthStatus />
          </div>
        </div>
      </div>
    </nav>
  );
}

function AuthStatus() {
  const session = authClient.useSession();
  const sessionData = session.data;
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } =
    useConvexAuth();

  if (session.isPending) return null;

  if (!sessionData || sessionData.user.isAnonymous) {
    return (
      <AuthDialog>
        <Button type="button" size="sm" variant="outline" className="shrink-0">
          Anmelden
        </Button>
      </AuthDialog>
    );
  }

  return (
    <UserProfileMenu
      user={sessionData.user}
      isConvexAuthenticated={isConvexAuthenticated}
      isConvexLoading={isConvexLoading}
    />
  );
}

function UserProfileMenu({
  user,
  isConvexAuthenticated,
  isConvexLoading,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  isConvexAuthenticated: boolean;
  isConvexLoading: boolean;
}) {
  const trimmedName = user.name?.trim();
  const displayName =
    trimmedName !== undefined && trimmedName.length > 0
      ? trimmedName
      : (user.email ?? "Angemeldet");
  const email = user.email ?? "";
  const syncLabel = isConvexLoading
    ? "Verbindung wird hergestellt"
    : isConvexAuthenticated
      ? "Daten sind synchronisiert"
      : "Synchronisierung nicht verbunden";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 rounded-full border-neutral-300 px-2 pr-3"
        >
          <UserAvatar name={displayName} image={user.image} />
          <span className="hidden max-w-36 truncate text-sm font-medium text-neutral-800 sm:inline">
            {displayName}
          </span>
          <ChevronDown className="size-4 text-neutral-500" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 border-neutral-200 bg-white p-0 text-black shadow-xl"
      >
        <div className="border-b border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={displayName} image={user.image} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              {email && (
                <p className="truncate text-xs text-neutral-500">{email}</p>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-1 p-2">
          <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-700">
            {isConvexLoading ? (
              <Loader2
                className="size-4 animate-spin text-neutral-500"
                aria-hidden="true"
              />
            ) : isConvexAuthenticated ? (
              <CheckCircle2
                className="size-4 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <WifiOff className="size-4 text-amber-600" aria-hidden="true" />
            )}
            <span>{syncLabel}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start px-2 text-neutral-700 hover:bg-neutral-100 hover:text-black"
            onClick={() => void authClient.signOut()}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Abmelden
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserAvatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image?: string | null;
  size?: "sm" | "lg";
}) {
  const initials = getInitials(name);
  const sizeClass = size === "lg" ? "size-11 text-base" : "size-7 text-xs";

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-flex items-center justify-center rounded-full bg-neutral-900 font-semibold text-white`}
      aria-hidden="true"
    >
      {initials || <UserRound className="size-4" />}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function AuthDialog({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "signup" && password !== passwordConfirmation) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setPending(true);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: email,
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
      setEmail("");
      setPassword("");
      setPasswordConfirmation("");
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
          {mode === "signup" && (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Passwort bestätigen</span>
              <Input
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError("");
                setMode(mode === "signin" ? "signup" : "signin");
                setPassword("");
                setPasswordConfirmation("");
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

function PrimaryNavigation({
  isLiquiditySection,
}: {
  isLiquiditySection: boolean;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1">
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
  );
}

function ContextNavigation({
  isLiquiditySection,
  pathname,
  desktop = false,
}: {
  isLiquiditySection: boolean;
  pathname: string;
  desktop?: boolean;
}) {
  return (
    <div className={desktop ? "flex items-center" : "grid grid-cols-2 gap-1"}>
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
  );
}

function DesktopNavigationGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-end">{children}</div>;
}

function DesktopMenuLink({
  href,
  active,
  activeClass,
  children,
}: {
  href: string;
  active: boolean;
  activeClass: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`border-b-2 px-3 pt-1 pb-3 font-medium transition-colors ${
        active
          ? activeClass
          : "border-transparent text-neutral-600 hover:text-black"
      }`}
    >
      {children}
    </Link>
  );
}

function CalculationStatus({
  includeRefinancing,
  analysisHorizonYears,
  setIncludeRefinancing,
  updateHorizon,
  desktop = false,
}: {
  includeRefinancing: boolean;
  analysisHorizonYears: number;
  setIncludeRefinancing: (value: boolean) => void;
  updateHorizon: (value: number) => void;
  desktop?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 ${
        desktop ? "border border-neutral-200" : ""
      }`}
    >
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
            Lege fest, wie Restschulden nach dem Ende der Zinsbindung behandelt
            werden.
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
                      Danach verbleibende Schulden werden als fällig angezeigt.
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
                      Verbleibende Schulden werden mit den aktuellen Konditionen
                      weiterberechnet.
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
  children: ReactNode;
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
