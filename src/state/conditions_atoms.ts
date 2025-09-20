import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { creditsAtom } from "./credits_atom";
import {
  calculateMonthlyRate,
  calculateNettodarlehensbetragBank,
  calculateRestschuld,
} from "~/lib/calculations";

export const effzinsAtom = atomWithStorage<number>("effzins", 0);
export const kaufpreisAtom = atomWithStorage<number>("kaufpreis", 0);
export const modernisierungskostenAtom = atomWithStorage<number>(
  "modernisierungskosten",
  0,
);
export const eigenkapitalAtom = atomWithStorage<number>("eigenkapital", 0);
export const kaufnebenkostenAtom = atom<number>((get) => {
  return get(kaufpreisAtom) * 0.1207;
});
export const tilgungssatzAtom = atomWithStorage<number>("tilgungssatz", 0);
export const zinsbindungAtom = atomWithStorage<number>("zinsbindung", 0);

export const nettoDarlehensBetragAtom = atom<number>((get) =>
  calculateNettodarlehensbetragBank({
    kaufpreis: get(kaufpreisAtom),
    modernisierungskosten: get(modernisierungskostenAtom),
    kaufnebenkosten: get(kaufnebenkostenAtom),
    eigenkapital: get(eigenkapitalAtom),
    credits: Object.values(get(creditsAtom) ?? {}),
  }),
);
export const restschuldAtom = atom<number>((get) =>
  calculateRestschuld({
    nettodarlehensbetrag: get(nettoDarlehensBetragAtom),
    monthlyRate: calculateMonthlyRate(
      get(nettoDarlehensBetragAtom),
      get(effzinsAtom),
      get(tilgungssatzAtom),
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
