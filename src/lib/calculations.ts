// German number formatting and parsing utilities
export function formatNumber(num: number) {
  // Format number as German currency (e.g. 123456.78 => 123.456,78)
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseGermanNumber(str: string) {
  return Number(str.replace(/\./g, "").replace(",", "."));
}

export function parseGermanPercent(str: string) {
  return Number(str.replace(/%/g, "").replace(/\./g, "").replace(",", "."));
}

export function formatGermanNumberInput(str: string) {
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

// Loan calculation functions
export function calculateNettodarlehensbetrag(
  kaufpreis: number,
  modernisierungskosten: number,
  kaufnebenkosten: number,
  eigenkapital: number
) {
  return kaufpreis + modernisierungskosten + kaufnebenkosten - eigenkapital;
}

export function calculateMonthlyRate(
  nettodarlehensbetrag: number,
  sollzins: number,
  tilgungssatz: number
) {
  return nettodarlehensbetrag * ((sollzins / 100) / 12 + (tilgungssatz / 100) / 12);
}

export function calculateRestschuld(
  nettodarlehensbetrag: number,
  monthlyRate: number,
  sollzins: number,
  years: number
) {
  const r = sollzins / 100 / 12;
  const n = years * 12;
  
  if (r <= 0) return 0;
  
  const restschuld = nettodarlehensbetrag * Math.pow(1 + r, n) - 
    (monthlyRate / r) * (Math.pow(1 + r, n) - 1);
  
  return Math.max(0, restschuld);
}

export function calculateFullPaymentTime(
  nettodarlehensbetrag: number,
  monthlyRate: number,
  sollzins: number
) {
  const r = sollzins / 100 / 12;
  
  if (r <= 0 || monthlyRate <= nettodarlehensbetrag * r) {
    return { canBePaidOff: false, years: 0, months: 0 };
  }
  
  const nVollständig = Math.log(monthlyRate / (monthlyRate - nettodarlehensbetrag * r)) / Math.log(1 + r);
  const years = Math.floor(nVollständig / 12);
  const months = Math.ceil(nVollständig % 12);
  
  return { canBePaidOff: true, years, months };
}

export function calculateTotalInterest(
  monthlyRate: number,
  months: number,
  nettodarlehensbetrag: number,
  restschuld: number
) {
  return (monthlyRate * months) - (nettodarlehensbetrag - restschuld);
} 