"use client";

import { useAtomValue, useAtom } from "jotai";
import { Card, CardContent } from "~/components/ui/card";
import { formatNumber } from "~/lib/number_fromat";
import {
  nettoDarlehensBetragAtom,
  effzinsAtom,
  restschuldBankAtom,
  zinsbindungAtom,
  tilgungssatzAtom,
} from "~/state/conditions_atoms";
import { PercentInput } from "./ui/percent_input";
import {
  calculateMonthlyRate,
  calculateRestschuld,
  calculateTilgungszuschussBetrag,
  calculateTotalRatesByTimeframe,
  calculateFullPaymentTime,
} from "~/lib/calculations";
import { creditsAtom } from "~/state/credits_atom";
import { TopNav } from "./top_nav";
import { ScenarioBar } from "./scenario_bar";

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

  const bankMonatsrate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetrag,
    effzins,
    tilgungssatz,
  });

  const restSchuldByTime = Array.from(
    new Set([
      zinsbindung,
      ...Object.values(credits ?? {}).map((credit) => credit.zinsbindung),
    ]),
  )
    .filter((stichtag) => stichtag > 0)
    .sort((a, b) => a - b)
    .map((stichtag) => {
      const bankRestschuld = calculateRestschuld({
        nettodarlehensbetrag: nettoDarlehensbetrag,
        monthlyRate: bankMonatsrate,
        effZins: effzins,
        years: Math.min(stichtag, zinsbindung),
      });

      const restschuldCredits = Object.values(credits ?? {}).reduce(
        (sum, credit) => {
          const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
            darlehensbetrag: credit.summeDarlehen,
            foerderfaehigerAnteilProzent:
              credit.foerderfaehigerAnteilProzent ?? 0,
            tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
          });
          const rueckzahlungsRelevanterBetrag = Math.max(
            0,
            credit.summeDarlehen - tilgungszuschussBetrag,
          );
          const monthlyRate = calculateMonthlyRate({
            darlehensbetrag: rueckzahlungsRelevanterBetrag,
            effzins: credit.effektiverZinssatz,
            tilgungssatz: credit.tilgungssatz,
            rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
          });

          return (
            sum +
            calculateRestschuld({
              nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
              monthlyRate,
              effZins: credit.effektiverZinssatz,
              years: Math.min(stichtag, credit.zinsbindung),
              tilgungsfreieZeit: credit.tilgungsFreieZeit,
              rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
            })
          );
        },
        0,
      );

      return {
        endYear: stichtag,
        restschuld: bankRestschuld + restschuldCredits,
      };
    });

  const restschuldGesamtStichtag =
    restSchuldByTime.find((item) => item.endYear === zinsbindung)?.restschuld ??
    restSchuldByTime[restSchuldByTime.length - 1]?.restschuld ??
    0;

  const showRestschulden = restSchuldByTime.length > 1;

  return (
    <Card className="mb-4 w-full">
      <CardContent>
        <TopNav />
        <ScenarioBar />
        <div className="flex flex-col items-center py-2">
          <div className="relative grid w-full grid-cols-3 grid-rows-2 items-center justify-items-start gap-y-2 before:absolute before:top-1/2 before:right-0 before:left-0 before:-translate-y-1/2 before:border-t before:border-dashed before:border-neutral-700 before:content-['']">
            {/* Raten header*/}
            <h3 className="text-center">Raten </h3>
            {/* Raten */}
            <div className="col-span-2 flex w-full flex-row flex-wrap justify-start gap-2">
              {ratesByTime.map((iRate, index) => (
                <div
                  key={iRate.key + index}
                  className="flex min-w-fit flex-col items-start"
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
            {/* Restschulden header*/}
            <h3 className={`text-sm ${showRestschulden ? "" : "hidden"}`}>
              Restschulden
            </h3>
            {/* Restschulden */}
            <div
              className={`col-span-2 flex w-full flex-row flex-wrap justify-start gap-2 ${showRestschulden ? "" : "hidden"}`}
            >
              {restSchuldByTime
                .sort((a, b) => a.endYear - b.endYear)
                .map((iRestSchuld, index) => (
                  <div
                    key={iRestSchuld.endYear + index}
                    className="flex min-w-fit flex-col items-start"
                  >
                    <span className="text-sm">
                      {formatNumber(iRestSchuld.restschuld)}€
                    </span>
                    <p className="text-muted-foreground text-sm">
                      {iRestSchuld.endYear} Jahre
                    </p>
                  </div>
                ))}
            </div>
          </div>
          <div className="flex w-full flex-row items-center gap-2"></div>
          <div className="flex w-full items-center gap-2">
            <div className="flex w-full flex-col items-center gap-2">
              <p className="text-muted-foreground text-sm">
                Restschuld gesamt nach {zinsbindung} Jahren:{" "}
                {formatNumber(restschuldGesamtStichtag)}€
              </p>
            </div>
          </div>

          <div className="my-2 w-full border-t border-neutral-700" />
          <h2 className="w-full justify-self-start font-semibold">
            Konditionen bei der Bank
          </h2>
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Nettodarlehensbetrag bei der Bank
              {/* <span title="Info">ⓘ</span> */}
            </span>
            <span>{formatNumber(nettoDarlehensbetrag)} €</span>
          </div>
          <div className="flex w-full justify-between py-2 text-sm">
            <div className="flex items-center gap-1">
              Gebundener Effektivzins p.a.
              {/* <span title="Info">ⓘ</span> */}
            </div>
            <div className="w-32">
              <PercentInput
                value={effzins}
                onChange={(value) => setEffzins(value)}
              />
            </div>
          </div>
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">Sollzinsbindung</span>
            <select
              className="w-32 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
              value={zinsbindung}
              onChange={(e) => setzinsbindung(Number(e.target.value))}
            >
              <option value={5}>5 Jahre</option>
              <option value={10}>10 Jahre</option>
              <option value={15}>15 Jahre</option>
              <option value={20}>20 Jahre</option>
            </select>
          </div>
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">Tilgungssatz</span>
            <select
              className="w-32 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
              value={tilgungssatz}
              onChange={(e) => setTilgungssatz(Number(e.target.value))}
            >
              <option value={1}>1,00 %</option>
              <option value={1.5}>1,50 %</option>
              <option value={2}>2,00 %</option>
              <option value={2.5}>2,50 %</option>
              <option value={3}>3,00 %</option>
            </select>
          </div>

          {/* <div className="my-2 w-full border-t border-neutral-700" /> */}
          {/* Restschuld nach x Jahren */}
          <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Restschuld nach {zinsbindung} Jahren
              {/* <span title="Info">ⓘ</span> */}
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
