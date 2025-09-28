import type { Credit, RatesByTime } from "./credit";

// Loan calculation functions
export function calculateNettodarlehensbetragBank({
  kaufpreis,
  modernisierungskosten,
  kaufnebenkosten,
  eigenkapital,
  credits,
}: {
  kaufpreis: number;
  modernisierungskosten: number;
  kaufnebenkosten: number;
  eigenkapital: number;
  credits: Credit[];
}) {
  return (
    kaufpreis +
    modernisierungskosten +
    kaufnebenkosten -
    eigenkapital -
    credits.reduce((acc, credit) => acc + credit.summeDarlehen, 0)
  );
}

// export function calculateMonthlyRate({
//   darlehensbetrag, effzins, kreditdauer, tilgungsfreieZeit = 0, rückzahlungsfreieZeit = 0
// }: {
//   darlehensbetrag: number; effzins: number; kreditdauer: number;
//   tilgungsfreieZeit?: number; rückzahlungsfreieZeit?: number;
// }) {
//   const p = effzins / 100;
//   const r = Math.pow(1 + p, 1 / 12) - 1;
//   const nMonate = 12 * (kreditdauer - tilgungsfreieZeit - rückzahlungsfreieZeit);
//   const Kprime = darlehensbetrag * Math.pow(1 + p, rückzahlungsfreieZeit);
//   return Kprime * r / (1 - Math.pow(1 + r, -nMonate));
// }

export function calculateMonthlyRate(
  {darlehensbetrag, effzins, tilgungssatz, rückzahlungsfreieZeit = 0}: {darlehensbetrag: number, effzins: number, tilgungssatz: number, rückzahlungsfreieZeit?: number}
) {
  const darlehensbetragAufgezinst = darlehensbetrag * Math.pow(1 + effzins / 100, rückzahlungsfreieZeit);
  return darlehensbetragAufgezinst * (effzins / 100 / 12 + tilgungssatz / 100 / 12);
}

export function calculateRestschuld({
  nettodarlehensbetrag,
  monthlyRate,
  effZins,
  years,
  rückzahlungsfreieZeit,
  tilgungsfreieZeit,
}: {
  nettodarlehensbetrag: number;
  monthlyRate: number;
  effZins: number;
  years: number;
  rückzahlungsfreieZeit?: number;
  tilgungsfreieZeit?: number;
}) {
  const q = rückzahlungsfreieZeit ?? 0;
  const m = tilgungsfreieZeit ?? 0;

  const p = effZins/100;
  const r = Math.pow(1+p, 1/12) - 1;
  if (years <= q) return nettodarlehensbetrag * Math.pow(1+r, Math.round(12*years));
  const Kprime = nettodarlehensbetrag * Math.pow(1+p, q);
  if (years <= q + m) return Kprime;
  const N = Math.round(12*(years - q - m));
  return Math.max(0, Kprime * Math.pow(1+r, N) - monthlyRate * ( (Math.pow(1+r, N) - 1) / r ));
}

export function calculateTilgungssatz({
  effzins,
  kreditdauer,
  tilgungsfreieZeit = 0,
  rückzahlungsfreieZeit = 0,
}: {
  effzins: number;
  kreditdauer: number;
  tilgungsfreieZeit?: number;
  rückzahlungsfreieZeit?: number;
}) {

  const tilgungsDauer = kreditdauer - tilgungsfreieZeit - rückzahlungsfreieZeit;
  if (tilgungsDauer <= 0) return NaN; // oder wirf einen Fehler

  if (Math.abs((effzins / 100)) < 1e-12) {
    return 100 / tilgungsDauer;
  }

  // if (effzins === 0) {
  //   const tilgungsMonate = (kreditdauer - tilgungsfreieZeit - rückzahlungsfreieZeit) * 12; // kreditdauer der Tilgung in Monaten
  //   return tilgungsMonate > 0 ? 100 / tilgungsMonate : 0;
  // }

  return (
    (effzins /
      100 /
      ((1 + effzins / 100) **
        (kreditdauer - tilgungsfreieZeit - rückzahlungsfreieZeit) -
        1)) *
    100
  );
}

function claculateMonthlyInterest(yearlyEffInterest: number) {
  return (1 + yearlyEffInterest / 100) ** (1 / 12) - 1;
}

