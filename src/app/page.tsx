"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useState, useEffect } from "react";
import {
  calculateNettodarlehensbetragBank,
  calculateMonthlyRate,
  calculateRestschuld,
  calculateFullPaymentTime,
  calculateTotalInterest,
  calculateAllRates,
  calculateTotalRatesByTimeframe,
} from "~/lib/calculations";
import { saveFormData, loadFormData, type FormData } from "~/lib/cookies";
import {
  formatNumber,
  parseGermanNumber,
  parseGermanPercent,
  formatGermanNumberInput,
} from "~/lib/number_fromat";
import InfosHeader from "~/components/infos_header";
import Conditions from "~/components/conditions";
import Credits from "~/components/credits";
import { type Credit, type RatesByTime } from "~/lib/credit";
import { useAtomValue } from "jotai";
import { modernisierungskostenAtom, kaufnebenkostenAtom, eigenkapitalAtom,  tilgungssatzAtom, zinsbindungAtom } from "~/state/conditions_atoms";
import {creditsAtom} from "~/state/credits_atom"
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
  // const [isLoading, setIsLoading] = useState(true);

  // // Initialize state with default values (no cookie loading here)
  // const [kaufpreis, setKaufpreis] = useState(DEFAULT_FORM_DATA.kaufpreis);
  // const [modernisierungskosten, setModernisierungskosten] = useState(
  //   DEFAULT_FORM_DATA.modernisierungskosten,
  // );
  // const [tilgungsfreierKredit, setTilgungsfreierKredit] = useState(
  //   DEFAULT_FORM_DATA.tilgungsfreierKredit,
  // );
  // const [tilgungsFreieZeit, setTilgungsFreieZeit] = useState(
  //   DEFAULT_FORM_DATA.tilgungsFreieZeit,
  // );

  // const [eigenkapital, setEigenkapital] = useState(
  //   DEFAULT_FORM_DATA.eigenkapital,
  // );
  // const [kaufnebenkosten, setKaufnebenkosten] = useState(
  //   DEFAULT_FORM_DATA.kaufnebenkosten,
  // );
  // const [kaufnebenkostenManuell, setKaufnebenkostenManuell] = useState(
  //   DEFAULT_FORM_DATA.kaufnebenkostenManuell,
  // );
  // const [kaufnebenkostenProzent, setKaufnebenkostenProzent] = useState(
  //   DEFAULT_FORM_DATA.kaufnebenkostenProzent,
  // );
  // const [sollzinsbindung, setSollzinsbindung] = useState(
  //   DEFAULT_FORM_DATA.sollzinsbindung,
  // );
  // const [tilgungssatz, setTilgungssatz] = useState(
  //   DEFAULT_FORM_DATA.tilgungssatz,
  // );
  // const [sollzins, setSollzins] = useState(DEFAULT_FORM_DATA.sollzins);
  // const [elternkredit, setElternkredit] = useState(
  //   DEFAULT_FORM_DATA.elternkredit,
  // );
  // const [RückzahlungsfreieZeit, setRückzahlungsfreieZeit] = useState(
  //   DEFAULT_FORM_DATA.RückzahlungsfreieZeit,
  // );
  // const [überbrückungskredit, setÜberbrückungskredit] = useState(
  //   DEFAULT_FORM_DATA.überbrückungskredit,
  // );
  // const [laufZeitÜberbrückungskredit, setLaufZeitÜberbrückungskredit] =
  //   useState(DEFAULT_FORM_DATA.laufZeitÜberbrückungskredit);
  // Load data from cookies on mount (client-side only)
  // useEffect(() => {
  //   const savedData = loadFormData();
  //   if (savedData?.kaufpreis) {
  //     setKaufpreis(savedData.kaufpreis);
  //   } else {
  //     setKaufpreis(DEFAULT_FORM_DATA.kaufpreis);
  //   }
  //   if (savedData?.modernisierungskosten) {
  //     setModernisierungskosten(savedData.modernisierungskosten);
  //   } else {
  //     setModernisierungskosten(DEFAULT_FORM_DATA.modernisierungskosten);
  //   }
  //   if (savedData?.eigenkapital) {
  //     setEigenkapital(savedData.eigenkapital);
  //   } else {
  //     setEigenkapital(DEFAULT_FORM_DATA.eigenkapital);
  //   }
  //   if (savedData?.kaufnebenkosten) {
  //     setKaufnebenkosten(savedData.kaufnebenkosten);
  //   } else {
  //     setKaufnebenkosten(DEFAULT_FORM_DATA.kaufnebenkosten);
  //   }
  //   if (savedData?.kaufnebenkostenManuell) {
  //     setKaufnebenkostenManuell(savedData.kaufnebenkostenManuell);
  //   } else {
  //     setKaufnebenkostenManuell(DEFAULT_FORM_DATA.kaufnebenkostenManuell);
  //   }
  //   if (savedData?.kaufnebenkostenProzent) {
  //     setKaufnebenkostenProzent(savedData.kaufnebenkostenProzent);
  //   } else {
  //     setKaufnebenkostenProzent(DEFAULT_FORM_DATA.kaufnebenkostenProzent);
  //   }
  //   if (savedData?.sollzinsbindung) {
  //     setSollzinsbindung(savedData.sollzinsbindung);
  //   } else {
  //     setSollzinsbindung(DEFAULT_FORM_DATA.sollzinsbindung);
  //   }
  //   if (savedData?.RückzahlungsfreieZeit) {
  //     setRückzahlungsfreieZeit(savedData.RückzahlungsfreieZeit);
  //   } else {
  //     setRückzahlungsfreieZeit(DEFAULT_FORM_DATA.RückzahlungsfreieZeit);
  //   }
  //   if (savedData?.tilgungsFreieZeit) {
  //     setTilgungsFreieZeit(savedData.tilgungsFreieZeit);
  //   } else {
  //     setTilgungsFreieZeit(DEFAULT_FORM_DATA.tilgungsFreieZeit);
  //   }
  //   if (savedData?.tilgungsfreierKredit) {
  //     setTilgungsfreierKredit(savedData.tilgungsfreierKredit);
  //   } else {
  //     setTilgungsfreierKredit(DEFAULT_FORM_DATA.tilgungsfreierKredit);
  //   }
  //   if (savedData?.überbrückungskredit) {
  //     setÜberbrückungskredit(savedData.überbrückungskredit);
  //   } else {
  //     setÜberbrückungskredit(DEFAULT_FORM_DATA.überbrückungskredit);
  //   }
  //   if (savedData?.laufZeitÜberbrückungskredit) {
  //     setLaufZeitÜberbrückungskredit(savedData.laufZeitÜberbrückungskredit);
  //   } else {
  //     setLaufZeitÜberbrückungskredit(
  //       DEFAULT_FORM_DATA.laufZeitÜberbrückungskredit,
  //     );
  //   }
  //   if (savedData?.elternkredit) {
  //     setElternkredit(savedData.elternkredit);
  //   } else {
  //     setElternkredit(DEFAULT_FORM_DATA.elternkredit);
  //   }
  //   if (savedData?.sollzinsbindung) {
  //     setSollzinsbindung(savedData.sollzinsbindung);
  //   } else {
  //     setSollzinsbindung(DEFAULT_FORM_DATA.sollzinsbindung);
  //   }
  //   if (savedData?.tilgungssatz) {
  //     setTilgungssatz(savedData.tilgungssatz);
  //   } else {
  //     setTilgungssatz(DEFAULT_FORM_DATA.tilgungssatz);
  //   }
  //   if (savedData?.sollzins) {
  //     setSollzins(savedData.sollzins);
  //   } else {
  //     setSollzins(DEFAULT_FORM_DATA.sollzins);
  //   }
  //   setIsLoading(false);
  // }, []);

  // // Save data to cookies whenever any value changes
  // useEffect(() => {
  //   if (isLoading) return; // Don't save during initial load

  //   const formData: FormData = {
  //     kaufpreis,
  //     modernisierungskosten,
  //     tilgungsfreierKredit,
  //     tilgungsFreieZeit,
  //     RückzahlungsfreieZeit,
  //     elternkredit,
  //     eigenkapital,
  //     kaufnebenkosten,
  //     kaufnebenkostenManuell,
  //     kaufnebenkostenProzent,
  //     sollzinsbindung,
  //     tilgungssatz,
  //     sollzins,
  //     überbrückungskredit,
  //     laufZeitÜberbrückungskredit,
  //   };
  //   saveFormData(formData);
  // }, [
  //   isLoading,
  //   kaufpreis,
  //   modernisierungskosten,
  //   tilgungsfreierKredit,
  //   tilgungsFreieZeit,
  //   RückzahlungsfreieZeit,
  //   elternkredit,
  //   eigenkapital,
  //   kaufnebenkosten,
  //   kaufnebenkostenManuell,
  //   kaufnebenkostenProzent,
  //   sollzinsbindung,
  //   tilgungssatz,
  //   sollzins,
  //   überbrückungskredit,
  //   laufZeitÜberbrückungskredit,
  // ]);

  // Show loading state
  // if (isLoading) {
  //   return (
  //     <main className="flex min-h-screen w-full flex-col items-center bg-neutral-900 py-2">
  //       <div className="flex items-center justify-center">
  //         <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-green-300"></div>
  //       </div>
  //     </main>
  //   );
  // }

  // // Parse input values
  // const kaufpreisNum = parseGermanNumber(kaufpreis);
  // const modernisierungskostenNum = parseGermanNumber(modernisierungskosten);
  // const eigenkapitalNum = parseGermanNumber(eigenkapital);
  // const kaufnebenkostenProzentNum = parseGermanPercent(kaufnebenkostenProzent);
  // const berechneteKaufnebenkosten = Math.round(
  //   kaufpreisNum * (kaufnebenkostenProzentNum / 100),
  // );
  // const kaufnebenkostenNum = parseGermanNumber(kaufnebenkosten);
  // const kaufnebenkostenFinal = kaufnebenkostenManuell
  //   ? kaufnebenkostenNum
  //   : berechneteKaufnebenkosten;

  // const sollzinsNum = parseGermanPercent(sollzins);
  // const tilgungssatzNum = parseGermanPercent(tilgungssatz);

  // const tilgungsfreierKreditNum = parseGermanNumber(tilgungsfreierKredit);
  // const tilgungsFreieZeitNum = parseGermanNumber(tilgungsFreieZeit);
  // const elternkreditNum = parseGermanNumber(elternkredit);
  // const RückzahlungsfreieZeitNum = parseGermanNumber(RückzahlungsfreieZeit);
  // const überbrückungskreditNum = parseGermanNumber(überbrückungskredit);
  // const laufZeitÜberbrückungskreditNum = parseGermanNumber(
  //   laufZeitÜberbrückungskredit,
  // );

