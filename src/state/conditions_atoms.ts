import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const conditionsAtom = atomWithStorage("conditions", {
    kaufpreis: "",
    modernisierungskosten: "",
    eigenkapital: "",
    kaufnebenkosten: "",
    kaufnebenkostenManuell: false,
    kaufnebenkostenProzent: "",
    sollzinsbindung: "",
});

export const effzinsAtom = atomWithStorage<number>("effzins", 0);
export const kaufpreisAtom = atomWithStorage<number>("kaufpreis", 0);
export const modernisierungskostenAtom = atomWithStorage<number>("modernisierungskosten", 0);
export const eigenkapitalAtom = atomWithStorage<number>("eigenkapital", 0);
export const kaufnebenkostenAtom = atom<number>((get) => {return get(kaufpreisAtom) * 0.1207});
export const tilgungssatzAtom = atomWithStorage<number>("tilgungssatz", 0);
export const zinsbindungAtom = atomWithStorage<number>("zinsbindung", 0);


export const nettodarlehensbetragAtom = atomWithStorage<number>("nettodarlehensbetrag", 0);
export const restschuldAtom = atomWithStorage<number>("restschuld", 0);


export const fullPaymentAtom = atom<{ canBePaidOff: boolean, years: number, months: number }>({ canBePaidOff: false, years: 0, months: 0 });
export const bezahlteZinsenAtom = atom<number>(0);

 