"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { StorageTransfer } from "~/components/storage_transfer";
import { NumberInput } from "~/components/ui/number_input";
import { Switch } from "~/components/ui/switch";
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
          Anschlussfinanzierung
          <Switch
            checked={includeRefinancing}
            onCheckedChange={setIncludeRefinancing}
            className="data-[state=checked]:bg-neutral-700"
            thumbClasses="bg-white"
          />
        </label>
        <div className="inline-flex items-center gap-2 text-xs text-neutral-700">
          <span>Zeitraum</span>
          <div className="w-24">
            <NumberInput
              value={analysisHorizonYears}
              onChange={updateHorizon}
              unit="J"
              disabled={!includeRefinancing}
              className="h-8 border-neutral-300 bg-white text-right text-black disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
        <StorageTransfer />
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
