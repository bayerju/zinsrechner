"use client";

import { useAtomValue, useAtom } from "jotai";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { formatNumber } from "~/lib/number_fromat";
import {
  nettoDarlehensBetragAtom,
  effzinsAtom,
  restschuldBankAtom,
  zinsbindungAtom,
  fullPaymentAtom,
  bezahlteZinsenAtom,
  tilgungssatzAtom,
} from "~/state/conditions_atoms";
import { NumberInput } from "./ui/number_input";
import {
  calculateMonthlyRate,
  calculateRestschuldByTimeframe,
  calculateTotalRatesByTimeframe,
  calculateFullPaymentTime,
  calculateTotalInterest,
} from "~/lib/calculations";
import { creditsAtom } from "~/state/credits_atom";
import { Switch } from "./ui/switch";
import { InfoHover } from "./info_hover";

export default function InfosHeader() {
  const [effzins, setEffzins] = useAtom(effzinsAtom);
  // const zinsbindung = useAtomValue(zinsbindungAtom);
  const [zinsbindung, setzinsbindung] = useAtom(zinsbindungAtom);
  const [tilgungssatz, setTilgungssatz] = useAtom(tilgungssatzAtom);
  // const fullPayment = useAtomValue(fullPaymentAtom);
  // const bezahlteZinsen = useAtomValue(bezahlteZinsenAtom);
  // const bezahlteZinsen = calculateTotalInterest(
  //   calculateMonthlyRate({
  //     darlehensbetrag: nettoDarlehensbetrag,
  //     effzins: effzins,
  //     tilgungssatz: tilgungssatz,
  //   }),
  // );
  const credits = useAtomValue(creditsAtom);
  // const tilgungssatz = useAtomValue(tilgungssatzAtom);

  const nettoDarlehensbetrag = useAtomValue(nettoDarlehensBetragAtom);
  const restschuldBank = useAtomValue(restschuldBankAtom);

  const fullPayment = calculateFullPaymentTime({
    darlehensbetrag: nettoDarlehensbetrag,
    monthlyRate: calculateMonthlyRate({
      darlehensbetrag: nettoDarlehensbetrag,
      effzins: effzins,
      tilgungssatz: tilgungssatz,
    }),
    effzins: effzins,
  });
  const ratesByTime = calculateTotalRatesByTimeframe([
    ...Object.values(credits ?? {}).flatMap((credit) => credit.rates),
    {
      startYear: 0,
      endYear: zinsbindung,
      rate: calculateMonthlyRate({
        darlehensbetrag: nettoDarlehensbetrag,
        effzins: effzins,
        tilgungssatz: tilgungssatz,
      }),
      key: "bankrate",
    },
  ]);

  const restSchuldByTime = calculateRestschuldByTimeframe([
    ...Object.values(credits ?? {}),
    {
      zinsbindung: zinsbindung,
      restSchuld: restschuldBank,
    },
  ]);

  return (
    <Card className="mb-4 w-full max-w-xl">
      <CardHeader>
        <CardTitle>
          <div className="flex w-full flex-row items-center justify-between">
            <h2>Ihre Kondition</h2>
            {/* <div>
              <span className="text-muted-foreground text-sm">
                Anschlussfinanzierung{" "}
                <InfoHover content="Anschlussfinanzierung automatisch an abgelaufene Zinsbindung anschließen mit 3,5% Effektivem Jahreszins" />
              </span>
              <Switch />
            </div> */}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-2">
          <div className="flex w-full flex-row items-center gap-2">
            <h3 className="text-sm">Raten </h3>
            <div className="flex w-full flex-row flex-wrap justify-center gap-2">
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
          </div>
          <div className="my-2 w-full border-t border-dashed border-neutral-700" />
          <div className="flex w-full items-center gap-2">
            <h3 className="text-center text-sm">Restschulden </h3>
            <div className="flex w-full flex-col items-center gap-2">
              <div className="flex w-full flex-row flex-wrap justify-around gap-2">
                {restSchuldByTime
                  .sort((a, b) => a.endYear - b.endYear)
                  .map((iRestSchuld, index) => (
                    <div
                      key={iRestSchuld.endYear + index}
                      className="flex min-w-fit flex-col items-center"
                    >
                      <p className="text-muted-foreground text-sm">
                        {iRestSchuld.endYear} Jahre
                      </p>
                      <span className="">
                        {formatNumber(iRestSchuld.restschuld)}€
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-muted-foreground text-sm">
                Restschluden gesamt:{" "}
                {formatNumber(
                  restSchuldByTime.reduce(
                    (acc, iRestSchuld) => acc + iRestSchuld.restschuld,
                    0,
                  ),
                )}
                €
              </p>
            </div>
          </div>

          <div className="my-2 w-full border-t border-neutral-700" />
          <h2 className="w-full justify-self-start font-semibold">
            Konditionen bei der Bank
          </h2>
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
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Sollzinsbindung
            </span>
            <span className="flex items-center gap-2">
              <select
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={zinsbindung}
                onChange={(e) => setzinsbindung(Number(e.target.value))}
              >
                <option value={5}>5 Jahre</option>
                <option value={10}>10 Jahre</option>
                <option value={15}>15 Jahre</option>
                <option value={20}>20 Jahre</option>
              </select>
            </span>
          </div>
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Tilgungssatz
            </span>
            <span className="flex items-center gap-2">
              <select
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                value={tilgungssatz}
                onChange={(e) => setTilgungssatz(Number(e.target.value))}
              >
                <option value={1}>1,00 %</option>
                <option value={1.5}>1,50 %</option>
                <option value={2}>2,00 %</option>
                <option value={2.5}>2,50 %</option>
                <option value={3}>3,00 %</option>
              </select>
            </span>
          </div>

          {/* <div className="my-2 w-full border-t border-neutral-700" /> */}
          {/* Restschuld nach x Jahren */}
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Restschuld nach {zinsbindung} Jahren <span title="Info">ⓘ</span>
            </span>
            <span>{formatNumber(restschuldBank)} €</span>
          </div>
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Bankkredit vollständig abbezahlt nach{" "}
              {fullPayment.canBePaidOff
                ? `${fullPayment.yearsAufgerundet} Jahren`
                : "nie (Rate zu niedrig)"}
            </span>
          </div>
          {/* <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Bezahlte Zinsen nach {zinsbindung} Jahren{" "}
              <span title="Info">ⓘ</span>
            </span>
            <span>{formatNumber(bezahlteZinsen)} €</span>
          </div> */}
        </div>
      </CardContent>
    </Card>
  );
}
