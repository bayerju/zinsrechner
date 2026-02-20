import { atom } from "jotai";
import { creditsAtom } from "./credits_atom";
import { createScenarioFieldAtom } from "./scenario_values_atom";
import {
  calculateMonthlyRate,
  calculateNettodarlehensbetragBank,
  calculateRestschuld,
} from "~/lib/calculations";

export const effzinsAtom = createScenarioFieldAtom("effzins");
export const kaufpreisAtom = createScenarioFieldAtom("kaufpreis");
export const modernisierungskostenAtom = createScenarioFieldAtom(
  "modernisierungskosten",
);
export const eigenkapitalAtom = createScenarioFieldAtom("eigenkapital");
export const kaufnebenkostenAtom = atom<number>((get) => {
  return get(kaufpreisAtom) * 0.1207;
});
export const tilgungssatzAtom = createScenarioFieldAtom("tilgungssatz");
export const zinsbindungAtom = createScenarioFieldAtom("zinsbindung");

export const nettoDarlehensBetragAtom = atom<number>((get) =>
  calculateNettodarlehensbetragBank({
    kaufpreis: get(kaufpreisAtom),
    modernisierungskosten: get(modernisierungskostenAtom),
    kaufnebenkosten: get(kaufnebenkostenAtom),
    eigenkapital: get(eigenkapitalAtom),
    credits: Object.values(get(creditsAtom) ?? {}),
  }),
);
export const restschuldBankAtom = atom<number>((get) =>
  calculateRestschuld({
    nettodarlehensbetrag: get(nettoDarlehensBetragAtom),
    monthlyRate: calculateMonthlyRate({
      darlehensbetrag: get(nettoDarlehensBetragAtom),
      effzins: get(effzinsAtom),
      tilgungssatz: get(tilgungssatzAtom),
    }),
    effZins: get(effzinsAtom),
    years: get(zinsbindungAtom),
  }),
);

export const fullPaymentAtom = atom<{
  canBePaidOff: boolean;
  years: number;
  months: number;
}>({ canBePaidOff: false, years: 0, months: 0 });
export const bezahlteZinsenAtom = atom<number>(0);
