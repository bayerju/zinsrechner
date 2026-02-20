import { NumberInput } from "./ui/number_input";
import { useAtom } from "jotai";
import {
  kaufpreisAtom,
  modernisierungskostenAtom,
  eigenkapitalAtom,
  kaufnebenkostenAtom,
} from "~/state/conditions_atoms";

export default function Conditions() {
  const [kaufpreis, setKaufpreis] = useAtom(kaufpreisAtom);
  const [modernisierungskosten, setModernisierungskosten] = useAtom(
    modernisierungskostenAtom,
  );
  const [eigenkapital, setEigenkapital] = useAtom(eigenkapitalAtom);
  const [kaufnebenkosten, setKaufnebenkosten] = useAtom(kaufnebenkostenAtom);
  // const [zinsbindung, setzinsbindung] = useAtom(zinsbindungAtom);
  // const [tilgungssatz, setTilgungssatz] = useAtom(tilgungssatzAtom);

  return (
    <>
      {/* Kaufpreis */}
      <div>
        <NumberInput
          label="Kaufpreis"
          value={kaufpreis}
          onChange={setKaufpreis}
          unit="€"
        />
      </div>
      {/* Modernisierungskosten */}
      <div>
        <NumberInput
          label="Modernisierungskosten"
          value={modernisierungskosten}
          onChange={setModernisierungskosten}
          unit="€"
        />
      </div>
      {/* Kaufnebenkosten */}
      <div>
        <NumberInput
          label="Kaufnebenkosten (Standard: 12,07% vom Kaufpreis)"
          value={kaufnebenkosten}
          onChange={setKaufnebenkosten}
          unit="€"
          disabled={true}
        />
        {/* <label className="mb-1 block text-sm font-medium">
          Kaufnebenkosten (Standard: 12,07% vom Kaufpreis)
          <input
            type="checkbox"
            className="ml-2 align-middle"
            checked={kaufnebenkostenManuell}
            onChange={handleKaufnebenkostenManuellChange}
          />
          <span className="text-muted-foreground ml-2 text-xs">
            manuell eingeben
          </span> */}
        {/* </label> */}
        {/* <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
            value={
              kaufnebenkostenManuell
                ? kaufnebenkosten
                : formatGermanNumberInput(berechneteKaufnebenkosten.toString())
            }
            disabled={!kaufnebenkostenManuell}
            onChange={handleValueInputChange(
              setKaufnebenkosten,
              setKaufnebenkostenProzent,
              kaufpreisNum,
            )}
            onBlur={() => handleInputBlur(kaufnebenkosten, setKaufnebenkosten)}
          />
          {kaufnebenkostenManuell && (
            <>
              <input
                type="text"
                inputMode="decimal"
                className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-right text-white"
                value={kaufnebenkostenProzent}
                onChange={handlePercentInputChange(
                  setKaufnebenkostenProzent,
                  setKaufnebenkosten,
                  kaufpreisNum,
                )}
                onBlur={() =>
                  handlePercentInputBlur(
                    kaufnebenkostenProzent,
                    setKaufnebenkostenProzent,
                  )
                }
                style={{ minWidth: 60 }}
              />
              <span className="text-white">%</span>
            </>
          )}
        </div> */}
      </div>
      {/* Eigenkapital */}
      <div>
        <NumberInput
          label="Eigenkapital"
          value={eigenkapital}
          onChange={setEigenkapital}
          unit="€"
        />
      </div>
      {/* Sollzinsbindung */}
      {/* <div>
        <label className="mb-1 block text-sm font-medium">
          Sollzinsbindung <span title="Info">ⓘ</span>
        </label>
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
      </div> */}
      {/* Tilgungssatz */}
      {/* <div>
        <label className="mb-1 block text-sm font-medium">
          Tilgungssatz <span title="Info">ⓘ</span>
        </label>
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
      </div> */}
      {/* <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Tilgungsfreier Kredit <span title="Info">ⓘ</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
            value={tilgungsfreierKredit}
            onChange={handleInputChange(setTilgungsfreierKredit)}
            onBlur={() =>
              handleInputBlur(tilgungsfreierKredit, setTilgungsfreierKredit)
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Tilgungsfreie Zeit <span title="Info">ⓘ</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
            value={tilgungsFreieZeit}
            onChange={handleInputChange(setTilgungsFreieZeit)}
          />
        </div> */}
      {/* </div> */}
    </>
  );
}
