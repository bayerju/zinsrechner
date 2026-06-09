"use client";

import { useAtom } from "jotai";
import { creditsAtom } from "~/state/credits_atom";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "./ui/dialog";
import {
  calculateBridgeMonthlyInterest,
  createCredit,
  createRatesByTime,
  isBridgeCredit,
  type CreditCreate,
} from "~/lib/credit";
import { Input } from "./ui/input";
import { useState } from "react";
import { NumberInput } from "./ui/number_input";
import { PercentInput } from "./ui/percent_input";
import {
  ArrowLeft,
  BadgeEuro,
  Banknote,
  Edit,
  Landmark,
  Settings2,
  Trash2,
} from "lucide-react";
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

type CreditTemplate =
  | "zwischenfinanzierung"
  | "annuitaet"
  | "endfaellig"
  | "foerderung"
  | "benutzerdefiniert";

const creditTemplates: Array<{
  id: CreditTemplate;
  title: string;
  description: string;
  icon: typeof Landmark;
}> = [
  {
    id: "zwischenfinanzierung",
    title: "Zwischenfinanzierung",
    description:
      "Kurzfristiger Kredit mit monatlicher Zinszahlung und Tilgung am Ende.",
    icon: Banknote,
  },
  {
    id: "annuitaet",
    title: "Annuitätendarlehen",
    description:
      "Klassischer Immobilienkredit mit gleichbleibender monatlicher Rate.",
    icon: Landmark,
  },
  {
    id: "endfaellig",
    title: "Endfälliges Darlehen",
    description:
      "Während der Laufzeit werden nur Zinsen gezahlt, die Tilgung erfolgt am Ende.",
    icon: BadgeEuro,
  },
  {
    id: "foerderung",
    title: "Förderung",
    description:
      "Förderdarlehen mit förderfähigem Anteil und möglichem Tilgungszuschuss.",
    icon: BadgeEuro,
  },
  {
    id: "benutzerdefiniert",
    title: "Benutzerdefiniert",
    description:
      "Alle verfügbaren Konditionen und Sonderregelungen selbst festlegen.",
    icon: Settings2,
  },
];

