"use client";

import { useAtomValue } from "jotai";
import { TopNav } from "~/components/top_nav";
import { Card, CardContent } from "~/components/ui/card";
import {
  calculateMonthlyRate,
  calculateTilgungszuschussBetrag,
} from "~/lib/calculations";
import { formatNumber } from "~/lib/number_fromat";
import { creditsAtom } from "~/state/credits_atom";
import {
  effzinsAtom,
  nettoDarlehensBetragAtom,
  restschuldBankAtom,
  tilgungssatzAtom,
  zinsbindungAtom,
} from "~/state/conditions_atoms";

export default function FinanzplanPage() {
  const credits = Object.values(useAtomValue(creditsAtom) ?? {});
  const nettoDarlehensbetragBank = useAtomValue(nettoDarlehensBetragAtom);
  const restschuldBank = useAtomValue(restschuldBankAtom);
  const effzins = useAtomValue(effzinsAtom);
  const tilgungssatz = useAtomValue(tilgungssatzAtom);
  const zinsbindung = useAtomValue(zinsbindungAtom);

  const bankMonatsrate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetragBank,
    effzins,
    tilgungssatz,
  });
  const bankMonate = Math.round(zinsbindung * 12);
  const bankBisherBezahlt = bankMonatsrate * bankMonate;
  const bankGetilgt = Math.max(0, nettoDarlehensbetragBank - restschuldBank);
  const bankZinsen = Math.max(0, bankBisherBezahlt - bankGetilgt);

  const creditsTotals = credits.reduce(
    (acc, credit) => {
      const tilgungszuschuss = calculateTilgungszuschussBetrag({
        darlehensbetrag: credit.summeDarlehen,
        foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
        tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
      });
      const rueckzahlungsRelevanterBetrag = Math.max(
        0,
        credit.summeDarlehen - tilgungszuschuss,
      );
      const restschuld = Math.max(0, credit.restSchuld);
      const getilgt = Math.max(0, rueckzahlungsRelevanterBetrag - restschuld);
      const bisherBezahlt = credit.rates.reduce((sum, rate) => {
        const monate = Math.max(0, rate.endYear - rate.startYear) * 12;
        return sum + rate.rate * monate;
      }, 0);
      const zinsen = Math.max(0, bisherBezahlt - getilgt);

      return {
        darlehen: acc.darlehen + rueckzahlungsRelevanterBetrag,
        restschuld: acc.restschuld + restschuld,
        zinsen: acc.zinsen + zinsen,
      };
    },
    { darlehen: 0, restschuld: 0, zinsen: 0 },
  );

  const gesamtdarlehen = nettoDarlehensbetragBank + creditsTotals.darlehen;
  const restschuldGesamt = restschuldBank + creditsTotals.restschuld;
  const getilgtGesamt = Math.max(0, gesamtdarlehen - restschuldGesamt);
  const zinsenGesamt = bankZinsen + creditsTotals.zinsen;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />
          <div className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2">
            <span className="text-sm text-neutral-200">Bisher getilgt</span>
            <span className="text-lg font-semibold text-green-300">
              {formatNumber(getilgtGesamt)} €
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2">
            <span className="text-sm text-neutral-200">Noch offen</span>
            <span className="text-lg font-semibold text-neutral-100">
              {formatNumber(restschuldGesamt)} €
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2">
            <span className="text-sm text-neutral-200">
              Bisher gezahlte Zinsen
            </span>
            <span className="text-lg font-semibold text-amber-300">
              {formatNumber(zinsenGesamt)} €
            </span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
