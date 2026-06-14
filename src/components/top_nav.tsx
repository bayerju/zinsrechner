"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { StorageTransfer } from "~/components/storage_transfer";
import { NumberInput } from "~/components/ui/number_input";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Pencil } from "lucide-react";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";

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
        <PrimaryNavigation isLiquiditySection={isLiquiditySection} />
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
          <div className="ml-auto pb-3">
            <CalculationStatus
              includeRefinancing={includeRefinancing}
              analysisHorizonYears={analysisHorizonYears}
              setIncludeRefinancing={setIncludeRefinancing}
              updateHorizon={updateHorizon}
              desktop
            />
          </div>
        </div>
      </div>
    </nav>
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

function DesktopNavigationGroup({ children }: { children: React.ReactNode }) {
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
  children: React.ReactNode;
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