function inferCreditTemplate(credit?: CreditCreate): CreditTemplate | null {
  if (!credit) return null;
  if (credit.kreditart === "zwischenfinanzierung") {
    return "zwischenfinanzierung";
  }
  if (
    (credit.tilgungszuschussProzent ?? 0) > 0 ||
    (credit.foerderfaehigerAnteilProzent ?? 0) > 0
  ) {
    return "foerderung";
  }
  if (
    credit.tilgungssatz === 0 &&
    (credit.tilgungsFreieZeit ?? 0) >= credit.zinsbindung
  ) {
    return "endfaellig";
  }
  if (
    (credit.tilgungsFreieZeit ?? 0) > 0 ||
    (credit.rückzahlungsfreieZeit ?? 0) > 0
  ) {
    return "benutzerdefiniert";
  }
  return "annuitaet";
}

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
        <>
          <div className="space-y-2 sm:hidden">
            {creditEntries.map(([key, credit]) => (
              <div
                key={key}
                className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-neutral-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{credit.name}</p>
                    <p className="text-xs text-neutral-400">
                      {isBridgeCredit(credit)
                        ? `Zwischenfinanzierung · ${credit.laufzeitMonate} Monate`
                        : "Kredit"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">
                    {formatNumber(credit.summeDarlehen)} €
                  </p>
                </div>
                <div className="mt-3 space-y-1 border-t border-neutral-700 pt-2 text-sm">
                  {credit.rates.map((rate) => (
                    <div
                      key={rate.key + key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-neutral-400">
                        Jahr {rate.startYear}-{rate.endYear}
                      </span>
                      <span>{formatNumber(rate.rate)} € / Monat</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 border border-neutral-200 bg-neutral-100 text-neutral-950 shadow-sm hover:bg-white hover:text-black"
                    onClick={() => {
                      setCreditToEdit(credit);
                      OnOpenChange(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 border-red-400 bg-red-950/40 text-red-100 shadow-sm hover:bg-red-900/70 hover:text-white"
                    onClick={() =>
                      setCredits((prev) => {
                        const newCredits = { ...prev };
                        delete newCredits[key];
                        return newCredits;
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-md border border-neutral-700 sm:block">
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
                    <td className="px-3 py-2 text-neutral-100">
                      <div>{credit.name}</div>
                      {isBridgeCredit(credit) && (
                        <div className="text-xs text-neutral-400">
                          Zwischenfinanzierung, {credit.laufzeitMonate} Monate
                        </div>
                      )}
                    </td>
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
                          className="h-9 w-9 border-neutral-300 bg-neutral-100 text-neutral-950 hover:bg-white hover:text-black"
                          onClick={() => {
                            setCreditToEdit(credit);
                            OnOpenChange(true);
                          }}
                          title="Bearbeiten"
                          aria-label={`${credit.name} bearbeiten`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 border-red-400 bg-red-950/40 text-red-100 hover:bg-red-900/70 hover:text-white"
                          onClick={() =>
                            setCredits((prev) => {
                              const newCredits = { ...prev };
                              delete newCredits[key];
                              return newCredits;
                            })
                          }
                          title="Löschen"
                          aria-label={`${credit.name} löschen`}
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
        </>
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
  const [selectedTemplate, setSelectedTemplate] =
    useState<CreditTemplate | null>(() => inferCreditTemplate(credit));
  const [creditName, setCreditName] = useState(credit?.name ?? "");
  const [creditType, setCreditType] = useState<
    "standard" | "zwischenfinanzierung"
  >(credit?.kreditart ?? "standard");
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
  const [hasGovernmentSupport, setHasGovernmentSupport] = useState(
    (credit?.tilgungszuschussProzent ?? 0) > 0 ||
      (credit?.foerderfaehigerAnteilProzent ?? 0) > 0,
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
  const [creditZinsbindung, setCreditZinsbindung] = useState(
    credit?.zinsbindung ?? 10,
  );
  const [creditLaufzeitMonate, setCreditLaufzeitMonate] = useState(
    credit?.laufzeitMonate ?? 12,
  );
  const isBridge = creditType === "zwischenfinanzierung";
  const showGovernmentSupport =
    selectedTemplate === "foerderung" ||
    selectedTemplate === "benutzerdefiniert";
  const showRepayment =
    selectedTemplate === "annuitaet" ||
    selectedTemplate === "foerderung" ||
    selectedTemplate === "benutzerdefiniert";
  const showSpecialConditions =
    selectedTemplate === "foerderung" ||
    selectedTemplate === "benutzerdefiniert";
  const effectiveTilgungszuschuss = hasGovernmentSupport
    ? creditTilgungszuschuss
    : 0;
  const effectiveFoerderfaehigerAnteil = hasGovernmentSupport
    ? creditFoerderfaehigerAnteil
    : 0;
  const tilgungszuschussBetrag = calculateTilgungszuschussBetrag({
    darlehensbetrag: creditSummeDarlehen,
    foerderfaehigerAnteilProzent: effectiveFoerderfaehigerAnteil,
    tilgungszuschussProzent: effectiveTilgungszuschuss,
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
    !isBridge &&
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
          tilgungszuschussProzent: effectiveTilgungszuschuss,
          foerderfaehigerAnteilProzent: effectiveFoerderfaehigerAnteil,
        })
      : [];
  const bridgeMonthlyInterest = isBridge
    ? calculateBridgeMonthlyInterest({
        summeDarlehen: creditSummeDarlehen,
        effektiverZinssatz: creditEffektiverZinssatz,
      })
    : 0;

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
    effectiveTilgungszuschuss,
    effectiveFoerderfaehigerAnteil,
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

  function selectTemplate(template: CreditTemplate) {
    setSelectedTemplate(template);

    if (template === "zwischenfinanzierung") {
      setCreditType("zwischenfinanzierung");
      return;
    }

    setCreditType("standard");

    if (template === "annuitaet") {
      setHasGovernmentSupport(false);
      setCreditTilgungsfreieZeit(0);
      setCreditRückzahlungsfreieZeit(0);
      if (creditTilgungssatz <= 0) setCreditTilgungssatz(2);
    }

    if (template === "endfaellig") {
      setHasGovernmentSupport(false);
      setCreditTilgungssatz(0);
      setCreditTilgungsfreieZeit(creditZinsbindung);
      setCreditRückzahlungsfreieZeit(0);
      setFixDurationOfCredit(false);
    }

    if (template === "foerderung") {
      setHasGovernmentSupport(true);
      if (creditTilgungssatz <= 0) setCreditTilgungssatz(2);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => setOpen(true)}>
        <Button>Neuer Kredit</Button>
      </DialogTrigger>
      <DialogContent
        className={`border-neutral-500 bg-neutral-900 text-neutral-100 shadow-[0_24px_80px_rgba(0,0,0,0.75)] ring-1 ring-white/15 ${
          selectedTemplate ? "" : "sm:max-w-2xl"
        }`}
      >
        {!selectedTemplate ? (
          <>
            <DialogTitle className="text-xl text-white">
              Kreditart auswählen
            </DialogTitle>
            <p className="text-sm text-neutral-300">
              Wähle die passende Vorlage. Die Eingabefelder werden anschließend
              darauf abgestimmt.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {creditTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className="flex min-h-28 items-start gap-3 rounded-lg border border-neutral-600 bg-neutral-800 p-4 text-left text-neutral-100 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
                    onClick={() => selectTemplate(template.id)}
                  >
                    <span className="rounded-md border border-neutral-600 bg-neutral-700 p-2 text-blue-300">
                      <Icon className="h-6 w-6 stroke-[2.25]" />
                    </span>
                    <span>
                      <span className="block font-semibold text-white">
                        {template.title}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-neutral-300">
                        {template.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 pr-8">
              {!credit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedTemplate(null)}
                  title="Zurück zur Kreditart"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle className="text-white">
                {credit
                  ? "Kredit bearbeiten"
                  : creditTemplates.find(
                      (template) => template.id === selectedTemplate,
                    )?.title}
              </DialogTitle>
            </div>
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
            {isBridge ? (
              <>
                <NumberInput
                  value={creditLaufzeitMonate}
                  onChange={setCreditLaufzeitMonate}
                  label="Laufzeit der Zwischenfinanzierung"
                  unit="Monate"
                />
                <div className="rounded-md border border-neutral-700 p-3 text-sm">
                  <p>
                    Monatliche Zinszahlung:{" "}
                    {formatNumber(bridgeMonthlyInterest)} €
                  </p>
                  <p>
                    Vollständige Rückzahlung nach{" "}
                    {Math.max(1, Math.round(creditLaufzeitMonate))} Monaten:{" "}
                    {formatNumber(creditSummeDarlehen)} €
                  </p>
                </div>
              </>
            ) : (
              <>
                {selectedTemplate === "endfaellig" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Laufzeit
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                      value={creditZinsbindung}
                      onChange={(event) => {
                        const years = Number(event.target.value);
                        setCreditZinsbindung(years);
                        setCreditTilgungsfreieZeit(years);
                      }}
                    >
                      <option value={5}>5 Jahre</option>
                      <option value={10}>10 Jahre</option>
                      <option value={15}>15 Jahre</option>
                      <option value={20}>20 Jahre</option>
                    </select>
                    <p className="mt-1 text-xs text-neutral-400">
                      Während der Laufzeit werden nur Zinsen gezahlt.
                    </p>
                  </div>
                )}
                {showGovernmentSupport && (
                  <div className="rounded-md border border-neutral-700 p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={hasGovernmentSupport}
                        onChange={(event) =>
                          setHasGovernmentSupport(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-neutral-600 accent-neutral-100"
                      />
                      Staatliche Unterstützung
                    </label>
                    {hasGovernmentSupport && (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <PercentInput
                          value={creditFoerderfaehigerAnteil}
                          onChange={setCreditFoerderfaehigerAnteil}
                          label="Förderfähiger Anteil"
                        />
                        <PercentInput
                          value={creditTilgungszuschuss}
                          onChange={setCreditTilgungszuschuss}
                          label="Tilgungszuschuss"
                        />
                      </div>
                    )}
                  </div>
                )}
                {showRepayment && (
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
                    {(creditKreditdauer < creditTilgungsfreieZeit ||
                      creditKreditdauer < creditRückzahlungsfreieZeit) && (
                      <p className="text-red-500">
                        Die tilgungsfreie oder rückzahlungsfreie Zeit darf nicht
                        länger als die Kreditdauer sein.
                      </p>
                    )}
                  </div>
                )}
                {/* Sollzinsbindung */}
                {selectedTemplate !== "endfaellig" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Sollzinsbindung
                      {/* <span title="Info">ⓘ</span> */}
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-white"
                      value={creditZinsbindung}
                      onChange={(e) =>
                        setCreditZinsbindung(Number(e.target.value))
                      }
                    >
                      <option value={5}>5 Jahre</option>
                      <option value={10}>10 Jahre</option>
                      <option value={15}>15 Jahre</option>
                      <option value={20}>20 Jahre</option>
                    </select>
                  </div>
                )}

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

                {showSpecialConditions && (
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
                      defaultPosition={
                        creditRückzahlungsfreieZeit > 0 ? "right" : "left"
                      }
                    />
                  </div>
                )}
              </>
            )}

            <Button
              disabled={
                !canSave ||
                creditSummeDarlehen <= 0 ||
                creditEffektiverZinssatz < 0 ||
                (isBridge && creditLaufzeitMonate <= 0)
              }
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
                    kreditart: creditType,
                    summeDarlehen: creditSummeDarlehen,
                    effektiverZinssatz: creditEffektiverZinssatz,
                    tilgungssatz: creditTilgungssatz,
                    kreditdauer: creditKreditdauer,
                    tilgungsFreieZeit: creditTilgungsfreieZeit,
                    rückzahlungsfreieZeit: creditRückzahlungsfreieZeit,
                    useKreditDauer: fixDurationOfCredit,
                    zinsbindung: creditZinsbindung,
                    tilgungszuschussProzent: effectiveTilgungszuschuss,
                    foerderfaehigerAnteilProzent:
                      effectiveFoerderfaehigerAnteil,
                    laufzeitMonate: isBridge
                      ? Math.max(1, Math.round(creditLaufzeitMonate))
                      : undefined,
                  });

                  return newCredits;
                });
                setOpen(false);
              }}
            >
              {credit ? "Aktualisieren" : "Speichern"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