export function calculateFullPaymentTime({
  darlehensbetrag,
  monthlyRate,
  effzins,
  tilgungsfreieZeit = 0,
  rückzahlungsfreieZeit = 0,
}: {
  darlehensbetrag: number;
  monthlyRate: number;
  effzins: number;
  tilgungsfreieZeit?: number;
  rückzahlungsfreieZeit?: number;
}) {
  const darlehensbetragNeu =
    rückzahlungsfreieZeit > 0
      ? darlehensbetrag * Math.pow(1 + effzins / 100, rückzahlungsfreieZeit)
      : darlehensbetrag;
  // r = monatlicherAequivalenzzins
  const r = claculateMonthlyInterest(effzins);

  if (r < 0 || monthlyRate < darlehensbetragNeu * r) {
    return { canBePaidOff: false, years: 0, months: 0, yearsAufgerundet: 0 };
  }
let monthsToPay: number;
  if (Math.abs(r) < 1e-12) {
    monthsToPay = darlehensbetragNeu / monthlyRate;
  } else {
monthsToPay = Math.log(monthlyRate / (monthlyRate - darlehensbetragNeu * r)) /
    Math.log(1 + r);
  }
  const monthsToPayWithInterest = Math.ceil(
    monthsToPay + tilgungsfreieZeit * 12 + rückzahlungsfreieZeit * 12,
  );
  const years = Math.floor(monthsToPayWithInterest / 12);
  const months = Math.ceil(monthsToPayWithInterest % 12);

  return {
    canBePaidOff: true,
    years,
    months,
    yearsAufgerundet: Math.ceil(monthsToPayWithInterest / 12),
  };
}

export function calculateTotalInterest(
  monthlyRate: number,
  months: number,
  nettodarlehensbetrag: number,
  restschuld: number,
) {
  return monthlyRate * months - (nettodarlehensbetrag - restschuld);
}

// /**
//  * Hier soll die monatliche Rate für eine bestimmte Laufzeit berechnet werden.
//  * Da die verschiedenen Kredite verschiedene konditionen haben soll hier dann die monatliche Rate der gesamten Kredite berechnet werden.
//  * Also kommt hier ein Array raus mit einer Jahreszahl, bis wann die Rate gilt und der monatlichen Rate.
//  */
// export function calculateAllRates(
//   kaufpreis: number,
//   modernisierungskosten: number,
//   kaufnebenkosten: number,
//   eigenkapital: number,
//   kfw40: Credit,
//   kfwFam: Credit,
//   tilgungsfreierKredit: number,
//   tilgungsFreieZeit: number,
//   elternkredit: number,
//   rückzahlungsfreieZeit: number,
//   überbrückungskredit: number,
//   laufZeitÜberbrückungskredit: number,
//   sollzins: number,
//   tilgungssatz: number,
//   laufzeit: number,
// ): RatesByTime {
//   const result: RatesByTime = [];
//   const nettodarlehensbetrag = calculateNettodarlehensbetragBank(
//     kaufpreis,
//     modernisierungskosten,
//     kaufnebenkosten,
//     eigenkapital,
//     tilgungsfreierKredit,
//     elternkredit,
//     überbrückungskredit,
//   );
//   // const additionslCredits = [{key: "laufZeitÜberbrückungskredit", value: laufZeitÜberbrückungskredit}, {key: "rückzahlungsfreieZeit", value: rückzahlungsfreieZeit}, {key: "tilgungsFreieZeit", value: tilgungsFreieZeit}].sort((a, b) => a.value - b.value);
//   const baseRate = calculateMonthlyRate(
//     nettodarlehensbetrag,
//     sollzins,
//     tilgungssatz,
//   );
//   result.push({
//     startYear: 0,
//     endYear: laufzeit,
//     rate: baseRate,
//     key: "baseRate",
//   });
//   // Calculate monthly payment for Elternkredit after interest-free period
//   // Loan accumulates 1% interest during rückzahlungsfreie Zeit, then must be paid off in remaining time
//   const elternkreditWithInterest =
//     elternkredit * Math.pow(1.01, rückzahlungsfreieZeit);
//   const repaymentPeriod = 10 - rückzahlungsfreieZeit;

//   let elternRate = 0;
//   if (repaymentPeriod > 0) {
//     // Simple calculation: total amount to pay off divided by remaining months
//     // No additional interest during repayment period since it's already included
//     elternRate = elternkreditWithInterest / (repaymentPeriod * 12);
//   }
//   result.push({
//     startYear: rückzahlungsfreieZeit,
//     endYear: 10,
//     rate: elternRate,
//     key: "elternRate",
//   });

