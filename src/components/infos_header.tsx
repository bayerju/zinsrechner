"use client";

import type { ReactNode } from "react";
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
import { isBridgeCredit } from "~/lib/credit";
import { creditsAtom } from "~/state/credits_atom";
import { TopNav } from "./top_nav";
import { ScenarioBar } from "./scenario_bar";
import {
  analysisHorizonYearsAtom,
  includeRefinancingAtom,
} from "~/state/analysis_settings_atom";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

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
  const yearsWithinHorizon = analysisHorizonYears - startYear;
  const remainingDebtAtHorizon = calculateRestschuld({
    nettodarlehensbetrag: restschuld,
    monthlyRate,
    effZins: effzins,
    years: yearsWithinHorizon,
  });
  if (!payoff.canBePaidOff) {
    return {
      monthlyRate,
      endYear: analysisHorizonYears,
      paidOffWithinHorizon: false,
      projectedPayoffYear: null,
      remainingDebtAtHorizon,
    };
  }

  const payoffYear = startYear + payoff.yearsAufgerundet;
  return {
    monthlyRate,
    endYear: Math.min(analysisHorizonYears, payoffYear),
    paidOffWithinHorizon: payoffYear <= analysisHorizonYears,
    projectedPayoffYear: payoffYear,
    remainingDebtAtHorizon:
      payoffYear <= analysisHorizonYears ? 0 : remainingDebtAtHorizon,
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatYear(year: number) {
  return Number.isInteger(year) ? year.toString() : year.toFixed(1);
}

type RefinancingDetail = {
  key: string;
  name: string;
  amount: number;
  startYear: number;
  endYear: number;
  paidOffWithinHorizon: boolean;
  projectedPayoffYear: number | null;
  remainingDebtAtHorizon: number;
};

type DueAmountDetail = {
  name: string;
  dueYear: number;
  dueAmount: number;
};

function RestschuldWarningPopover({
  title,
  description,
  ariaLabel,
  children,
  widthClassName = "w-72",
}: {
  title: string;
  description: ReactNode;
  ariaLabel: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-600 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
          title={title}
          aria-label={ariaLabel}
        >
          <AlertTriangle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={`${widthClassName} border-amber-300 bg-amber-50 p-3 text-sm text-amber-950`}
      >
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-amber-900">{description}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function RefinancingAssumptionInfo({
  details,
}: {
  details: RefinancingDetail[];
}) {
  const explanation =
    "Für diesen Zeitraum wird angenommen, dass Effektivzins und Tilgungssatz nach der Zinsbindung unverändert bleiben.";

  return (
    <RestschuldWarningPopover
      title="Angenommene Weiterfinanzierung"
      description={explanation}
      ariaLabel="Annahme zur Weiterfinanzierung anzeigen"
    >
      <div className="mt-3 divide-y divide-amber-200 rounded-md border border-amber-200 bg-white/70">
        {details.map((detail) => (
          <div key={detail.key} className="p-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{detail.name}</p>
              <p className="shrink-0 font-semibold">
                {formatNumber(detail.amount)} €
              </p>
            </div>
            <p className="mt-0.5 text-xs text-amber-800">
              Weiterfinanziert ab Jahr {formatYear(detail.startYear)} ·{" "}
              {detail.paidOffWithinHorizon
                ? `berechnet abbezahlt in Jahr ${formatYear(detail.endYear)}`
                : detail.projectedPayoffYear
                  ? `voraussichtlich abbezahlt in Jahr ${formatYear(detail.projectedPayoffYear)}`
                  : "mit dieser Rate nicht vollständig tilgbar"}
            </p>
            {!detail.paidOffWithinHorizon && (
              <div className="mt-1.5 rounded bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
                <span className="block">
                  Restschuld am Ende der Betrachtungszeit (Jahr{" "}
                  {formatYear(detail.endYear)}):
                </span>
                <span className="font-semibold">
                  {formatNumber(detail.remainingDebtAtHorizon)} €
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </RestschuldWarningPopover>
  );
}

function DueRestschuldInfo({
  details,
  totalDue,
  earliestDueYear,
  actionLabel,
  onIncludeRefinancing,
}: {
  details: DueAmountDetail[];
  totalDue: number;
  earliestDueYear: number;
  actionLabel: string;
  onIncludeRefinancing: () => void;
}) {
  const label =
    details.length === 1
      ? `${formatNumber(totalDue)} € bleiben offen`
      : `${formatNumber(totalDue)} € bleiben insgesamt offen`;

  const description =
    details.length === 1
      ? `${capitalize(formatDueTime(earliestDueYear))} ist für diesen Betrag eine weitere Finanzierung nötig.`
      : `Die erste Restschuld wird ${formatDueTime(earliestDueYear)} fällig. Dafür ist eine weitere Finanzierung nötig.`;

  return (
    <RestschuldWarningPopover
      title={label}
      description={description}
      ariaLabel="Fällige Restschulden anzeigen"
      widthClassName="w-80"
    >
      <div className="mt-3 divide-y divide-amber-200 rounded-md border border-amber-200 bg-white/70">
        {details.map((item) => (
          <div
            key={`${item.name}-${item.dueYear}`}
            className="flex items-start justify-between gap-4 p-2.5"
          >
            <div className="min-w-0">
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-amber-800">
                Fällig {formatDueTime(item.dueYear)}
              </p>
            </div>
            <p className="shrink-0 font-semibold">
              {formatNumber(item.dueAmount)} €
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-amber-200 pt-3 font-semibold">
        <span>Gesamte Restschuld</span>
        <span>{formatNumber(totalDue)} €</span>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full bg-amber-900 text-white hover:bg-amber-800"
        onClick={onIncludeRefinancing}
      >
        {actionLabel}
      </Button>
    </RestschuldWarningPopover>
  );
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
  const bankMonthlyRate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetrag,
    effzins,
    tilgungssatz,
  });

  const fullPayment = calculateFullPaymentTime({
    darlehensbetrag: nettoDarlehensbetrag,
    monthlyRate: bankMonthlyRate,
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

  const refinancingDetails: RefinancingDetail[] = [];
  const individualRates = [
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
            refinancingDetails.push({
              key: "bank_anschluss",
              name: "Bankkredit",
              amount: bankRestschuldAtBinding,
              startYear: zinsbindung,
              endYear: bankRefinancing.endYear,
              paidOffWithinHorizon: bankRefinancing.paidOffWithinHorizon,
              projectedPayoffYear: bankRefinancing.projectedPayoffYear,
              remainingDebtAtHorizon: bankRefinancing.remainingDebtAtHorizon,
            });
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
              const key = `credit_${index}_anschluss`;
              refinancingDetails.push({
                key,
                name: credit.name,
                amount: restschuldAtBinding,
                startYear: credit.zinsbindung,
                endYear: refinancing.endYear,
                paidOffWithinHorizon: refinancing.paidOffWithinHorizon,
                projectedPayoffYear: refinancing.projectedPayoffYear,
                remainingDebtAtHorizon: refinancing.remainingDebtAtHorizon,
              });
              segments.push({
                startYear: credit.zinsbindung,
                endYear: refinancing.endYear,
                rate: refinancing.monthlyRate,
                key,
              });
            }
          });

          return segments;
        })()
      : []),
  ];
  const ratesByTime = calculateTotalRatesByTimeframe(individualRates);

  function getRefinancingDetailsForPeriod(startYear: number, endYear: number) {
    return refinancingDetails.filter(
      (detail) => detail.startYear <= startYear && detail.endYear >= endYear,
    );
  }

  function getDueAmountsForPeriod(endYear: number) {
    return dueAmountsWithoutRefinancing.filter(
      (item) => item.dueYear === endYear,
    );
  }

  const dueAmountsWithoutRefinancing = Object.values(credits ?? {})
    .filter((credit) => !isBridgeCredit(credit))
    .map((credit) => {
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
  const dueWarningCount = new Set(
    dueAmountsWithoutRefinancing.map((item) => item.dueYear),
  ).size;
  return (
    <Card className="mb-4 w-full">
      <CardContent>
        <TopNav />
        <div className="lg:mx-auto lg:max-w-5xl">
          <ScenarioBar />
          <div className="flex flex-col items-center py-2">
            <div className="grid w-full grid-cols-3 items-center justify-items-start gap-y-2 border-b border-dashed border-neutral-400 pb-2 lg:grid-cols-[160px_minmax(0,1fr)] lg:rounded-lg lg:border lg:border-solid lg:border-neutral-200 lg:bg-neutral-50 lg:p-4">
              {/* Raten header*/}
              <h3 className="text-center lg:text-left lg:font-semibold">
                Raten
              </h3>
              {/* Raten */}
              <div className="col-span-2 flex w-full flex-row flex-wrap justify-start gap-2 lg:col-span-1">
                {ratesByTime.map((iRate, index) =>
                  (() => {
                    const refinancingDetailsForPeriod =
                      getRefinancingDetailsForPeriod(
                        iRate.startYear,
                        iRate.endYear,
                      );
                    const dueAmountsForPeriod = includeRefinancing
                      ? []
                      : getDueAmountsForPeriod(iRate.endYear);
                    const totalDueForPeriod = dueAmountsForPeriod.reduce(
                      (sum, item) => sum + item.dueAmount,
                      0,
                    );
                    return (
                      <div
                        key={iRate.key + index}
                        className="flex min-w-fit flex-col items-start"
                      >
                        <span className="flex items-center gap-1">
                          <span className="text-base font-semibold text-green-300 sm:text-2xl lg:text-green-600">
                            {formatNumber(iRate.rate)}€
                          </span>
                          {refinancingDetailsForPeriod.length > 0 && (
                            <RefinancingAssumptionInfo
                              details={refinancingDetailsForPeriod}
                            />
                          )}
                          {dueAmountsForPeriod.length > 0 && (
                            <DueRestschuldInfo
                              details={dueAmountsForPeriod}
                              totalDue={totalDueForPeriod}
                              earliestDueYear={iRate.endYear}
                              actionLabel={
                                dueWarningCount > 1
                                  ? "Alle Restschulden einrechnen"
                                  : dueAmountsForPeriod.length > 1
                                    ? "Restschulden einrechnen"
                                    : "Restschuld einrechnen"
                              }
                              onIncludeRefinancing={() =>
                                setIncludeRefinancing(true)
                              }
                            />
                          )}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {iRate.startYear + 1} - {iRate.endYear} Jahre
                        </span>
                      </div>
                    );
                  })(),
                )}
              </div>
            </div>
            <div className="my-2 w-full border-t border-neutral-700" />
            <div className="w-full lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-1 lg:rounded-lg lg:border lg:border-neutral-200 lg:bg-neutral-50 lg:p-4">
              <h2 className="w-full justify-self-start font-semibold lg:col-span-2 lg:mb-2">
                Konditionen bei der Bank
              </h2>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2 text-sm">
                <span className="min-w-0">
                  Nettodarlehensbetrag bei der Bank
                  {/* <span title="Info">ⓘ</span> */}
                </span>
                <span className="text-right font-medium whitespace-nowrap">
                  {formatNumber(nettoDarlehensbetrag)} €
                </span>
              </div>
              <div className="flex w-full flex-col gap-1.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1">
                  Gebundener Effektivzins p.a.
                  {/* <span title="Info">ⓘ</span> */}
                </div>
                <div className="w-full sm:w-32">
                  <PercentInput
                    value={effzins}
                    onChange={(value) => setEffzins(value)}
                  />
                </div>
              </div>
              <div className="flex w-full flex-col gap-1.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1">Sollzinsbindung</span>
                <select
                  className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white sm:h-auto sm:w-32"
                  value={zinsbindung}
                  onChange={(e) => setzinsbindung(Number(e.target.value))}
                >
                  <option value={5}>5 Jahre</option>
                  <option value={10}>10 Jahre</option>
                  <option value={15}>15 Jahre</option>
                  <option value={20}>20 Jahre</option>
                </select>
              </div>
              <div className="flex w-full flex-col gap-1.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1">Tilgungssatz</span>
                <select
                  className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white sm:h-auto sm:w-32"
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
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-neutral-200 py-3 text-sm lg:mt-2">
                <span className="min-w-0">
                  Restschuld nach {zinsbindung} Jahren
                  {/* <span title="Info">ⓘ</span> */}
                </span>
                <span className="text-right font-medium whitespace-nowrap">
                  {formatNumber(restschuldBank)} €
                </span>
              </div>
              <div className="mt-1 flex w-full items-start justify-between gap-2 text-sm lg:mt-2 lg:border-t lg:border-neutral-200 lg:pt-3">
                <span className="min-w-0">
                  Langfristige Tilgungsprognose:{" "}
                  <span className="font-medium">
                    {fullPayment.canBePaidOff
                      ? `ca. ${fullPayment.yearsAufgerundet} Jahre`
                      : "nicht vollständig tilgbar"}
                  </span>
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                      title="Annahmen zur langfristigen Tilgungsprognose anzeigen"
                      aria-label="Annahmen zur langfristigen Tilgungsprognose anzeigen"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-72 border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"
                  >
                    <p className="font-medium">Langfristige Tilgungsprognose</p>
                    <p className="mt-1 text-blue-900">
                      Wenn die aktuelle monatliche Rate von{" "}
                      {formatNumber(bankMonthlyRate)} € und der Effektivzins
                      unverändert blieben, wäre der Bankkredit{" "}
                      {fullPayment.canBePaidOff
                        ? `nach etwa ${fullPayment.yearsAufgerundet} Jahren vollständig abbezahlt.`
                        : "mit dieser Rate nicht vollständig abzahlbar."}
                    </p>
                    <p className="mt-2 text-xs text-blue-700">
                      Bei einer Weiterfinanzierung wird die Rate nach der
                      Zinsbindung anhand der verbleibenden Restschuld neu
                      berechnet. Deshalb kann dort ein anderes Tilgungsjahr
                      entstehen.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* <div className="flex w-full justify-between py-2 text-sm">
            <span className="flex items-center gap-1">
              Bezahlte Zinsen nach {zinsbindung} Jahren{" "}
              <span title="Info">ⓘ</span>
            </span>
            <span>{formatNumber(bezahlteZinsen)} €</span>
          </div> */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
