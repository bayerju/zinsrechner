"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useState, useEffect } from "react";

// import { LatestPost } from "~/app/_components/post";
// import { api, HydrateClient } from "~/trpc/server";

function parseNumber(str: string) {
  // Remove dots and replace comma with dot for German number format
  return Number(str.replace(/\./g, "").replace(",", "."));
}

function formatNumber(num: number) {
  // Format number as German currency (e.g. 123456.78 => 123.456,78)
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Home() {
  // Store raw values for editing
  const [kaufpreis, setKaufpreis] = useState("300000");
  const [modernisierungskosten, setModernisierungskosten] = useState("0");
  const [eigenkapital, setEigenkapital] = useState("0");
  const [kaufnebenkosten, setKaufnebenkosten] = useState("30000"); // default 12,07% of kaufpreis
  const [kaufnebenkostenManuell, setKaufnebenkostenManuell] = useState(false);
  const [kaufnebenkostenProzent, setKaufnebenkostenProzent] = useState("12,07");
  const [sollzinsbindung, setSollzinsbindung] = useState("10 Jahre");
  const [tilgungssatz, setTilgungssatz] = useState("2,00 %");
  const [sollzins, setSollzins] = useState("3,74");

  // Helper to parse German number string to number
  function parseGermanNumber(str: string) {
    return Number(str.replace(/\./g, "").replace(",", "."));
  }
  // Helper to format number as German string (for input fields)
  function formatGermanNumberInput(str: string) {
    // Remove all non-digit except comma and dot
    let cleaned = str.replace(/[^\d.,]/g, "");
    // Remove all dots (user might type them)
    cleaned = cleaned.replace(/\./g, "");
    // Only allow one comma
    const firstComma = cleaned.indexOf(",");
    if (firstComma !== -1) {
      // Keep only the first comma
      cleaned =
        cleaned.slice(0, firstComma + 1) +
        cleaned.slice(firstComma + 1).replace(/,/g, "");
    }
    // Remove leading zeros (except for '0' itself)
    cleaned = cleaned.replace(/^0+(?!$)/, "");
    // Add thousands separator (dot)
    const [intPart, decPart] = cleaned.split(",");
    const intWithDots =
      intPart && intPart.length > 0
        ? Number(intPart).toLocaleString("de-DE")
        : "";
    return decPart !== undefined ? `${intWithDots},${decPart}` : intWithDots;
  }

  // Helper to parse German percent string to number
  function parseGermanPercent(str: string) {
    return Number(str.replace(/%/g, "").replace(/\./g, "").replace(",", "."));
  }

  // Format default values on mount
  useEffect(() => {
    setKaufpreis(formatGermanNumberInput(kaufpreis));
    setModernisierungskosten(formatGermanNumberInput(modernisierungskosten));
    setEigenkapital(formatGermanNumberInput(eigenkapital));
    setKaufnebenkosten(formatGermanNumberInput(kaufnebenkosten));
    setKaufnebenkostenProzent(formatGermanNumberInput(kaufnebenkostenProzent));
    // eslint-disable-next-line
  }, []);

  // Dynamisch berechnen, falls nicht manuell überschrieben
  const kaufpreisNum = parseGermanNumber(kaufpreis);
  const modernisierungskostenNum = parseGermanNumber(modernisierungskosten);
  const eigenkapitalNum = parseGermanNumber(eigenkapital);
  const kaufnebenkostenProzentNum = parseGermanPercent(kaufnebenkostenProzent);
  const berechneteKaufnebenkosten = Math.round(
    kaufpreisNum * (kaufnebenkostenProzentNum / 100),
  );
  const kaufnebenkostenNum = parseGermanNumber(kaufnebenkosten);
  const kaufnebenkostenFinal = kaufnebenkostenManuell
    ? kaufnebenkostenNum
    : berechneteKaufnebenkosten;

  // Nettodarlehensbetrag Formel
  const nettodarlehensbetrag =
    kaufpreisNum +
    modernisierungskostenNum +
    kaufnebenkostenFinal -
    eigenkapitalNum;

  // Calculate monthly rate
  const sollzinsNum = parseGermanPercent(sollzins); // e.g. 5.04
  const tilgungssatzNum = parseGermanPercent(tilgungssatz); // e.g. 2.00
  const rate =
    nettodarlehensbetrag *
    (sollzinsNum / 100 / 12 + tilgungssatzNum / 100 / 12);

  // Parse years from Sollzinsbindung (e.g., "10 Jahre" -> 10)
  const years = parseInt(sollzinsbindung);
  // Calculate Restschuld after 'years' years
  const D = nettodarlehensbetrag;
  const r = sollzinsNum / 100 / 12;
  const n = years * 12;
  // Annuität (rate) is already calculated
  // Restschuld formula: D * (1 + r)^n - (rate / r) * ((1 + r)^n - 1)
  let restschuld = 0;
  if (r > 0) {
    restschuld = D * Math.pow(1 + r, n) - (rate / r) * (Math.pow(1 + r, n) - 1);
    restschuld = Math.max(0, restschuld); // No negative values
  }

  // Calculate when loan is fully paid off
  let vollständigeAbzahlungJahre = 0;
  let vollständigeAbzahlungMonate = 0;
  let kannAbgezahltWerden = true;

  if (r > 0 && rate > D * r) {
    // Loan can be fully paid off
    const nVollständig = Math.log(rate / (rate - D * r)) / Math.log(1 + r);
    vollständigeAbzahlungJahre = Math.floor(nVollständig / 12);
    vollständigeAbzahlungMonate = Math.ceil(nVollständig % 12);
  } else {
    // Loan cannot be fully paid off with current rate
    kannAbgezahltWerden = false;
  }

  // Handlers for formatted input fields
  function handleInputChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      // Remove all non-digit except comma and dot, but do not format yet
      const raw = e.target.value.replace(/[^\d.,]/g, "");
      setter(raw);
    };
  }
  function handleInputBlur(value: string, setter: (v: string) => void) {
    setter(formatGermanNumberInput(value));
  }
  function handlePercentInputBlur(value: string, setter: (v: string) => void) {
    // Always show two decimals for percent
    let formatted = formatGermanNumberInput(value);
    // If no comma, add ',00'
    if (formatted && !formatted.includes(",")) formatted += ",00";
    // If only one decimal, add one zero
    if (/,\d$/.exec(formatted)) formatted += "0";
    setter(formatted);
  }
  function handlePercentInputChange(
    setter: (v: string) => void,
    valueSetter?: (v: string) => void,
    refValue?: number,
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d.,]/g, "");
      setter(raw);
      // If valueSetter and refValue are provided, update the value field as well
      if (valueSetter && refValue !== undefined) {
        // Calculate value from percent
        const percentNum = parseGermanPercent(raw);
        const value = Math.round(refValue * (percentNum / 100));
        valueSetter(formatGermanNumberInput(value.toString()));
      }
    };
  }
  function handleValueInputChange(
    setter: (v: string) => void,
    percentSetter?: (v: string) => void,
    refValue?: number,
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d.,]/g, "");
      setter(raw);
      // If percentSetter and refValue are provided, update the percent field as well
      if (percentSetter && refValue && refValue > 0) {
        const valueNum = parseGermanNumber(raw);
        const percent = (valueNum / refValue) * 100;
        percentSetter(formatGermanNumberInput(percent.toFixed(2)));
      }
    };
  }
  // Handler for toggling manual mode for Kaufnebenkosten
  function handleKaufnebenkostenManuellChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const checked = e.target.checked;
    setKaufnebenkostenManuell(checked);
    if (checked) {
      // Set value to current calculated value when switching to manual
      setKaufnebenkosten(
        formatGermanNumberInput(berechneteKaufnebenkosten.toString()),
      );
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-neutral-900 py-2">
      {/* Ihre Kondition Card */}
      <Card className="mb-4 w-full max-w-xl">
        <CardHeader>
          <CardTitle>Ihre Kondition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-2">
            <span className="mb-2 text-4xl font-semibold text-green-300">
              {formatNumber(rate)} €
            </span>
            <span className="text-muted-foreground mb-6 text-base">
              Ihre monatliche Rate
            </span>
            <div className="my-2 w-full border-t border-neutral-700" />
            <div className="flex w-full justify-between py-2 text-sm">
              <span className="flex items-center gap-1">
                Nettodarlehensbetrag <span title="Info">ⓘ</span>
              </span>
              <span>{formatNumber(nettodarlehensbetrag)} €</span>
            </div>
            <div className="flex w-full justify-between py-2 text-sm">
              <span className="flex items-center gap-1">
                Gebundener Sollzins p.a. <span title="Info">ⓘ</span>
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-right text-white"
                  value={sollzins}
                  onChange={handleInputChange(setSollzins)}
                  onBlur={() => handlePercentInputBlur(sollzins, setSollzins)}
                  style={{ minWidth: 60 }}
                />
                %
              </span>
            </div>
            <div className="my-2 w-full border-t border-neutral-700" />
            {/* Restschuld nach x Jahren */}
            <div className="flex w-full justify-between py-2 text-sm">
              <span className="flex items-center gap-1">
                Restschuld nach {years} Jahren <span title="Info">ⓘ</span>
              </span>
              <span>{formatNumber(restschuld)} €</span>
            </div>
            <div className="flex w-full justify-between py-2 text-sm">
              <span className="flex items-center gap-1">
                Kredit vollständig abbezahlt nach{" "}
                {kannAbgezahltWerden
                  ? `${vollständigeAbzahlungJahre} Jahren, ${vollständigeAbzahlungMonate} Monaten`
                  : "nie (Rate zu niedrig)"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wie kommt Ihre Kondition zustande? Card */}
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span role="img" aria-label="settings">
              ⚙️
            </span>
            Wie kommt Ihre Kondition zustande?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-2">
            {/* Kaufpreis */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Kaufpreis <span title="Info">ⓘ</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={kaufpreis}
                onChange={handleInputChange(setKaufpreis)}
                onBlur={() => handleInputBlur(kaufpreis, setKaufpreis)}
              />
            </div>
            {/* Modernisierungskosten */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Modernisierungskosten{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>{" "}
                <span title="Info">ⓘ</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={modernisierungskosten}
                onChange={handleInputChange(setModernisierungskosten)}
                onBlur={() =>
                  handleInputBlur(
                    modernisierungskosten,
                    setModernisierungskosten,
                  )
                }
              />
            </div>
            {/* Kaufnebenkosten */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Kaufnebenkosten (Standard: 12,07% vom Kaufpreis)
                <input
                  type="checkbox"
                  className="ml-2 align-middle"
                  checked={kaufnebenkostenManuell}
                  onChange={handleKaufnebenkostenManuellChange}
                />
                <span className="text-muted-foreground ml-2 text-xs">
                  manuell eingeben
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={
                    kaufnebenkostenManuell
                      ? kaufnebenkosten
                      : formatGermanNumberInput(
                          berechneteKaufnebenkosten.toString(),
                        )
                  }
                  disabled={!kaufnebenkostenManuell}
                  onChange={handleValueInputChange(
                    setKaufnebenkosten,
                    setKaufnebenkostenProzent,
                    kaufpreisNum,
                  )}
                  onBlur={() =>
                    handleInputBlur(kaufnebenkosten, setKaufnebenkosten)
                  }
                />
                {kaufnebenkostenManuell && (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-right text-white"
                      value={kaufnebenkostenProzent}
                      onChange={handlePercentInputChange(
                        setKaufnebenkostenProzent,
                        setKaufnebenkosten,
                        kaufpreisNum,
                      )}
                      onBlur={() =>
                        handlePercentInputBlur(
                          kaufnebenkostenProzent,
                          setKaufnebenkostenProzent,
                        )
                      }
                      style={{ minWidth: 60 }}
                    />
                    <span className="text-white">%</span>
                  </>
                )}
              </div>
            </div>
            {/* Eigenkapital */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Eigenkapital <span title="Info">ⓘ</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={eigenkapital}
                onChange={handleInputChange(setEigenkapital)}
                onBlur={() => handleInputBlur(eigenkapital, setEigenkapital)}
              />
            </div>
            {/* Sollzinsbindung */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Sollzinsbindung <span title="Info">ⓘ</span>
              </label>
              <select
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={sollzinsbindung}
                onChange={(e) => setSollzinsbindung(e.target.value)}
              >
                <option>5 Jahre</option>
                <option>10 Jahre</option>
                <option>15 Jahre</option>
                <option>20 Jahre</option>
              </select>
            </div>
            {/* Tilgungssatz */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Tilgungssatz <span title="Info">ⓘ</span>
              </label>
              <select
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={tilgungssatz}
                onChange={(e) => setTilgungssatz(e.target.value)}
              >
                <option>1,00 %</option>
                <option>2,00 %</option>
                <option>3,00 %</option>
              </select>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
