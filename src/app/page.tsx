"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useState, useEffect } from "react";
import {
  formatNumber,
  parseGermanNumber,
  parseGermanPercent,
  formatGermanNumberInput,
  calculateNettodarlehensbetrag,
  calculateMonthlyRate,
  calculateRestschuld,
  calculateFullPaymentTime,
  calculateTotalInterest,
  calculateAllRates,
  calculateTotalRatesByTimeframe,
} from "~/lib/calculations";
import { saveFormData, loadFormData, type FormData } from "~/lib/cookies";

// import { LatestPost } from "~/app/_components/post";
// import { api, HydrateClient } from "~/trpc/server";

// Default values
const DEFAULT_FORM_DATA: FormData = {
  kaufpreis: "300000",
  modernisierungskosten: "0",
  tilgungsfreierKredit: "0",
  tilgungsFreieZeit: "0",
  RückzahlungsfreieZeit: "0",
  elternkredit: "0",
  eigenkapital: "0",
  kaufnebenkosten: "30000",
  kaufnebenkostenManuell: false,
  kaufnebenkostenProzent: "12,07",
  sollzinsbindung: "10 Jahre",
  tilgungssatz: "2,00 %",
  sollzins: "3,74",
  überbrückungskredit: "0",
  laufZeitÜberbrückungskredit: "0",
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

  // Initialize state with default values (no cookie loading here)
  const [kaufpreis, setKaufpreis] = useState(DEFAULT_FORM_DATA.kaufpreis);
  const [modernisierungskosten, setModernisierungskosten] = useState(
    DEFAULT_FORM_DATA.modernisierungskosten,
  );
  const [tilgungsfreierKredit, setTilgungsfreierKredit] = useState(
    DEFAULT_FORM_DATA.tilgungsfreierKredit,
  );
  const [tilgungsFreieZeit, setTilgungsFreieZeit] = useState(
    DEFAULT_FORM_DATA.tilgungsFreieZeit,
  );

  const [eigenkapital, setEigenkapital] = useState(
    DEFAULT_FORM_DATA.eigenkapital,
  );
  const [kaufnebenkosten, setKaufnebenkosten] = useState(
    DEFAULT_FORM_DATA.kaufnebenkosten,
  );
  const [kaufnebenkostenManuell, setKaufnebenkostenManuell] = useState(
    DEFAULT_FORM_DATA.kaufnebenkostenManuell,
  );
  const [kaufnebenkostenProzent, setKaufnebenkostenProzent] = useState(
    DEFAULT_FORM_DATA.kaufnebenkostenProzent,
  );
  const [sollzinsbindung, setSollzinsbindung] = useState(
    DEFAULT_FORM_DATA.sollzinsbindung,
  );
  const [tilgungssatz, setTilgungssatz] = useState(
    DEFAULT_FORM_DATA.tilgungssatz,
  );
  const [sollzins, setSollzins] = useState(DEFAULT_FORM_DATA.sollzins);
  const [elternkredit, setElternkredit] = useState(
    DEFAULT_FORM_DATA.elternkredit,
  );
  const [RückzahlungsfreieZeit, setRückzahlungsfreieZeit] = useState(
    DEFAULT_FORM_DATA.RückzahlungsfreieZeit,
  );
  const [überbrückungskredit, setÜberbrückungskredit] = useState(
    DEFAULT_FORM_DATA.überbrückungskredit,
  );
  const [laufZeitÜberbrückungskredit, setLaufZeitÜberbrückungskredit] =
    useState(DEFAULT_FORM_DATA.laufZeitÜberbrückungskredit);
  // Load data from cookies on mount (client-side only)
  useEffect(() => {
    const savedData = loadFormData();
    if (savedData?.kaufpreis) {
      setKaufpreis(savedData.kaufpreis);
    } else {
      setKaufpreis(DEFAULT_FORM_DATA.kaufpreis);
    }
    if (savedData?.modernisierungskosten) {
      setModernisierungskosten(savedData.modernisierungskosten);
    } else {
      setModernisierungskosten(DEFAULT_FORM_DATA.modernisierungskosten);
    }
    if (savedData?.eigenkapital) {
      setEigenkapital(savedData.eigenkapital);
    } else {
      setEigenkapital(DEFAULT_FORM_DATA.eigenkapital);
    }
    if (savedData?.kaufnebenkosten) {
      setKaufnebenkosten(savedData.kaufnebenkosten);
    } else {
      setKaufnebenkosten(DEFAULT_FORM_DATA.kaufnebenkosten);
    }
    if (savedData?.kaufnebenkostenManuell) {
      setKaufnebenkostenManuell(savedData.kaufnebenkostenManuell);
    } else {
      setKaufnebenkostenManuell(DEFAULT_FORM_DATA.kaufnebenkostenManuell);
    }
    if (savedData?.kaufnebenkostenProzent) {
      setKaufnebenkostenProzent(savedData.kaufnebenkostenProzent);
    } else {
      setKaufnebenkostenProzent(DEFAULT_FORM_DATA.kaufnebenkostenProzent);
    }
    if (savedData?.sollzinsbindung) {
      setSollzinsbindung(savedData.sollzinsbindung);
    } else {
      setSollzinsbindung(DEFAULT_FORM_DATA.sollzinsbindung);
    }
    if (savedData?.RückzahlungsfreieZeit) {
      setRückzahlungsfreieZeit(savedData.RückzahlungsfreieZeit);
    } else {
      setRückzahlungsfreieZeit(DEFAULT_FORM_DATA.RückzahlungsfreieZeit);
    }
    if (savedData?.tilgungsFreieZeit) {
      setTilgungsFreieZeit(savedData.tilgungsFreieZeit);
    } else {
      setTilgungsFreieZeit(DEFAULT_FORM_DATA.tilgungsFreieZeit);
    }
    if (savedData?.tilgungsfreierKredit) {
      setTilgungsfreierKredit(savedData.tilgungsfreierKredit);
    } else {
      setTilgungsfreierKredit(DEFAULT_FORM_DATA.tilgungsfreierKredit);
    }
    if (savedData?.überbrückungskredit) {
      setÜberbrückungskredit(savedData.überbrückungskredit);
    } else {
      setÜberbrückungskredit(DEFAULT_FORM_DATA.überbrückungskredit);
    }
    if (savedData?.laufZeitÜberbrückungskredit) {
      setLaufZeitÜberbrückungskredit(savedData.laufZeitÜberbrückungskredit);
    } else {
      setLaufZeitÜberbrückungskredit(DEFAULT_FORM_DATA.laufZeitÜberbrückungskredit);
    }
    if (savedData?.elternkredit) {
      setElternkredit(savedData.elternkredit);
    } else {
      setElternkredit(DEFAULT_FORM_DATA.elternkredit);
    }
    if (savedData?.sollzinsbindung) {
      setSollzinsbindung(savedData.sollzinsbindung);
    } else {
      setSollzinsbindung(DEFAULT_FORM_DATA.sollzinsbindung);
    }
    if (savedData?.tilgungssatz) {
      setTilgungssatz(savedData.tilgungssatz);
    } else {
      setTilgungssatz(DEFAULT_FORM_DATA.tilgungssatz);
    }
    if (savedData?.sollzins) {
      setSollzins(savedData.sollzins);
    } else {
      setSollzins(DEFAULT_FORM_DATA.sollzins);
    }
    setIsLoading(false);
  }, []);

  // Save data to cookies whenever any value changes
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    const formData: FormData = {
      kaufpreis,
      modernisierungskosten,
      tilgungsfreierKredit,
      tilgungsFreieZeit,
      RückzahlungsfreieZeit,
      elternkredit,
      eigenkapital,
      kaufnebenkosten,
      kaufnebenkostenManuell,
      kaufnebenkostenProzent,
      sollzinsbindung,
      tilgungssatz,
      sollzins,
      überbrückungskredit,
      laufZeitÜberbrückungskredit,
    };
    saveFormData(formData);
  }, [
    isLoading,
    kaufpreis,
    modernisierungskosten,
    tilgungsfreierKredit,
    tilgungsFreieZeit,
    RückzahlungsfreieZeit,
    elternkredit,
    eigenkapital,
    kaufnebenkosten,
    kaufnebenkostenManuell,
    kaufnebenkostenProzent,
    sollzinsbindung,
    tilgungssatz,
    sollzins,
    überbrückungskredit,
    laufZeitÜberbrückungskredit,
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center bg-neutral-900 py-2">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-green-300"></div>
        </div>
      </main>
    );
  }

  // Parse input values
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

  const sollzinsNum = parseGermanPercent(sollzins);
  const tilgungssatzNum = parseGermanPercent(tilgungssatz);

  const tilgungsfreierKreditNum = parseGermanNumber(tilgungsfreierKredit);
  const tilgungsFreieZeitNum = parseGermanNumber(tilgungsFreieZeit);
  const elternkreditNum = parseGermanNumber(elternkredit);
  const RückzahlungsfreieZeitNum = parseGermanNumber(RückzahlungsfreieZeit);
  const überbrückungskreditNum = parseGermanNumber(überbrückungskredit);
  const laufZeitÜberbrückungskreditNum = parseGermanNumber(
    laufZeitÜberbrückungskredit,
  );
  // Calculate loan values
  const nettodarlehensbetrag = calculateNettodarlehensbetrag(
    kaufpreisNum,
    modernisierungskostenNum,
    kaufnebenkostenFinal,
    eigenkapitalNum,
    tilgungsfreierKreditNum,
    elternkreditNum,
    überbrückungskreditNum,
  );
  const rate = calculateMonthlyRate(
    nettodarlehensbetrag,
    sollzinsNum,
    tilgungssatzNum,
  );

  const years = parseInt(sollzinsbindung);
  const rates = calculateAllRates(
    kaufpreisNum,
    modernisierungskostenNum,
    kaufnebenkostenFinal,
    eigenkapitalNum,
    tilgungsfreierKreditNum,
    tilgungsFreieZeitNum,
    elternkreditNum,
    RückzahlungsfreieZeitNum,
    überbrückungskreditNum,
    laufZeitÜberbrückungskreditNum,
    sollzinsNum,
    tilgungssatzNum,
    years,
  );
  console.log(rates);
  const rateByTime = calculateTotalRatesByTimeframe(rates);
  console.log(rateByTime);
  const restschuldBank = calculateRestschuld(
    nettodarlehensbetrag,
    rate,
    sollzinsNum,
    years,
  );

  const fullPayment = calculateFullPaymentTime(
    nettodarlehensbetrag,
    rate,
    sollzinsNum,
  );

  const kfwRate = rates.find((r) => r.key === "kfwRateTilgung")?.rate ?? 0;
  const restschuldKfw = calculateRestschuld(
    tilgungsfreierKreditNum,
    kfwRate,
    4,
    years - tilgungsFreieZeitNum,
  );

  const restschuld = restschuldBank + restschuldKfw;

  const bezahlteZinsen = calculateTotalInterest(
    rate,
    years * 12,
    nettodarlehensbetrag,
    restschuldBank,
  );

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
    <main
      className="flex min-h-screen w-full flex-col items-center bg-neutral-900 py-2"
      suppressHydrationWarning
    >
      {/* Ihre Kondition Card */}
      <Card className="mb-4 w-full max-w-xl">
        <CardHeader>
          <CardTitle>Ihre Kondition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-2">
            <div className="flex flex-row flex-wrap justify-center gap-2">
              {rateByTime.map((iRate, index) => (
                <div
                  key={iRate.key + index}
                  className="flex min-w-fit flex-col items-center"
                >
                  <span className="text-base font-semibold text-green-300 sm:text-2xl">
                    {formatNumber(iRate.rate)}€
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {iRate.startYear} - {iRate.endYear} Jahre
                  </span>
                </div>
              ))}
            </div>
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
                {fullPayment.canBePaidOff
                  ? `${fullPayment.years} Jahren, ${fullPayment.months} Monaten`
                  : "nie (Rate zu niedrig)"}
              </span>
            </div>
            <div className="flex w-full justify-between py-2 text-sm">
              <span className="flex items-center gap-1">
                Bezahlte Zinsen nach {years} Jahren <span title="Info">ⓘ</span>
              </span>
              <span>{formatNumber(bezahlteZinsen)} €</span>
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
                <option>1,50 %</option>
                <option>2,00 %</option>
                <option>2,50 %</option>
                <option>3,00 %</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Tilgungsfreier Kredit <span title="Info">ⓘ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={tilgungsfreierKredit}
                  onChange={handleInputChange(setTilgungsfreierKredit)}
                  onBlur={() =>
                    handleInputBlur(
                      tilgungsfreierKredit,
                      setTilgungsfreierKredit,
                    )
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tilgungsfreie Zeit <span title="Info">ⓘ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={tilgungsFreieZeit}
                  onChange={handleInputChange(setTilgungsFreieZeit)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Elternkredit<span title="Info">ⓘ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={elternkredit}
                  onChange={handleInputChange(setElternkredit)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Rückzahlungsfreie Zeit <span title="Info">ⓘ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={RückzahlungsfreieZeit}
                  onChange={handleInputChange(setRückzahlungsfreieZeit)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Überbrückungskredit<span title="Info">ⓘ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={überbrückungskredit}
                  onChange={handleInputChange(setÜberbrückungskredit)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Laufzeit <span title="Info">ⓘ</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                  value={laufZeitÜberbrückungskredit}
                  onChange={handleInputChange(setLaufZeitÜberbrückungskredit)}
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
