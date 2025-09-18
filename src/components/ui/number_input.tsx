"use client";
import { useState, useEffect, useMemo } from "react";
import { parseGermanNumber } from "~/lib/number_fromat";

export function NumberInput({
  value,
  onChange,
  label,
  locale = "de-DE",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  locale?: string;
}) {
  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    });
  }, [locale]);

  const [inputString, setInputString] = useState<string>(value.toString());

  // Sync local state when value prop changes (important for atomWithStorage)
  useEffect(() => {
    setInputString(numberFormatter.format(value));
  }, [value, numberFormatter]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Remove all non-digit except comma and dot, but keep the raw input for display
    const raw = e.target.value.replace(/[^\d.,]/g, "");
    setInputString(raw);
    // console.log("raw", raw);
    // console.log("numberFormatter.format(parseGermanNumber(raw))", parseGermanNumber(raw));
    // Parse and send the number value to parent
    onChange(parseGermanNumber(raw));
  }

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium">
          {label} <span title="Info">ⓘ</span>
        </label>
      )}
      <input
        type="text"
        inputMode="numeric"
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
        value={inputString}
        onChange={handleInputChange}
      />
    </div>
  );
}

function getLastSeperator(str: string) {
  const lastSeperator = str
    .split("")
    .reverse()
    .find((char) => char === "," || char === ".");
  return lastSeperator;
}
