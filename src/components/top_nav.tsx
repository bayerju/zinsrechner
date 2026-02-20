"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-3 flex items-center gap-4 border-b border-neutral-300 pb-2 text-sm">
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
    </nav>
  );
}
