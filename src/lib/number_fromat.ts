// German number formatting and parsing utilities
export function formatNumber(num: number) {
    // Format number as German currency (e.g. 123456.78 => 123.456,78)
    return num.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  export function parseGermanNumber(str: string) {
    if (typeof str !== "string") {
      console.error("parseGermanNumber: str is not a string", str);
      return 0;
    }
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