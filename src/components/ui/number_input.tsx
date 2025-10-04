"use client";
import { useState, useEffect, useMemo } from "react";
import { parseGermanNumber } from "~/lib/number_fromat";
import { Input } from "./input";

export function NumberInput({
  value,
  onChange,
  label,
  unit = "",
  locale = "de-DE",
  ...props
}: Omit<React.ComponentProps<"input">, "onChange"> & {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  locale?: string;
  unit?: string;
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
  }, []);

  useEffect(() => {
    if (props.disabled) {
      setInputString(numberFormatter.format(value));
    }
  }, [value, numberFormatter, props.disabled]);

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
          {label} 
          {/* <span title="Info">ⓘ</span> */}
        </label>
      )}
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          className={`w-full rounded-md border border-neutral-700 bg-neutral-800 py-1 text-white ${
            unit ? "pr-8" : "px-3"
          } pl-3`}
          value={inputString}
          onChange={handleInputChange}
          onBlur={() => setInputString(numberFormatter.format(value))}
          onFocus={() => {
            if (inputString === "0") setInputString("");
          }}
          {...props}
        />
        {unit && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-neutral-200">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
