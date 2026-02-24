"use client";

import { useRef } from "react";
import { Button } from "~/components/ui/button";

const APP_STORAGE_KEYS = [
  "scenarios",
  "activeScenarioId",
  "scenarioValues",
  "comparedScenarioIds",
  "liquidityScenarios",
  "activeLiquidityScenarioId",
  "liquidityScenarioValues",
] as const;

type AppStorageKey = (typeof APP_STORAGE_KEYS)[number];

type ExportPayload = {
  version: 1;
  app: "zinsrechner";
  exportedAt: string;
  storage: Partial<Record<AppStorageKey, string>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidExportPayload(value: unknown): value is ExportPayload {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (value.app !== "zinsrechner") return false;
  if (typeof value.exportedAt !== "string") return false;
  if (!isRecord(value.storage)) return false;

  for (const [key, rawValue] of Object.entries(value.storage)) {
    if (!APP_STORAGE_KEYS.includes(key as AppStorageKey)) return false;
    if (typeof rawValue !== "string") return false;
  }

  return true;
}

function buildExportPayload(): ExportPayload {
  const storage: Partial<Record<AppStorageKey, string>> = {};

  for (const key of APP_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      storage[key] = value;
    }
  }

  return {
    version: 1,
    app: "zinsrechner",
    exportedAt: new Date().toISOString(),
    storage,
  };
}

export function StorageTransfer() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    try {
      const payload = buildExportPayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);

      anchor.href = url;
      anchor.download = `zinsrechner-export-${date}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export fehlgeschlagen.");
    }
  }

  function openImportDialog() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!isValidExportPayload(parsed)) {
        alert("Import fehlgeschlagen: ungueltiges Dateiformat.");
        return;
      }

      const confirmed = window.confirm(
        "Import ersetzt die aktuellen App-Daten im Browser. Fortfahren?",
      );
      if (!confirmed) return;

      for (const key of APP_STORAGE_KEYS) {
        const nextValue = parsed.storage[key];
        if (typeof nextValue === "string") {
          localStorage.setItem(key, nextValue);
        } else {
          localStorage.removeItem(key);
        }
      }

      window.location.reload();
    } catch {
      alert("Import fehlgeschlagen: Datei konnte nicht gelesen werden.");
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleExport}>
        Export JSON
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openImportDialog}
      >
        Import JSON
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          void handleImportFile(file);
        }}
      />
    </div>
  );
}
