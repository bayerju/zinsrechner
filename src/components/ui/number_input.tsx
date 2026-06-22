"use client";
import { type ReactNode, useState, useEffect, useMemo, useId } from "react";
import { parseGermanNumber } from "~/lib/number_fromat";
import { cn } from "~/lib/utils";
import { Input } from "./input";

function normalizeDecimalInput(raw: string, locale: string) {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex === -1) {
    return cleaned;
  }

  const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
  const decimalPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
  const decimalSeparator = locale.toLowerCase().startsWith("de") ? "," : ".";

  return `${integerPart}${decimalSeparator}${decimalPart}`;
}

export function NumberInput({
  value,
  onChange,
  label,
  unit = "",
  locale = "de-DE",
  parseInput,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange"> & {
  value: number;
  onChange: (value: number) => void;
  label?: ReactNode;
  locale?: string;
  unit?: string;
  parseInput?: (raw: string, locale: string) => number;
}) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const labelId = `${inputId}-label`;
  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    });
  }, [locale]);

  const [inputString, setInputString] = useState<string>(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused || props.disabled) {
      setInputString(numberFormatter.format(value));
    }
  }, [value, numberFormatter, props.disabled, isFocused]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = normalizeDecimalInput(e.target.value, locale);
    setInputString(raw);
    const parsedValue = parseInput
      ? parseInput(raw, locale)
      : parseGermanNumber(raw);

    if (Number.isFinite(parsedValue)) {
      onChange(parsedValue);
    }
  }

  return (
    <div>
      {label && (
        <label
          id={labelId}
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium"
        >
          {label}
          {/* <span title="Info">ⓘ</span> */}
        </label>
      )}
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          lang={locale}
          className={cn(
            `w-full rounded-md border border-neutral-700 bg-neutral-800 py-1 text-white ${
              unit ? "pr-8" : "px-3"
            } pl-3`,
            className,
          )}
          value={inputString}
          onChange={handleInputChange}
          onBlur={() => {
            setIsFocused(false);
            setInputString(numberFormatter.format(value));
          }}
          onFocus={() => {
            setIsFocused(true);
            setInputString(
              value === 0
                ? ""
                : value
                    .toString()
                    .replace(
                      ".",
                      locale.toLowerCase().startsWith("de") ? "," : ".",
                    ),
            );
          }}
          {...props}
          aria-labelledby={label ? labelId : props["aria-labelledby"]}
          id={inputId}
        />
        {unit && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-neutral-400 dark:text-neutral-200">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
