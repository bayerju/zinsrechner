"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { StorageTransfer } from "~/components/storage_transfer";
import { NumberInput } from "~/components/ui/number_input";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Settings } from "lucide-react";
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
    <nav className="mb-3 space-y-3 border-b border-neutral-300 pb-3 text-sm">
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
        <div className="min-w-0 text-xs whitespace-nowrap text-neutral-600">
          <span className="font-medium text-neutral-800">
            Anschluss: {includeRefinancing ? "an" : "aus"}
          </span>
          <span className="mx-1.5 text-neutral-300">·</span>
          <span>{analysisHorizonYears} Jahre</span>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 border-neutral-300 bg-white text-neutral-700"
              title="Einstellungen"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Einstellungen</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-neutral-300 bg-white text-black shadow-2xl sm:max-w-md">
            <DialogTitle>Einstellungen</DialogTitle>
            <DialogDescription className="text-neutral-600">
              Berechnungszeitraum und gespeicherte Daten verwalten.
            </DialogDescription>

            <div className="space-y-4">
              <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
                <h3 className="font-medium">Berechnung</h3>
                <label className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    <span className="block font-medium">
                      Anschlussfinanzierung
                    </span>
                    <span className="block text-xs text-neutral-500">
                      Restschulden nach der Zinsbindung weiterfinanzieren
                    </span>
                  </span>
                  <Switch
                    checked={includeRefinancing}
                    onCheckedChange={setIncludeRefinancing}
                    className="data-[state=checked]:bg-neutral-700"
                    thumbClasses="bg-white"
                  />
                </label>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Betrachtungszeitraum
                  </label>
                  <NumberInput
                    value={analysisHorizonYears}
                    onChange={updateHorizon}
                    unit="J"
                    disabled={!includeRefinancing}
                    className="h-9 border-neutral-300 bg-white text-right text-black disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
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
