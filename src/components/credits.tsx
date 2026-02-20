"use client";

import { useAtom } from "jotai";
import { creditsAtom } from "~/state/credits_atom";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "./ui/dialog";
import {
  createCredit,
  createRatesByTime,
  type CreditCreate,
} from "~/lib/credit";
import { Input } from "./ui/input";
import { useState } from "react";
import { NumberInput } from "./ui/number_input";
import { PercentInput } from "./ui/percent_input";
import { Trash2, Edit } from "lucide-react";
import { useEffect } from "react";
import {
  calculateFullPaymentTime,
  calculateMonthlyRate,
  calculateRestschuld,
  calculateTilgungszuschussBetrag,
  calculateTilgungssatz,
} from "~/lib/calculations";
import { SwitchInput } from "./ui/switch_input";
import { formatNumber } from "~/lib/number_fromat";

export default function Credits() {
  const [credits, setCredits] = useAtom(creditsAtom);
  const [openCreditDialog, setOpenCreditDialog] = useState(false);
  const [creditToEdit, setCreditToEdit] = useState<CreditCreate | undefined>(
    undefined,
  );
  const [forceRemountCreditDialog, setForceRemountCreditDialog] = useState(0);

  function OnOpenChange(open: boolean) {
    if (!open) {
      setCreditToEdit(undefined);
    }
    setForceRemountCreditDialog((prev) => prev + 1);
    setOpenCreditDialog(open);
  }

  const creditEntries = Object.entries(credits);
  const sumAdditionalCredits = creditEntries.reduce(
    (sum, [, credit]) => sum + credit.summeDarlehen,
    0,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Weitere Kredite</h1>
        <p className="text-sm text-neutral-400">
          Summe: {formatNumber(sumAdditionalCredits)} €
        </p>
      </div>

      {creditEntries.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Noch keine weiteren Kredite angelegt.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-700">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="bg-neutral-800 text-left text-neutral-300">
                <th className="px-3 py-2 font-medium">Kredit</th>
                <th className="px-3 py-2 font-medium">Darlehenssumme</th>
                <th className="px-3 py-2 font-medium">Raten</th>
                <th className="px-3 py-2 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {creditEntries.map(([key, credit]) => (
                <tr
                  key={key}
                  className="border-t border-neutral-700 bg-neutral-900"
                >
                  <td className="px-3 py-2 text-neutral-100">{credit.name}</td>
                  <td className="px-3 py-2 text-neutral-100">
                    {formatNumber(credit.summeDarlehen)} €
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1 text-sm text-neutral-100">
                      {credit.rates.map((rate) => (
                        <p key={rate.key + key}>
                          {rate.startYear}-{rate.endYear}J:{" "}
                          {Number(rate.rate).toFixed(2)} €
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setCreditToEdit(credit);
                          OnOpenChange(true);
                        }}
                        title="Bearbeiten"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setCredits((prev) => {
                            const newCredits = { ...prev };
                            delete newCredits[key];
                            return newCredits;
                          })
                        }
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewCreditDialog
        key={(creditToEdit?.name ?? "new") + forceRemountCreditDialog}
        open={openCreditDialog}
        setOpen={OnOpenChange}
        credit={creditToEdit}
      />
    </div>
  );
}

function NewCreditDialog({
  credit,
  open,
  setOpen,
}: {
  credit?: CreditCreate;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [creditName, setCreditName] = useState(credit?.name ?? "");
  const [creditSummeDarlehen, setCreditSummeDarlehen] = useState(
    credit?.summeDarlehen ?? 0,
  );
  const [creditEffektiverZinssatz, setCreditEffektiverZinssatz] = useState(
    credit?.effektiverZinssatz ?? 0,
  );
  const [creditTilgungszuschuss, setCreditTilgungszuschuss] = useState(
    credit?.tilgungszuschussProzent ?? 0,
  );
  const [creditFoerderfaehigerAnteil, setCreditFoerderfaehigerAnteil] =
    useState(credit?.foerderfaehigerAnteilProzent ?? 0);
  const [creditTilgungssatz, setCreditTilgungssatz] = useState(
    credit?.tilgungssatz ?? 0,
  );
  const [creditKreditdauer, setcreditKreditdauer] = useState(
    credit?.kreditdauer ?? 0,
  );
  const [credits, setCredits] = useAtom(creditsAtom);
  const [nameError, setNameError] = useState<string | null>(null);
  const [creditTilgungsfreieZeit, setCreditTilgungsfreieZeit] = useState(
    credit?.tilgungsFreieZeit ?? 0,
  );
  const [creditRückzahlungsfreieZeit, setCreditRückzahlungsfreieZeit] =
    useState(credit?.rückzahlungsfreieZeit ?? 0);
  const [fixDurationOfCredit, setFixDurationOfCredit] = useState(
    credit?.useKreditDauer ?? false,
  );
  const [creditZinsbindung, setCreditZinsbindung] = useState(
    credit?.zinsbindung ?? 10,
  );
  const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
    darlehensbetrag: creditSummeDarlehen,
    foerderfaehigerAnteilProzent: creditFoerderfaehigerAnteil,
    tilgungszuschussProzent: creditTilgungszuschuss,
  });
  const rueckzahlungsRelevanterBetrag = Math.max(
    0,
    creditSummeDarlehen - tilgungszuschussBetrag,
  );
  const restschuld =
    creditSummeDarlehen > 0 &&
    creditEffektiverZinssatz > 0 &&
    creditTilgungssatz > 0 &&
    creditZinsbindung > 0
      ? calculateRestschuld({
          nettodarlehensbetrag: rueckzahlungsRelevanterBetrag,
          monthlyRate: calculateMonthlyRate({
            darlehensbetrag: rueckzahlungsRelevanterBetrag,
            effzins: creditEffektiverZinssatz,
            tilgungssatz: creditTilgungssatz,
            rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
          }),
          effZins: creditEffektiverZinssatz,
          years: creditZinsbindung,
          tilgungsfreieZeit: creditTilgungsfreieZeit,
          rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
        })
      : null;

  const rates =
    creditSummeDarlehen > 0 &&
    creditEffektiverZinssatz > 0 &&
    creditTilgungssatz > 0 &&
    creditZinsbindung > 0
      ? createRatesByTime({
          name: creditName,
          summeDarlehen: creditSummeDarlehen,
          effektiverZinssatz: creditEffektiverZinssatz,
          tilgungssatz: creditTilgungssatz,
          kreditdauer: creditKreditdauer,
          zinsbindung: creditZinsbindung,
          tilgungsFreieZeit: creditTilgungsfreieZeit,
          rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
          tilgungszuschussProzent: creditTilgungszuschuss,
          foerderfaehigerAnteilProzent: creditFoerderfaehigerAnteil,
        })
      : [];

  useEffect(() => {
    if (fixDurationOfCredit && creditKreditdauer > 0) {
      setCreditTilgungssatz(
        calculateTilgungssatz({
          effzins: creditEffektiverZinssatz,
          kreditdauer: creditKreditdauer,
          tilgungsfreieZeit: creditTilgungsfreieZeit,
          rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
        }),
      );
    }
  }, [
    creditEffektiverZinssatz,
    creditKreditdauer,
    creditTilgungsfreieZeit,
    creditRückzahlungsfreieZeit,
    fixDurationOfCredit,
  ]);

  useEffect(() => {
    console.log("creditTilgungssatz", creditTilgungssatz);
    if (creditTilgungssatz > 0 && !fixDurationOfCredit) {
      setcreditKreditdauer(
        calculateFullPaymentTime({
          darlehensbetrag: rueckzahlungsRelevanterBetrag,
          monthlyRate: calculateMonthlyRate({
            darlehensbetrag: rueckzahlungsRelevanterBetrag,
            effzins: creditEffektiverZinssatz,
            tilgungssatz: creditTilgungssatz,
            rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
          }),
          effzins: creditEffektiverZinssatz,
          tilgungsfreieZeit: creditTilgungsfreieZeit,
          rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
        }).years,
      );
    }
  }, [
    creditSummeDarlehen,
    creditEffektiverZinssatz,
    creditTilgungssatz,
    creditTilgungsfreieZeit,
    creditRückzahlungsfreieZeit,
    creditTilgungszuschuss,
    creditFoerderfaehigerAnteil,
    rueckzahlungsRelevanterBetrag,
    fixDurationOfCredit,
  ]);

  // Validation function to check for duplicate names
  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError("Kreditname ist erforderlich");
      return false;
    }

    // Check if name is already taken by a different credit
    const isNameTaken = credits[name] && (!credit || credit.name !== name);
    if (isNameTaken) {
      setNameError("Ein Kredit mit diesem Namen existiert bereits");
      return false;
    }

    setNameError(null);
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setCreditName(newName);
    validateName(newName);
  };

  const canSave = creditName.trim() && !nameError;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => setOpen(true)}>
        <Button>Neuer Kredit</Button>
      </DialogTrigger>
      <DialogContent className="">
        <DialogTitle>
          {credit ? "Kredit bearbeiten" : "Neuer Kredit"}
        </DialogTitle>
        <div>
          <Input
            type="text"
            placeholder="Kreditname"
            value={creditName}
            onChange={handleNameChange}
            className={nameError ? "border-red-500" : ""}
          />
          {nameError && (
            <p className="mt-1 text-sm text-red-500">{nameError}</p>
          )}
        </div>
        <NumberInput
          value={creditSummeDarlehen}
          onChange={setCreditSummeDarlehen}
          label="Summe Darlehen"
        />
        <PercentInput
          value={creditEffektiverZinssatz}
          onChange={setCreditEffektiverZinssatz}
          label="Effektiver Zinssatz"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PercentInput
            value={creditTilgungszuschuss}
            onChange={setCreditTilgungszuschuss}
            label="Tilgungszuschuss"
          />
          <PercentInput
            value={creditFoerderfaehigerAnteil}
            onChange={setCreditFoerderfaehigerAnteil}
            label="Förderfähiger Anteil"
          />
        </div>
        <div>
          <SwitchInput
            valueLeft={creditTilgungssatz}
            setLeft={setCreditTilgungssatz}
            valueRight={creditKreditdauer}
            setRight={setcreditKreditdauer}
            onCheckedChange={(value) => {
              setFixDurationOfCredit(value);
            }}
            labelLeft="Tilgungssatz"
            labelRight="Kreditdauer in Jahren"
            unitLeft="%"
            unitRight="Jahre"
            defaultPosition={fixDurationOfCredit ? "right" : "left"}
          />
          {(creditKreditdauer <= creditTilgungsfreieZeit ||
            creditKreditdauer <= creditRückzahlungsfreieZeit) && (
            <p className="text-red-500">
              Kreditdauer ist kleiner als Tilgungsfreie Zeit oder
              Rückzahlungsfreie Zeit
            </p>
          )}
        </div>
        {/* Sollzinsbindung */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Sollzinsbindung
            {/* <span title="Info">ⓘ</span> */}
          </label>
          <select
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
            value={creditZinsbindung}
            onChange={(e) => setCreditZinsbindung(Number(e.target.value))}
          >
            <option value={5}>5 Jahre</option>
            <option value={10}>10 Jahre</option>
            <option value={15}>15 Jahre</option>
            <option value={20}>20 Jahre</option>
          </select>
        </div>

        {/* Restschuld */}
        {restschuld && restschuld > 0 ? (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Restschuld
              {/* <span title="Info">ⓘ</span> */}
            </label>
            <span>{formatNumber(restschuld)} €</span>
          </div>
        ) : null}
        {/* rate */}
        <div>
          {rates.length > 0
            ? rates.map((rate) => (
                <p key={rate.key}>{Math.round(rate.rate)} €</p>
              ))
            : null}
        </div>

        <div>
          <h3 className="text-lg font-semibold">
            Sonderkonditionen zu Zahlungsbeginn
          </h3>
          <SwitchInput
            labelLeft="Tilgungsfreie Zeit"
            labelRight="Rückzahlungsfreie Zeit"
            valueLeft={creditTilgungsfreieZeit}
            valueRight={creditRückzahlungsfreieZeit}
            setLeft={(value) => {
              setCreditTilgungsfreieZeit(value);
              setCreditRückzahlungsfreieZeit(0);
            }}
            setRight={(value) => {
              setCreditRückzahlungsfreieZeit(value);
              setCreditTilgungsfreieZeit(0);
            }}
            unitLeft="Jahre"
            unitRight="Jahre"
            defaultPosition={creditRückzahlungsfreieZeit > 0 ? "right" : "left"}
          />
        </div>

        <Button
          disabled={!canSave}
          onClick={() => {
            // Final validation before saving
            if (!validateName(creditName)) {
              return;
            }

            setCredits((prev) => {
              const newCredits = { ...prev };

              // If we're editing an existing credit and the name changed, remove the old entry
              if (credit && credit.name !== creditName) {
                delete newCredits[credit.name];
              }

              // Add/update the credit with the current values
              newCredits[creditName] = createCredit({
                name: creditName,
                summeDarlehen: creditSummeDarlehen,
                effektiverZinssatz: creditEffektiverZinssatz,
                tilgungssatz: creditTilgungssatz,
                kreditdauer: creditKreditdauer,
                tilgungsFreieZeit: creditTilgungsfreieZeit,
                rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
                useKreditDauer: fixDurationOfCredit,
                zinsbindung: creditZinsbindung,
                tilgungszuschussProzent: creditTilgungszuschuss,
                foerderfaehigerAnteilProzent: creditFoerderfaehigerAnteil,
              });

              return newCredits;
            });
            setOpen(false);
          }}
        >
          {credit ? "Aktualisieren" : "Speichern"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