//   // Calculate interest-only payments for tilgungsfreier Kredit
//   const kfwRateTilgungsfrei = (tilgungsfreierKredit * 3.51) / 100 / 12;
//   result.push({
//     startYear: 0,
//     endYear: tilgungsFreieZeit,
//     rate: kfwRateTilgungsfrei,
//     key: "kfwRateTilgungsfrei",
//   });

//   const kfwRateTilgung = calculateMonthlyRate(tilgungsfreierKredit, 3.51, 2);
//   result.push({
//     startYear: tilgungsFreieZeit,
//     endYear: laufzeit,
//     rate: kfwRateTilgung,
//     key: "kfwRateTilgung",
//   });

//   const überbrückungskreditRate = calculateMonthlyRate(
//     überbrückungskredit,
//     5.8,
//     0,
//   );
//   result.push({
//     startYear: 0,
//     endYear: laufZeitÜberbrückungskredit,
//     rate: überbrückungskreditRate,
//     key: "überbrückungskreditRate",
//   });

//   function getTilgungsRate(abbezahltNach: number, credit: Credit) {}
//   const kfw40RateTilgungsfrei = calculateMonthlyRate(
//     kfw40.summeDarlehen,
//     2.8,
//     0,
//   );
//   result.push({
//     startYear: 0,
//     endYear: kfw40.tilgungsFreieZeit,
//     rate: kfw40RateTilgungsfrei,
//     key: "kfw40RateTilgungsfrei",
//   });

//   const kfw40RateTilgung = calculateMonthlyRate(kfw40.summeDarlehen, 2.8, 2);
//   result.push({
//     startYear: kfw40.tilgungsFreieZeit,
//     endYear: laufzeit,
//     rate: kfw40RateTilgung,
//     key: "kfw40RateTilgung",
//   });

//   const kfwFamRateTilgungsfrei = calculateMonthlyRate(
//     kfwFam.summeDarlehen,
//     2.8,
//     0,
//   );
//   result.push({
//     startYear: 0,
//     endYear: kfwFam.tilgungsFreieZeit,
//     rate: kfwFamRateTilgungsfrei,
//     key: "kfwFamRateTilgungsfrei",
//   });

//   const kfwFamRateTilgung = calculateMonthlyRate(kfwFam.summeDarlehen, 2.8, 2);
//   result.push({
//     startYear: kfwFam.tilgungsFreieZeit,
//     endYear: laufzeit,
//     rate: kfwFamRateTilgung,
//     key: "kfwFamRateTilgung",
//   });

//   return result.sort((a, b) => a.endYear - b.endYear);
// }

export function calculateTotalRatesByTimeframe(
  rates: RatesByTime,
): RatesByTime {
  // Extract all unique time boundaries
  const timeBoundaries = new Set<number>();
  rates.forEach((rate) => {
    timeBoundaries.add(rate.startYear);
    timeBoundaries.add(rate.endYear);
  });

  // Sort boundaries in ascending order
  const sortedBoundaries = Array.from(timeBoundaries).sort((a, b) => a - b);

  // Calculate total rate for each timeframe
  const totalRates: RatesByTime = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const startYear = sortedBoundaries[i];
    const endYear = sortedBoundaries[i + 1];

    if (startYear !== undefined && endYear !== undefined) {
      // Sum all rates that are active during this timeframe
      let totalRate = 0;
      rates.forEach((rate) => {
        if (rate.startYear <= startYear && rate.endYear >= endYear) {
          totalRate += rate.rate;
        }
      });

      totalRates.push({
        startYear,
        endYear,
        rate: totalRate,
        key: `totalRate_${startYear}_${endYear}`,
      });
    }
  }

  return totalRates;
}

type RestschuldByTimeframe = {
  endYear: number;
  restschuld: number;
}

export function calculateRestschuldByTimeframe(
  credits: {zinsbindung: number, restSchuld: number}[],
): RestschuldByTimeframe[] {
  const result: RestschuldByTimeframe[] = [];
  const timeBoundaries = new Set<number>();
  credits.forEach((credit) => {
    timeBoundaries.add(credit.zinsbindung);
  });

  timeBoundaries.forEach((timeBoundary) => {
    const existingRestschulds = credits.filter((credit) => credit.zinsbindung === timeBoundary);
    const restschuld = existingRestschulds.reduce((acc, credit) => acc + credit.restSchuld, 0);
    if (restschuld > 0) {
    result.push({
        endYear: timeBoundary,
        restschuld: restschuld,
      });
    }
  });
  return result;
}