// const modernisierungskostenNum = useAtomValue(modernisierungskostenAtom);
// const kaufnebenkosten = useAtomValue(kaufnebenkostenAtom);
// const eigenkapitalNum = useAtomValue(eigenkapitalAtom);
// const credits = useAtomValue(creditsAtom);
// const tilgungssatzNum = useAtomValue(tilgungssatzAtom);

//   // Calculate loan values
//   const nettodarlehensbetrag = calculateNettodarlehensbetragBank(
//     kaufnebenkosten,
//     modernisierungskostenNum,
//     kaufnebenkosten,
//     eigenkapitalNum,
//     tilgungsfreierKreditNum,
//     elternkreditNum,
//     überbrückungskreditNum,
//   );
//   const rate = calculateMonthlyRate(
//     nettodarlehensbetrag,
//     sollzinsNum,
//     tilgungssatzNum,
//   );

//   const years = parseInt(sollzinsbindung);
//   const rates = calculateAllRates(
//     kaufnebenkosten,
//     modernisierungskostenNum,
//     kaufnebenkosten,
//     eigenkapitalNum,
//     tilgungsfreierKreditNum,
//     tilgungsFreieZeitNum,
//     elternkreditNum,
//     RückzahlungsfreieZeitNum,
//     überbrückungskreditNum,
//     laufZeitÜberbrückungskreditNum,
//     sollzinsNum,
//     tilgungssatzNum,
//     years,
//   );
//   console.log(rates);
//   const rateByTime = calculateTotalRatesByTimeframe(rates);
//   console.log(rateByTime);
//   const restschuldBank = calculateRestschuld(
//     nettodarlehensbetrag,
//     rate,
//     sollzinsNum,
//     years,
//   );

