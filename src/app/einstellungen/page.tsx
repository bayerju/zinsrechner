"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { NumberInput } from "~/components/ui/number_input";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TopNav } from "~/components/top_nav";
import { useAppState } from "~/state/app_state";
import { api } from "../../../convex/_generated/api";
import { parseBackupJson } from "~/lib/backup_import";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";

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

export default function EinstellungenPage() {
  const {
    includeRefinancing,
    analysisHorizonYears,
    setSettings,
    activeProjectId,
  } = useAppState();
  const importLocalScenarios = useMutation(api.appState.importLocalScenarios);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  function updateHorizon(value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.min(50, Math.max(5, Math.round(value)));
    void setSettings({ analysisHorizonYears: next });
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportState({ status: "loading" });
    try {
      const content = await file.text();
      const parsed = parseBackupJson(content, activeProjectId);
      const result = await importLocalScenarios({
        financing: parsed.financing,
        liquidity: parsed.liquidity,
      });
      const financingCount = parsed.financing.length;
      const liquidityCount = parsed.liquidity.length;
      setImportState({
        status: "success",
        message: `${financingCount} Finanzierungsszenario(n) und ${liquidityCount} Liquiditätsszenario(n) ${result ? "importiert" : "bereits vorhanden"}.`,
      });
    } catch (error) {
      setImportState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Import fehlgeschlagen.",
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />

          <div className="space-y-3 pt-2">
            <h2 className="text-lg font-semibold text-black">Einstellungen</h2>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Berechnung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-neutral-600">
                  Lege fest, wie Restschulden nach dem Ende der Zinsbindung
                  behandelt werden.
                </p>

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
                      onClick={() =>
                        void setSettings({ includeRefinancing: false })
                      }
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
                      onClick={() =>
                        void setSettings({ includeRefinancing: true })
                      }
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

                <p className="text-xs text-neutral-500">
                  {includeRefinancing
                    ? `Berechnet über ${analysisHorizonYears} Jahre`
                    : "Berechnet bis Zinsbindung"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  JSON-Backup importieren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-neutral-600">
                  Lade eine JSON-Backup-Datei hoch, um Finanzierungs- und
                  Liquiditätsszenarien in das aktive Projekt zu importieren.
                  Bereits vorhandene Szenarien werden übersprungen.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                  id="json-backup-upload"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importState.status === "loading"}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {importState.status === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Datei auswählen
                  </Button>
                  {importState.status === "success" && (
                    <span className="flex items-center gap-1 text-sm text-emerald-700">
                      <CheckCircle2 className="size-4" />
                      {importState.message}
                    </span>
                  )}
                  {importState.status === "error" && (
                    <span className="text-sm text-red-600">
                      {importState.message}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button asChild variant="outline">
              <Link href="/">Zurück zum Rechner</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
