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
import { getCreditEndYear, isBridgeCredit } from "~/lib/credit";
import { creditsAtom } from "~/state/credits_atom";
import { TopNav } from "./top_nav";
import { ScenarioBar } from "./scenario_bar";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

function buildRefinancingEndYear({
  restschuld,
  startYear,
  effzins,
  tilgungssatz,
  analysisHorizonYears,
}: {
  restschuld: number;
  startYear: number;
  effzins: number;
  tilgungssatz: number;
  analysisHorizonYears: number;
}) {
  if (restschuld <= 0 || startYear >= analysisHorizonYears) return null;
  const monthlyRate = calculateMonthlyRate({
    darlehensbetrag: restschuld,
    effzins,
    tilgungssatz,
  });
  const payoff = calculateFullPaymentTime({
    darlehensbetrag: restschuld,
    monthlyRate,
    effzins,
  });
  if (!payoff.canBePaidOff) {
    return {
      monthlyRate,
      endYear: analysisHorizonYears,
    };
  }

  return {
    monthlyRate,
    endYear: Math.min(
      analysisHorizonYears,
      startYear + payoff.yearsAufgerundet,
    ),
  };
}

function formatDueTime(year: number) {
  const months = Math.round(year * 12);
  if (months < 12) {
    return `nach ${months} Monaten`;
  }
  if (months % 12 === 0) {
    return `in Jahr ${months / 12}`;
  }
  return `nach ${months} Monaten`;
}

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
  const [includeRefinancing, setIncludeRefinancing] = useAtom(
    includeRefinancingAtom,
  );
  const analysisHorizonYears = useAtomValue(analysisHorizonYearsAtom);
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
  const bankRestschuldAtBinding = calculateRestschuld({
    nettodarlehensbetrag: nettoDarlehensbetrag,
    monthlyRate: calculateMonthlyRate({
      darlehensbetrag: nettoDarlehensbetrag,
      effzins,
      tilgungssatz,
    }),
    effZins: effzins,
    years: zinsbindung,
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
    ...(includeRefinancing
      ? (() => {
          const segments: Array<{
            startYear: number;
            endYear: number;
            rate: number;
            key: string;
          }> = [];

          const bankRefinancing = buildRefinancingEndYear({
            restschuld: bankRestschuldAtBinding,
            startYear: zinsbindung,
            effzins,
            tilgungssatz,
            analysisHorizonYears,
          });

          if (bankRefinancing) {
            segments.push({
              startYear: zinsbindung,
              endYear: bankRefinancing.endYear,
              rate: bankRefinancing.monthlyRate,
              key: "bank_anschluss",
            });
          }

          Object.values(credits ?? {}).forEach((credit, index) => {
            if (isBridgeCredit(credit)) return;
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
            const restschuldAtBinding = calculateRestschuld({
              nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
              monthlyRate,
              effZins: credit.effektiverZinssatz,
              years: credit.zinsbindung,
              tilgungsfreieZeit: credit.tilgungsFreieZeit,
              rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
            });

            const refinancing = buildRefinancingEndYear({
              restschuld: restschuldAtBinding,
              startYear: credit.zinsbindung,
              effzins,
              tilgungssatz,
              analysisHorizonYears,
            });

            if (refinancing) {
              segments.push({
                startYear: credit.zinsbindung,
                endYear: refinancing.endYear,
                rate: refinancing.monthlyRate,
                key: `credit_${index}_anschluss`,
              });
            }
          });

          return segments;
        })()
      : []),
  ]);

  const dueAmountsWithoutRefinancing = Object.values(credits ?? {})
    .map((credit) => {
      if (isBridgeCredit(credit)) {
        return {
          name: credit.name,
          dueYear: getCreditEndYear(credit),
          dueAmount: credit.summeDarlehen,
        };
      }

      const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
        darlehensbetrag: credit.summeDarlehen,
        foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
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
      const dueAmount = calculateRestschuld({
        nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
        monthlyRate,
        effZins: credit.effektiverZinssatz,
        years: credit.zinsbindung,
        tilgungsfreieZeit: credit.tilgungsFreieZeit,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      return {
        name: credit.name,
        dueYear: credit.zinsbindung,
        dueAmount,
      };
    })
    .concat({
      name: "Bankkredit",
      dueYear: zinsbindung,
      dueAmount: bankRestschuldAtBinding,
    })
    .filter((item) => item.dueAmount > 0)
    .sort((a, b) => a.dueYear - b.dueYear);
  const totalDueWithoutRefinancing = dueAmountsWithoutRefinancing.reduce(
    (sum, item) => sum + item.dueAmount,
    0,
  );
  const earliestDueYear = dueAmountsWithoutRefinancing[0]?.dueYear ?? 0;

  return (
    <Card className="mb-4 w-full">
      <CardContent>
        <TopNav />
        <ScenarioBar />
        <div className="flex flex-col items-center py-2">
          <div className="grid w-full grid-cols-3 items-center justify-items-start gap-y-2 border-b border-dashed border-neutral-400 pb-2">
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
          </div>
          {!includeRefinancing && dueAmountsWithoutRefinancing.length > 0 && (
            <div className="mt-3 flex w-full gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {dueAmountsWithoutRefinancing.length === 1
                    ? "Anschlussfinanzierung erforderlich"
                    : `${dueAmountsWithoutRefinancing.length} Finanzierungen werden fällig`}
                </p>
                <p className="mt-0.5 text-sm text-amber-900">
                  {dueAmountsWithoutRefinancing.length === 1
                    ? `${formatNumber(totalDueWithoutRefinancing)} € werden ${formatDueTime(earliestDueYear)} fällig.`
                    : `Gesamte Restschuld: ${formatNumber(totalDueWithoutRefinancing)} €. Erste Fälligkeit ${formatDueTime(earliestDueYear)}.`}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-amber-900 text-white hover:bg-amber-800"
                    onClick={() => setIncludeRefinancing(true)}
                  >
                    Aktivieren
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                      >
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-neutral-300 bg-white text-black shadow-2xl sm:max-w-md">
                      <DialogTitle>Fällige Restschulden</DialogTitle>
                      <DialogDescription className="text-neutral-600">
                        Diese Beträge sind ohne Anschlussfinanzierung zum
                        jeweiligen Zeitpunkt vollständig fällig.
                      </DialogDescription>
                      <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
                        {dueAmountsWithoutRefinancing.map((item) => (
                          <div
                            key={`${item.name}-${item.dueYear}`}
                            className="flex items-start justify-between gap-4 p-3 text-sm"
                          >
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-neutral-500">
                                Fällig {formatDueTime(item.dueYear)}
                              </p>
                            </div>
                            <p className="shrink-0 font-semibold">
                              {formatNumber(item.dueAmount)} €
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between border-t border-neutral-200 pt-3 font-semibold">
                        <span>Gesamte Restschuld</span>
                        <span>
                          {formatNumber(totalDueWithoutRefinancing)} €
                        </span>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          )}

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
