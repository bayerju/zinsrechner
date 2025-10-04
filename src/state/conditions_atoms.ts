import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { creditsAtom } from "./credits_atom";
import {
  calculateMonthlyRate,
  calculateNettodarlehensbetragBank,
  calculateRestschuld,
} from "~/lib/calculations";

export const effzinsAtom = atomWithStorage<number>("effzins", 3.7, undefined, {getOnInit: true});
export const kaufpreisAtom = atomWithStorage<number>("kaufpreis", 330_000, undefined, {getOnInit: true});
export const modernisierungskostenAtom = atomWithStorage<number>(
  "modernisierungskosten",
  100_000,
  undefined,
  {getOnInit: true},
);
export const eigenkapitalAtom = atomWithStorage<number>("eigenkapital", 100_000, undefined, {getOnInit: true});
export const kaufnebenkostenAtom = atom<number>((get) => {
  return get(kaufpreisAtom) * 0.1207;
});
export const tilgungssatzAtom = atomWithStorage<number>("tilgungssatz", 2, undefined, {getOnInit: true});
export const zinsbindungAtom = atomWithStorage<number>("zinsbindung", 10, undefined, {getOnInit: true});

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
    monthlyRate: calculateMonthlyRate(
      {darlehensbetrag: get(nettoDarlehensBetragAtom),
      effzins: get(effzinsAtom),
      tilgungssatz: get(tilgungssatzAtom),
      }
    ),
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
