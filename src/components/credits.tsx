"use client";

import { useAtom } from "jotai";
import { creditsAtom } from "~/state/credits_atom";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "./ui/dialog";
import { createCredit, type CreditCreate } from "~/lib/credit";
import { Input } from "./ui/input";
import { useState } from "react";
import { NumberInput } from "./ui/number_input";
import { Trash2, Edit } from "lucide-react";
import { Switch } from "./ui/switch";
import { useEffect } from "react";
import {
  calculateFullPaymentTime,
  calculateMonthlyRate,
  calculateTilgungssatz,
} from "~/lib/calculations";
import { SwitchInput } from "./ui/switch_input";

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

  return (
    <div>
      <h1 className="text-lg font-semibold">Weitere Kredite</h1>
      {Object.entries(credits).map(([key, credit]) => (
        <div key={key} className="flex flex-row gap-2">
          <p>{credit.name}</p>
          {credit.rates.map((rate) => (
            <p key={rate.key + key}>{Number(rate.rate).toFixed(2)} €</p>
          ))}
          <Edit
            className="cursor-pointer"
            onClick={() => {
              setCreditToEdit(credit);
              OnOpenChange(true);
            }}
          />
          <Trash2
            className="cursor-pointer"
            onClick={() =>
              setCredits((prev) => {
                const newCredits = { ...prev };
                delete newCredits[key];
                return newCredits;
              })
            }
          />
        </div>
      ))}
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
    if (creditTilgungssatz > 0 && !fixDurationOfCredit) {
      setcreditKreditdauer(
        calculateFullPaymentTime({
          darlehensbetrag: creditSummeDarlehen,
          monthlyRate: calculateMonthlyRate(
            creditSummeDarlehen,
            creditEffektiverZinssatz,
            creditTilgungssatz,
          ),
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
      <DialogContent>
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
        <NumberInput
          value={creditEffektiverZinssatz}
          onChange={setCreditEffektiverZinssatz}
          label="Effektiver Zinssatz"
        />
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
        />

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
