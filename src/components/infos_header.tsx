"use client";

import { useAtomValue, useAtom } from "jotai";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { formatNumber } from "~/lib/number_fromat";
import {
  nettoDarlehensBetragAtom,
  effzinsAtom,
  restschuldAtom,
  zinsbindungAtom,
  fullPaymentAtom,
  bezahlteZinsenAtom,
  tilgungssatzAtom,
} from "~/state/conditions_atoms";
import { NumberInput } from "./ui/number_input";
import {
  calculateMonthlyRate,
  calculateTotalRatesByTimeframe,
} from "~/lib/calculations";
import { creditsAtom } from "~/state/credits_atom";

export default function InfosHeader() {
  const [effzins, setEffzins] = useAtom(effzinsAtom);
  const zinsbindung = useAtomValue(zinsbindungAtom);
  const fullPayment = useAtomValue(fullPaymentAtom);
  const bezahlteZinsen = useAtomValue(bezahlteZinsenAtom);
  const credits = useAtomValue(creditsAtom);
  const tilgungssatz = useAtomValue(tilgungssatzAtom);

  const nettoDarlehensbetrag = useAtomValue(nettoDarlehensBetragAtom);
  const restschuld = useAtomValue(restschuldAtom);

  const ratesByTime = calculateTotalRatesByTimeframe([
    ...Object.values(credits ?? {}).flatMap((credit) => credit.rates),
    {
      startYear: 0,
      endYear: zinsbindung,
      rate: calculateMonthlyRate(nettoDarlehensbetrag, effzins, tilgungssatz),
      key: "bankrate",
    },
  ]);

  return (
    <Card className="mb-4 w-full max-w-xl">
      <CardHeader>
        <CardTitle>Ihre Kondition</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-2">
          <div className="flex flex-row flex-wrap justify-center gap-2">
            {ratesByTime.map((iRate, index) => (
              <div
                key={iRate.key + index}
                className="flex min-w-fit flex-col items-center"
              >
                <span className="text-base font-semibold text-green-300 sm:text-2xl">
                  {formatNumber(iRate.rate)}€
                </span>
                <span className="text-muted-foreground text-sm">
                  {iRate.startYear + 1} - {iRate.endYear} Jahre
                </span>
              </div>
            ))}
          </div>
          <div className="my-2 w-full border-t border-neutral-700" />
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Nettodarlehensbetrag bei der Bank <span title="Info">ⓘ</span>
            </span>
            <span>{formatNumber(nettoDarlehensbetrag)} €</span>
          </div>
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Gebundener Effektivzins p.a. <span title="Info">ⓘ</span>
            </span>
            <span className="flex items-center gap-2">
              <NumberInput
                value={effzins}
                onChange={(value) => setEffzins(value)}
              />
              %
            </span>
          </div>
          <div className="my-2 w-full border-t border-neutral-700" />
          {/* Restschuld nach x Jahren */}
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Restschuld nach {zinsbindung} Jahren <span title="Info">ⓘ</span>
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
              Bezahlte Zinsen nach {zinsbindung} Jahren{" "}
              <span title="Info">ⓘ</span>
            </span>
            <span>{formatNumber(bezahlteZinsen)} €</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
