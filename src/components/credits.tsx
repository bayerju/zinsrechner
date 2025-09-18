"use client";

import { useAtom } from "jotai";
import { creditsAtom } from "~/state/credits_atom";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "./ui/dialog";
import {
  createCredit,
  type CreditCreate,
  type RatesByTime,
} from "~/lib/credit";
import { Input } from "./ui/input";
import { useState } from "react";
import { map } from "lodash";
import { NumberInput } from "./ui/number_input";
import { calculateMonthlyRate } from "~/lib/calculations";
import { Trash2, Edit } from "lucide-react";

export default function Credits() {
  const [credits, setCredits] = useAtom(creditsAtom);

  return (
    <div>
      <h1 className="text-lg font-semibold">Weitere Kredite</h1>
      {Object.entries(credits).map(([key, credit]) => (
        <div key={key} className="flex flex-row gap-2">
          <p>{credit.name}</p>
          <Trash2
            onClick={() =>
              setCredits((prev) => {
                const newCredits = { ...prev };
                delete newCredits[key];
                return newCredits;
              })
            }
          />
          {credit.rates.map((rate) => (
            <p key={rate.key + key}>{rate.rate} €</p>
          ))}
        </div>
      ))}
      <NewCreditDialog />
    </div>
  );
}

function NewCreditDialog({ credit }: { credit?: CreditCreate }) {
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
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useAtom(creditsAtom);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Neuer Kredit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Neuer Kredit</DialogTitle>
        <Input
          type="text"
          placeholder="Kreditname"
          value={creditName}
          onChange={(e) => setCreditName(e.target.value)}
        />
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
        <NumberInput
          value={creditTilgungssatz}
          onChange={setCreditTilgungssatz}
          label="Tilgungssatz"
        />
        <Button
          onClick={() => {
            setCredits((prev) => ({
              ...prev,
              [creditName]: createCredit({
                name: creditName,
                summeDarlehen: creditSummeDarlehen,
                effektiverZinssatz: creditEffektiverZinssatz,
                tilgungssatz: creditTilgungssatz,
              }),
            }));
            setOpen(false);
          }}
        >
          Speichern
        </Button>
      </DialogContent>
    </Dialog>
  );
}
