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
    <nav className="mb-3 flex flex-wrap items-center gap-4 border-b border-neutral-300 pb-2 text-sm">
      <Link
        href="/"
        className={
          pathname === "/" ? "font-medium text-black" : "text-neutral-600"
        }
      >
        Konditionen
      </Link>
      <Link
        href="/finanzplan"
        className={
          pathname === "/finanzplan"
            ? "font-medium text-black"
            : "text-neutral-600"
        }
      >
        Finanzplan
      </Link>
      <Link
        href="/liquiditaetsplan"
        className={
          pathname === "/liquiditaetsplan"
            ? "font-medium text-black"
            : "text-neutral-600"
        }
      >
        Liquiditaet Eingaben
      </Link>
      <Link
        href="/liquiditaetsauswertung"
        className={
          pathname === "/liquiditaetsauswertung"
            ? "font-medium text-black"
            : "text-neutral-600"
        }
      >
        Liquiditaet Auswertung
      </Link>
      <label className="ml-auto inline-flex items-center gap-2 text-xs text-neutral-700">
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
    </nav>
  );
}
