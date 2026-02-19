"use client";

import { useAtomValue } from "jotai";
import { TopNav } from "~/components/top_nav";
import { Card, CardContent } from "~/components/ui/card";
import {
  calculateMonthlyRate,
  calculateRestschuld,
  calculateTilgungszuschussBetrag,
} from "~/lib/calculations";
import { formatNumber } from "~/lib/number_fromat";
import { creditsAtom } from "~/state/credits_atom";
import {
  effzinsAtom,
  nettoDarlehensBetragAtom,
  tilgungssatzAtom,
  zinsbindungAtom,
} from "~/state/conditions_atoms";

export default function FinanzplanPage() {
  const credits = Object.values(useAtomValue(creditsAtom) ?? {});
  const nettoDarlehensbetragBank = useAtomValue(nettoDarlehensBetragAtom);
  const effzins = useAtomValue(effzinsAtom);
  const tilgungssatz = useAtomValue(tilgungssatzAtom);
  const zinsbindung = useAtomValue(zinsbindungAtom);

  const bankMonatsrate = calculateMonthlyRate({
    darlehensbetrag: nettoDarlehensbetragBank,
    effzins,
    tilgungssatz,
  });

  const kreditRows = [
    {
      name: "Bankkredit",
      stichtag: zinsbindung,
      bisherBezahlt: bankMonatsrate * zinsbindung * 12,
      restschuld: calculateRestschuld({
        nettodarlehensbetrag: nettoDarlehensbetragBank,
        monthlyRate: bankMonatsrate,
        effZins: effzins,
        years: zinsbindung,
      }),
      darlehen: nettoDarlehensbetragBank,
    },
    ...credits.map((credit) => {
      const tilgungszuschuss = calculateTilgungszuschussBetrag({
        darlehensbetrag: credit.summeDarlehen,
        foerderfaehigerAnteilProzent: credit.foerderfaehigerAnteilProzent ?? 0,
        tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
      });
      const rueckzahlungsRelevanterBetrag = Math.max(
        0,
        credit.summeDarlehen - tilgungszuschuss,
      );
      const monthlyRate = calculateMonthlyRate({
        darlehensbetrag: rueckzahlungsRelevanterBetrag,
        effzins: credit.effektiverZinssatz,
        tilgungssatz: credit.tilgungssatz,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const restschuld = calculateRestschuld({
        nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
        monthlyRate,
        effZins: credit.effektiverZinssatz,
        years: credit.zinsbindung,
        tilgungsfreieZeit: credit.tilgungsFreieZeit,
        rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
      });
      const bisherBezahlt = credit.rates.reduce((sum, rate) => {
        const monate = Math.max(0, rate.endYear - rate.startYear) * 12;
        return sum + rate.rate * monate;
      }, 0);

      return {
        name: credit.name,
        stichtag: credit.zinsbindung,
        bisherBezahlt,
        restschuld,
        darlehen: rueckzahlungsRelevanterBetrag,
      };
    }),
  ].map((row) => {
    const getilgt = Math.max(0, row.darlehen - row.restschuld);
    const zinsen = Math.max(0, row.bisherBezahlt - getilgt);
    const durchschnittMonatlicheZinsen =
      row.stichtag > 0 ? zinsen / (row.stichtag * 12) : 0;

    return {
      ...row,
      getilgt,
      zinsen,
      durchschnittMonatlicheZinsen,
    };
  });

  const stichtage = Array.from(
    new Set([zinsbindung, ...credits.map((credit) => credit.zinsbindung)]),
  )
    .filter((years) => years > 0)
    .sort((a, b) => a - b);

  const finanzplanRows = stichtage.map((stichtag) => {
    const bankYears = Math.min(stichtag, zinsbindung);
    const bankBisherBezahlt = bankMonatsrate * bankYears * 12;
    const bankRestschuld = calculateRestschuld({
      nettodarlehensbetrag: nettoDarlehensbetragBank,
      monthlyRate: bankMonatsrate,
      effZins: effzins,
      years: bankYears,
    });
    const bankGetilgt = Math.max(0, nettoDarlehensbetragBank - bankRestschuld);
    const bankZinsen = Math.max(0, bankBisherBezahlt - bankGetilgt);

    const creditsTotals = credits.reduce(
      (acc, credit) => {
        const creditYears = Math.min(stichtag, credit.zinsbindung);
        const tilgungszuschuss = calculateTilgungszuschussBetrag({
          darlehensbetrag: credit.summeDarlehen,
          foerderfaehigerAnteilProzent:
            credit.foerderfaehigerAnteilProzent ?? 0,
          tilgungszuschussProzent: credit.tilgungszuschussProzent ?? 0,
        });
        const rueckzahlungsRelevanterBetrag = Math.max(
          0,
          credit.summeDarlehen - tilgungszuschuss,
        );
        const monthlyRate = calculateMonthlyRate({
          darlehensbetrag: rueckzahlungsRelevanterBetrag,
          effzins: credit.effektiverZinssatz,
          tilgungssatz: credit.tilgungssatz,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const restschuld = calculateRestschuld({
          nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
          monthlyRate,
          effZins: credit.effektiverZinssatz,
          years: creditYears,
          tilgungsfreieZeit: credit.tilgungsFreieZeit,
          rückzahlungsfreieZeit: credit.rückzahlungsfreieZeit,
        });
        const bisherBezahlt = credit.rates.reduce((sum, rate) => {
          const endYearInRange = Math.min(rate.endYear, creditYears);
          if (endYearInRange <= rate.startYear) {
            return sum;
          }
          const monate = (endYearInRange - rate.startYear) * 12;
          return sum + rate.rate * monate;
        }, 0);
        const getilgt = Math.max(0, rueckzahlungsRelevanterBetrag - restschuld);
        const zinsen = Math.max(0, bisherBezahlt - getilgt);

        return {
          bisherBezahlt: acc.bisherBezahlt + bisherBezahlt,
          darlehen: acc.darlehen + rueckzahlungsRelevanterBetrag,
          restschuld: acc.restschuld + restschuld,
          zinsen: acc.zinsen + zinsen,
        };
      },
      { bisherBezahlt: 0, darlehen: 0, restschuld: 0, zinsen: 0 },
    );

    const bisherBezahltGesamt = bankBisherBezahlt + creditsTotals.bisherBezahlt;
    const gesamtdarlehen = nettoDarlehensbetragBank + creditsTotals.darlehen;
    const restschuldGesamt = bankRestschuld + creditsTotals.restschuld;
    const getilgtGesamt = Math.max(0, gesamtdarlehen - restschuldGesamt);
    const zinsenGesamt = bankZinsen + creditsTotals.zinsen;
    const durchschnittMonatlicheZinsen =
      stichtag > 0 ? zinsenGesamt / (stichtag * 12) : 0;

    return {
      stichtag,
      bisherBezahltGesamt,
      getilgtGesamt,
      restschuldGesamt,
      zinsenGesamt,
      durchschnittMonatlicheZinsen,
    };
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />
          <p className="text-sm text-neutral-700">
            Einzelrechnung je Kredit bis zur jeweiligen Zinsbindung.
          </p>
          <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-300">
                  <th className="px-3 py-2 font-medium">Kredit</th>
                  <th className="px-3 py-2 font-medium">Stichtag</th>
                  <th className="px-3 py-2 font-medium">Bisher bezahlt</th>
                  <th className="px-3 py-2 font-medium">Bisher getilgt</th>
                  <th className="px-3 py-2 font-medium">Noch offen</th>
                  <th className="px-3 py-2 font-medium">Bisher Zinsen</th>
                  <th className="px-3 py-2 font-medium">Ø Zinsen / Monat</th>
                </tr>
              </thead>
              <tbody>
                {kreditRows.map((row) => (
                  <tr
                    key={`${row.name}-${row.stichtag}`}
                    className="border-b border-neutral-700/60"
                  >
                    <td className="px-3 py-2 text-neutral-100">{row.name}</td>
                    <td className="px-3 py-2 text-neutral-100">
                      {row.stichtag} Jahre
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.bisherBezahlt)} €
                    </td>
                    <td className="px-3 py-2 text-green-300">
                      {formatNumber(row.getilgt)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.restschuld)} €
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      {formatNumber(row.zinsen)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.durchschnittMonatlicheZinsen)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-neutral-700">
            Je Stichtag wird pro Kredit maximal bis zu seiner Zinsbindung
            gerechnet. Danach bleiben die Werte eingefroren (ohne
            Anschlussfinanzierung).
          </p>
          <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-300">
                  <th className="px-3 py-2 font-medium">Stichtag</th>
                  <th className="px-3 py-2 font-medium">Bisher bezahlt</th>
                  <th className="px-3 py-2 font-medium">Bisher getilgt</th>
                  <th className="px-3 py-2 font-medium">Noch offen</th>
                  <th className="px-3 py-2 font-medium">Bisher Zinsen</th>
                  <th className="px-3 py-2 font-medium">Ø Zinsen / Monat</th>
                </tr>
              </thead>
              <tbody>
                {finanzplanRows.map((row) => (
                  <tr
                    key={row.stichtag}
                    className="border-b border-neutral-700/60"
                  >
                    <td className="px-3 py-2 text-neutral-100">
                      {row.stichtag} Jahre
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.bisherBezahltGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-green-300">
                      {formatNumber(row.getilgtGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.restschuldGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      {formatNumber(row.zinsenGesamt)} €
                    </td>
                    <td className="px-3 py-2 text-neutral-100">
                      {formatNumber(row.durchschnittMonatlicheZinsen)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
