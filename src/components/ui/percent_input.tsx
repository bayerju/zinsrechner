import { parseGermanNumber } from "~/lib/number_fromat";
import { NumberInput } from "./number_input";

type PercentInputProps = Omit<
  React.ComponentProps<typeof NumberInput>,
  "unit" | "parseInput"
>;

export function PercentInput({
  locale = "de-DE",
  ...props
}: PercentInputProps) {
  return (
    <NumberInput
      {...props}
      locale={locale}
      unit="%"
      parseInput={(raw, activeLocale) => {
        if (activeLocale.toLowerCase().startsWith("de")) {
          return parseGermanNumber(raw.replace(/\./g, ","));
        }
        return parseGermanNumber(raw);
      }}
    />
  );
}
