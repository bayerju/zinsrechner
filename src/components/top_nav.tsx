"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { StorageTransfer } from "~/components/storage_transfer";
import { Switch } from "~/components/ui/switch";
import { includeRefinancingAtom } from "~/state/analysis_settings_atom";

export function TopNav() {
  const pathname = usePathname();
  const [includeRefinancing, setIncludeRefinancing] = useAtom(
    includeRefinancingAtom,
  );

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
      <StorageTransfer />
    </nav>
  );
}