//   const fullPayment = calculateFullPaymentTime(
//     nettodarlehensbetrag,
//     rate,
//     sollzinsNum,
//   );

//   const kfwRate = rates.find((r) => r.key === "kfwRateTilgung")?.rate ?? 0;
//   const restschuldKfw = calculateRestschuld(
//     tilgungsfreierKreditNum,
//     kfwRate,
//     4,
//     years - tilgungsFreieZeitNum,
//   );

//   const restschuld = restschuldBank + restschuldKfw;

//   const bezahlteZinsen = calculateTotalInterest(
//     rate,
//     years * 12,
//     nettodarlehensbetrag,
//     restschuldBank,
//   );

  // // Handlers for formatted input fields
  // function handleInputChange(setter: (v: string) => void) {
  //   return (e: React.ChangeEvent<HTMLInputElement>) => {
  //     // Remove all non-digit except comma and dot, but do not format yet
  //     const raw = e.target.value.replace(/[^\d.,]/g, "");
  //     setter(raw);
  //   };
  // }
  // function handleInputBlur(value: string, setter: (v: string) => void) {
  //   setter(formatGermanNumberInput(value));
  // }
  // function handlePercentInputBlur(value: string, setter: (v: string) => void) {
  //   // Always show two decimals for percent
  //   let formatted = formatGermanNumberInput(value);
  //   // If no comma, add ',00'
  //   if (formatted && !formatted.includes(",")) formatted += ",00";
  //   // If only one decimal, add one zero
  //   if (/,\d$/.exec(formatted)) formatted += "0";
  //   setter(formatted);
  // }
  // function handlePercentInputChange(
  //   setter: (v: string) => void,
  //   valueSetter?: (v: string) => void,
  //   refValue?: number,
  // ) {
  //   return (e: React.ChangeEvent<HTMLInputElement>) => {
  //     const raw = e.target.value.replace(/[^\d.,]/g, "");
  //     setter(raw);
  //     // If valueSetter and refValue are provided, update the value field as well
  //     if (valueSetter && refValue !== undefined) {
  //       // Calculate value from percent
  //       const percentNum = parseGermanPercent(raw);
  //       const value = Math.round(refValue * (percentNum / 100));
  //       valueSetter(formatGermanNumberInput(value.toString()));
  //     }
  //   };
  // }
  // function handleValueInputChange(
  //   setter: (v: string) => void,
  //   percentSetter?: (v: string) => void,
  //   refValue?: number,
  // ) {
  //   return (e: React.ChangeEvent<HTMLInputElement>) => {
  //     const raw = e.target.value.replace(/[^\d.,]/g, "");
  //     setter(raw);
  //     // If percentSetter and refValue are provided, update the percent field as well
  //     if (percentSetter && refValue && refValue > 0) {
  //       const valueNum = parseGermanNumber(raw);
  //       const percent = (valueNum / refValue) * 100;
  //       percentSetter(formatGermanNumberInput(percent.toFixed(2)));
  //     }
  //   };
  // }
  // // Handler for toggling manual mode for Kaufnebenkosten
  // function handleKaufnebenkostenManuellChange(
  //   e: React.ChangeEvent<HTMLInputElement>,
  // ) {
  //   const checked = e.target.checked;
  //   setKaufnebenkostenManuell(checked);
  //   if (checked) {
  //     // Set value to current calculated value when switching to manual
  //     setKaufnebenkosten(
  //       formatGermanNumberInput(berechneteKaufnebenkosten.toString()),
  //     );
  //   }
  // }

  return (
    <main
      className="flex min-h-screen w-full flex-col items-center bg-neutral-900 py-2"
      suppressHydrationWarning
    >
      {/* Ihre Kondition Card */}
      <InfosHeader />

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
            <Conditions />
            <Credits />
            {/* <div className="grid grid-cols-3 gap-2">
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
            </div> */}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
