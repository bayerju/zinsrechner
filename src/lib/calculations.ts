import type { Credit, RatesByTime } from "./credit";

// Loan calculation functions
export function calculateNettodarlehensbetragBank(
  kaufpreis: number,
  modernisierungskosten: number,
  kaufnebenkosten: number,
  eigenkapital: number,
  tilgungsfreierKredit: number,
  elternkredit: number,
  überbrückungskredit: number,
) {
  return (
    kaufpreis +
    modernisierungskosten +
    kaufnebenkosten -
    eigenkapital -
    tilgungsfreierKredit -
    elternkredit -
    überbrückungskredit
  );
}

export function calculateMonthlyRate(
  darlehensbetrag: number,
  effzins: number,
  tilgungssatz: number,
) {
  return darlehensbetrag * (effzins / 100 / 12 + tilgungssatz / 100 / 12);
}

export function calculateRestschuld(
  nettodarlehensbetrag: number,
  monthlyRate: number,
  sollzins: number,
  years: number,
) {
  const r = sollzins / 100 / 12;
  const n = years * 12;

  if (r <= 0) return 0;

  const restschuld =
    nettodarlehensbetrag * Math.pow(1 + r, n) -
    (monthlyRate / r) * (Math.pow(1 + r, n) - 1);

  return Math.max(0, restschuld);
}

export function calculateFullPaymentTime(
  darlehensbetrag: number,
  monthlyRate: number,
  effzins: number,
) {
  const r = effzins / 100 / 12;

  if (r <= 0 || monthlyRate <= darlehensbetrag * r) {
    return { canBePaidOff: false, years: 0, months: 0 };
  }

  const nVollständig =
    Math.log(monthlyRate / (monthlyRate - darlehensbetrag * r)) /
    Math.log(1 + r);
  const years = Math.floor(nVollständig / 12);
  const months = Math.ceil(nVollständig % 12);

  return { canBePaidOff: true, years, months };
}

export function calculateTotalInterest(
  monthlyRate: number,
  months: number,
  nettodarlehensbetrag: number,
  restschuld: number,
) {
  return monthlyRate * months - (nettodarlehensbetrag - restschuld);
}

/**
 * Hier soll die monatliche Rate für eine bestimmte Laufzeit berechnet werden.
 * Da die verschiedenen Kredite verschiedene konditionen haben soll hier dann die monatliche Rate der gesamten Kredite berechnet werden.
 * Also kommt hier ein Array raus mit einer Jahreszahl, bis wann die Rate gilt und der monatlichen Rate.
 */
export function calculateAllRates(
  kaufpreis: number,
  modernisierungskosten: number,
  kaufnebenkosten: number,
  eigenkapital: number,
  kfw40: Credit,
  kfwFam: Credit,
  tilgungsfreierKredit: number,
  tilgungsFreieZeit: number,
  elternkredit: number,
  rückzahlungsfreieZeit: number,
  überbrückungskredit: number,
  laufZeitÜberbrückungskredit: number,
  sollzins: number,
  tilgungssatz: number,
  laufzeit: number,
): RatesByTime {
  const result: RatesByTime = [];
  const nettodarlehensbetrag = calculateNettodarlehensbetragBank(
    kaufpreis,
    modernisierungskosten,
    kaufnebenkosten,
    eigenkapital,
    tilgungsfreierKredit,
    elternkredit,
    überbrückungskredit,
  );
  // const additionslCredits = [{key: "laufZeitÜberbrückungskredit", value: laufZeitÜberbrückungskredit}, {key: "rückzahlungsfreieZeit", value: rückzahlungsfreieZeit}, {key: "tilgungsFreieZeit", value: tilgungsFreieZeit}].sort((a, b) => a.value - b.value);
  const baseRate = calculateMonthlyRate(
    nettodarlehensbetrag,
    sollzins,
    tilgungssatz,
  );
  result.push({
    startYear: 0,
    endYear: laufzeit,
    rate: baseRate,
    key: "baseRate",
  });
  // Calculate monthly payment for Elternkredit after interest-free period
  // Loan accumulates 1% interest during rückzahlungsfreie Zeit, then must be paid off in remaining time
  const elternkreditWithInterest =
    elternkredit * Math.pow(1.01, rückzahlungsfreieZeit);
  const repaymentPeriod = 10 - rückzahlungsfreieZeit;

  let elternRate = 0;
  if (repaymentPeriod > 0) {
    // Simple calculation: total amount to pay off divided by remaining months
    // No additional interest during repayment period since it's already included
    elternRate = elternkreditWithInterest / (repaymentPeriod * 12);
  }
  result.push({
    startYear: rückzahlungsfreieZeit,
    endYear: 10,
    rate: elternRate,
    key: "elternRate",
  });

  // Calculate interest-only payments for tilgungsfreier Kredit
  const kfwRateTilgungsfrei = (tilgungsfreierKredit * 3.51) / 100 / 12;
  result.push({
    startYear: 0,
    endYear: tilgungsFreieZeit,
    rate: kfwRateTilgungsfrei,
    key: "kfwRateTilgungsfrei",
  });

  const kfwRateTilgung = calculateMonthlyRate(tilgungsfreierKredit, 3.51, 2);
  result.push({
    startYear: tilgungsFreieZeit,
    endYear: laufzeit,
    rate: kfwRateTilgung,
    key: "kfwRateTilgung",
  });

  const überbrückungskreditRate = calculateMonthlyRate(
    überbrückungskredit,
    5.8,
    0,
  );
  result.push({
    startYear: 0,
    endYear: laufZeitÜberbrückungskredit,
    rate: überbrückungskreditRate,
    key: "überbrückungskreditRate",
  });

  function getTilgungsRate(abbezahltNach: number, credit: Credit) {}
  const kfw40RateTilgungsfrei = calculateMonthlyRate(
    kfw40.summeDarlehen,
    2.8,
    0,
  );
  result.push({
    startYear: 0,
    endYear: kfw40.tilgungsFreieZeit,
    rate: kfw40RateTilgungsfrei,
    key: "kfw40RateTilgungsfrei",
  });

  const kfw40RateTilgung = calculateMonthlyRate(kfw40.summeDarlehen, 2.8, 2);
  result.push({
    startYear: kfw40.tilgungsFreieZeit,
    endYear: laufzeit,
    rate: kfw40RateTilgung,
    key: "kfw40RateTilgung",
  });

  const kfwFamRateTilgungsfrei = calculateMonthlyRate(
    kfwFam.summeDarlehen,
    2.8,
    0,
  );
  result.push({
    startYear: 0,
    endYear: kfwFam.tilgungsFreieZeit,
    rate: kfwFamRateTilgungsfrei,
    key: "kfwFamRateTilgungsfrei",
  });

  const kfwFamRateTilgung = calculateMonthlyRate(kfwFam.summeDarlehen, 2.8, 2);
  result.push({
    startYear: kfwFam.tilgungsFreieZeit,
    endYear: laufzeit,
    rate: kfwFamRateTilgung,
    key: "kfwFamRateTilgung",
  });

  return result.sort((a, b) => a.endYear - b.endYear);
}



export function calculateTotalRatesByTimeframe(rates: RatesByTime): RatesByTime {
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
