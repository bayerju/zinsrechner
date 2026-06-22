"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
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
  FolderKanban,
  Loader2,
  LogOut,
  Settings,
  UserRound,
  WifiOff,
} from "lucide-react";
import { useConvexAuth } from "convex/react";
import { useAppState } from "~/state/app_state";
import { authClient } from "~/lib/auth-client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export function TopNav() {
  const pathname = usePathname();
  const shareBase = getShareBase(pathname);
  const isLiquiditySection =
    pathname === "/liquiditaetsplan" ||
    pathname === "/liquiditaetsauswertung" ||
    pathname.endsWith("/liquiditaetsplan") ||
    pathname.endsWith("/liquiditaetsauswertung");

  return (
    <nav className="mb-3 text-sm">
      <div className="space-y-3 border-b border-neutral-300 pb-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <PrimaryNavigation
              isLiquiditySection={isLiquiditySection}
              shareBase={shareBase}
            />
          </div>
          <AuthStatus />
        </div>
        <ContextNavigation
          isLiquiditySection={isLiquiditySection}
          pathname={pathname}
          shareBase={shareBase}
        />
      </div>

      <div className="hidden lg:block">
        <div className="flex items-center gap-8 border-b border-neutral-200">
          <Link
            href={shareHref(shareBase, "/")}
            className="shrink-0 pb-3 text-lg font-semibold text-black"
          >
            Zinsrechner
          </Link>
          <div className="flex items-center gap-6">
            <DesktopNavigationGroup>
              <DesktopMenuLink
                href="/"
                active={isActivePath(pathname, shareBase, "/")}
                activeClass="border-blue-600 text-blue-800"
                shareBase={shareBase}
              >
                Konditionen
              </DesktopMenuLink>
              <DesktopMenuLink
                href="/finanzplan"
                active={isActivePath(pathname, shareBase, "/finanzplan")}
                activeClass="border-blue-600 text-blue-800"
                shareBase={shareBase}
              >
                Finanzplan
              </DesktopMenuLink>
            </DesktopNavigationGroup>
            <DesktopNavigationGroup>
              <DesktopMenuLink
                href="/liquiditaetsplan"
                active={isActivePath(pathname, shareBase, "/liquiditaetsplan")}
                activeClass="border-emerald-600 text-emerald-800"
                shareBase={shareBase}
              >
                Eingaben
              </DesktopMenuLink>
              <DesktopMenuLink
                href="/liquiditaetsauswertung"
                active={isActivePath(
                  pathname,
                  shareBase,
                  "/liquiditaetsauswertung",
                )}
                activeClass="border-emerald-600 text-emerald-800"
                shareBase={shareBase}
              >
                Auswertung
              </DesktopMenuLink>
            </DesktopNavigationGroup>
          </div>
          <div className="ml-auto flex items-center gap-3 pb-3">
            <AuthStatus />
          </div>
        </div>
      </div>
    </nav>
  );
}

function getShareBase(pathname: string) {
  const match = /^\/projekt\/share\/[^/]+/.exec(pathname);
  return match?.[0] ?? null;
}

function shareHref(shareBase: string | null, href: string) {
  if (!shareBase) return href;
  if (href === "/") return `${shareBase}/konditionen`;
  return `${shareBase}${href}`;
}

function isActivePath(
  pathname: string,
  shareBase: string | null,
  href: string,
) {
  return pathname === shareHref(shareBase, href);
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
  const [open, setOpen] = useState(false);
  const { projectList, activeProjectId, setActiveProjectId } = useAppState();
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
  const recentProjects = [...projectList]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  async function selectProject(projectId: string) {
    setOpen(false);
    if (projectId !== activeProjectId) {
      await setActiveProjectId(projectId);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        </div>
        <div className="border-t border-neutral-200 p-2">
          <p className="px-2 pb-1 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Projekte
          </p>
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {recentProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-neutral-100 font-medium text-black"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-black"
                  }`}
                  onClick={() => void selectProject(project.id)}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: isActive ? "#059669" : "#d4d4d4",
                    }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {project.name}
                  </span>
                  {isActive && (
                    <CheckCircle2
                      className="size-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
            {recentProjects.length === 0 && (
              <p className="px-2 py-2 text-xs text-neutral-500">
                Keine Projekte vorhanden.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="mt-1 h-9 w-full justify-start px-2 text-neutral-700 hover:bg-neutral-100 hover:text-black"
            asChild
          >
            <Link href="/projekte">
              <FolderKanban className="size-4" aria-hidden="true" />
              Alle anzeigen
            </Link>
          </Button>
        </div>
        <div className="border-t border-neutral-200 p-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start px-2 text-neutral-700 hover:bg-neutral-100 hover:text-black"
            asChild
          >
            <Link href="/einstellungen">
              <Settings className="size-4" aria-hidden="true" />
              Einstellungen
            </Link>
          </Button>
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
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
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
  shareBase,
}: {
  isLiquiditySection: boolean;
  shareBase: string | null;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1">
      <Link
        href={shareHref(shareBase, "/")}
        className={`rounded-md px-3 py-2 text-center font-medium transition-colors ${
          !isLiquiditySection
            ? "bg-white text-black shadow-sm"
            : "text-neutral-600 hover:text-black"
        }`}
      >
        Finanzierung
      </Link>
      <Link
        href={shareHref(shareBase, "/liquiditaetsplan")}
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
  shareBase,
  desktop = false,
}: {
  isLiquiditySection: boolean;
  pathname: string;
  shareBase: string | null;
  desktop?: boolean;
}) {
  return (
    <div className={desktop ? "flex items-center" : "grid grid-cols-2 gap-1"}>
      {isLiquiditySection ? (
        <>
          <SubNavigationLink
            href="/liquiditaetsplan"
            active={isActivePath(pathname, shareBase, "/liquiditaetsplan")}
            shareBase={shareBase}
          >
            Eingaben
          </SubNavigationLink>
          <SubNavigationLink
            href="/liquiditaetsauswertung"
            active={isActivePath(
              pathname,
              shareBase,
              "/liquiditaetsauswertung",
            )}
            shareBase={shareBase}
          >
            Auswertung
          </SubNavigationLink>
        </>
      ) : (
        <>
          <SubNavigationLink
            href="/"
            active={isActivePath(pathname, shareBase, "/")}
            shareBase={shareBase}
          >
            Konditionen
          </SubNavigationLink>
          <SubNavigationLink
            href="/finanzplan"
            active={isActivePath(pathname, shareBase, "/finanzplan")}
            shareBase={shareBase}
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
  shareBase,
  children,
}: {
  href: string;
  active: boolean;
  activeClass: string;
  shareBase: string | null;
  children: ReactNode;
}) {
  return (
    <Link
      href={shareHref(shareBase, href)}
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

function SubNavigationLink({
  href,
  active,
  shareBase,
  children,
}: {
  href: string;
  active: boolean;
  shareBase: string | null;
  children: ReactNode;
}) {
  return (
    <Link
      href={shareHref(shareBase, href)}
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
