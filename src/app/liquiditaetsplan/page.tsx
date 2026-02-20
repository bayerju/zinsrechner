"use client";

import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { TopNav } from "~/components/top_nav";
import { LiquidityScenarioBar } from "~/components/liquidity_scenario_bar";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NumberInput } from "~/components/ui/number_input";
import { MonthPicker } from "~/components/ui/month_picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { scenarioValuesAtom } from "~/state/scenario_values_atom";
import { scenariosAtom } from "~/state/scenarios_atom";
import {
  activeLiquidityScenarioValuesAtom,
  type LiquidityFrequency,
  type LiquidityItem,
  type LiquidityScenarioValues,
} from "~/state/liquidity_scenarios_atom";
import { buildMonthList, monthKeyToIndex } from "~/lib/liquidity";

function createItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export default function LiquiditaetsplanPage() {
  const [values, setValues] = useAtom(activeLiquidityScenarioValuesAtom);
  const creditScenarios = useAtomValue(scenariosAtom);
  const creditScenarioValues = useAtomValue(scenarioValuesAtom);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("income");
  const [newAmount, setNewAmount] = useState(0);
  const [newFrequency, setNewFrequency] =
    useState<LiquidityFrequency>("monthly");
  const [newStartMonth, setNewStartMonth] = useState(values.startMonth);
  const [newEndMonth, setNewEndMonth] = useState("");

  const [overrideItemId, setOverrideItemId] = useState<string | null>(null);
  const [overrideMonth, setOverrideMonth] = useState(values.startMonth);
  const [overrideAmount, setOverrideAmount] = useState(0);
  const [overrideUseDefault, setOverrideUseDefault] = useState(true);
  const [overrideDisabled, setOverrideDisabled] = useState(false);

  const months = useMemo(
    () => buildMonthList(values.startMonth, values.horizonMonths),
    [values.startMonth, values.horizonMonths],
  );

  const selectedOverrideItem =
    values.items.find((item) => item.id === overrideItemId) ?? null;

  function updateValues(
    update:
      | LiquidityScenarioValues
      | ((prev: LiquidityScenarioValues) => LiquidityScenarioValues),
  ) {
    setValues(update);
  }

  function addItem() {
    if (!newName.trim()) return;
    const item: LiquidityItem = {
      id: createItemId(),
      name: newName.trim(),
      type: newType,
      defaultAmount: newAmount,
      frequency: newFrequency,
      startMonth: newStartMonth,
      endMonth: newEndMonth || undefined,
      overrides: {},
    };
    updateValues((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
    setNewName("");
    setNewAmount(0);
    setNewEndMonth("");
  }

  function updateItem(
    itemId: string,
    updater: (item: LiquidityItem) => LiquidityItem,
  ) {
    updateValues((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? updater(item) : item,
      ),
    }));
  }

  function saveOverride() {
    if (!selectedOverrideItem) return;
    updateItem(selectedOverrideItem.id, (item) => {
      const nextOverrides = { ...item.overrides };
      if (!overrideDisabled && overrideUseDefault) {
        delete nextOverrides[overrideMonth];
      } else {
        nextOverrides[overrideMonth] = {
          amount: overrideUseDefault ? undefined : overrideAmount,
          disabled: overrideDisabled,
        };
      }
      return {
        ...item,
        overrides: nextOverrides,
      };
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />
          <LiquidityScenarioBar />

          <div className="space-y-3 rounded-md border border-neutral-300 p-3">
            <h3 className="text-sm font-semibold text-black">
              Rahmendaten Liquiditaet
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <NumberInput
                label="Startkapital"
                unit="€"
                className="h-9 border-neutral-300 bg-white text-black"
                value={values.startCapital}
                onChange={(value) =>
                  updateValues((prev) => ({
                    ...prev,
                    startCapital: value,
                  }))
                }
              />
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Startmonat
                <MonthPicker
                  className="h-9 border-neutral-300 bg-white text-black"
                  value={values.startMonth}
                  onChange={(nextMonth) =>
                    updateValues((prev) => ({ ...prev, startMonth: nextMonth }))
                  }
                />
              </label>
              <NumberInput
                label="Horizont"
                unit="Monate"
                className="h-9 border-neutral-300 bg-white text-black"
                value={values.horizonMonths}
                onChange={(value) =>
                  updateValues((prev) => ({
                    ...prev,
                    horizonMonths: Math.min(
                      600,
                      Math.max(1, Math.round(value)),
                    ),
                  }))
                }
              />
            </div>

            <label className="text-xs text-neutral-700">
              Kreditszenario fuer Auswertung
              <Select
                value={values.creditScenarioId}
                onValueChange={(value) =>
                  updateValues((prev) => ({
                    ...prev,
                    creditScenarioId: value,
                  }))
                }
              >
                <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                  <SelectValue placeholder="Kreditszenario waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(creditScenarios)
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map((scenario) => (
                      <SelectItem key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </label>

            {!creditScenarioValues[values.creditScenarioId] && (
              <p className="text-xs text-red-600">
                Das gewaehlte Kreditszenario existiert nicht mehr. Bitte neu
                auswaehlen.
              </p>
            )}
          </div>

          <div className="rounded-md border border-neutral-300 p-2">
            <h4 className="mb-2 text-sm font-medium">Position hinzufuegen</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                className="h-9 border-neutral-300 bg-white text-black"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <NumberInput
                unit="€"
                className="h-9 border-neutral-300 bg-white text-black"
                placeholder="Betrag"
                value={newAmount}
                onChange={setNewAmount}
              />
              <Select
                value={newType}
                onValueChange={(value) =>
                  setNewType(value as "income" | "expense")
                }
              >
                <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Einnahme</SelectItem>
                  <SelectItem value="expense">Ausgabe</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={newFrequency}
                onValueChange={(value) =>
                  setNewFrequency(value as LiquidityFrequency)
                }
              >
                <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                  <SelectValue placeholder="Intervall" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                  <SelectItem value="quarterly">Quartalsweise</SelectItem>
                  <SelectItem value="yearly">Jaehrlich</SelectItem>
                  <SelectItem value="once">Einmalig</SelectItem>
                </SelectContent>
              </Select>
              <MonthPicker
                className="h-9 border-neutral-300 bg-white text-black"
                value={newStartMonth}
                onChange={setNewStartMonth}
              />
              <MonthPicker
                className="h-9 border-neutral-300 bg-white text-black"
                value={newEndMonth}
                onChange={setNewEndMonth}
                placeholder="Kein Endmonat"
              />
            </div>
            <Button type="button" className="mt-2" onClick={addItem}>
              Position hinzufuegen
            </Button>
          </div>

          <div className="space-y-2">
            {values.items.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-neutral-300 p-2"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-9 border-neutral-300 bg-white text-black"
                    value={item.name}
                    onChange={(e) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        name: e.target.value,
                      }))
                    }
                  />
                  <NumberInput
                    unit="€"
                    className="h-9 border-neutral-300 bg-white text-black"
                    value={item.defaultAmount}
                    onChange={(value) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        defaultAmount: value,
                      }))
                    }
                  />
                  <Select
                    value={item.type}
                    onValueChange={(value) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        type: value as "income" | "expense",
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                      <SelectValue placeholder="Typ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Einnahme</SelectItem>
                      <SelectItem value="expense">Ausgabe</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={item.frequency}
                    onValueChange={(value) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        frequency: value as LiquidityFrequency,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                      <SelectValue placeholder="Intervall" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                      <SelectItem value="quarterly">Quartalsweise</SelectItem>
                      <SelectItem value="yearly">Jaehrlich</SelectItem>
                      <SelectItem value="once">Einmalig</SelectItem>
                    </SelectContent>
                  </Select>
                  <MonthPicker
                    className="h-9 border-neutral-300 bg-white text-black"
                    value={item.startMonth}
                    onChange={(nextMonth) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        startMonth: nextMonth,
                      }))
                    }
                  />
                  <MonthPicker
                    className="h-9 border-neutral-300 bg-white text-black"
                    value={item.endMonth ?? ""}
                    onChange={(nextMonth) =>
                      updateItem(item.id, (old) => ({
                        ...old,
                        endMonth: nextMonth || undefined,
                      }))
                    }
                    placeholder="Kein Endmonat"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOverrideItemId(item.id);
                      setOverrideMonth(values.startMonth);
                      setOverrideAmount(item.defaultAmount);
                      setOverrideUseDefault(true);
                      setOverrideDisabled(false);
                    }}
                  >
                    Monatswerte anpassen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateValues((prev) => ({
                        ...prev,
                        items: prev.items.filter(
                          (existing) => existing.id !== item.id,
                        ),
                      }))
                    }
                  >
                    Entfernen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={overrideItemId !== null}
        onOpenChange={(open) => !open && setOverrideItemId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Monatsanpassung</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-neutral-700">
              Monat
              <Select value={overrideMonth} onValueChange={setOverrideMonth}>
                <SelectTrigger className="h-9 border-neutral-300 bg-white text-black">
                  <SelectValue placeholder="Monat waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs text-neutral-700">
              Abweichender Betrag
              <NumberInput
                unit="€"
                className="h-9 border-neutral-300 bg-white text-black"
                value={overrideAmount}
                onChange={setOverrideAmount}
                disabled={overrideUseDefault || overrideDisabled}
              />
            </label>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={overrideUseDefault}
                onCheckedChange={(checked) =>
                  setOverrideUseDefault(Boolean(checked))
                }
                disabled={overrideDisabled}
              />
              <span>Standardbetrag verwenden</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={overrideDisabled}
                onCheckedChange={(checked) => {
                  const next = Boolean(checked);
                  setOverrideDisabled(next);
                  if (next) {
                    setOverrideUseDefault(false);
                  }
                }}
              />
              <span>In diesem Monat deaktivieren</span>
            </div>

            {selectedOverrideItem && (
              <div className="rounded-md border border-neutral-300 p-2 text-xs">
                <p className="mb-1 font-medium">Bereits gesetzte Overrides:</p>
                {Object.entries(selectedOverrideItem.overrides).length === 0 ? (
                  <p className="text-neutral-500">Keine</p>
                ) : (
                  Object.entries(selectedOverrideItem.overrides)
                    .sort(
                      (a, b) => monthKeyToIndex(a[0]) - monthKeyToIndex(b[0]),
                    )
                    .map(([month, override]) => (
                      <div
                        key={month}
                        className="flex items-center justify-between py-0.5"
                      >
                        <span>
                          {month}:{" "}
                          {override.disabled
                            ? "deaktiviert"
                            : `${override.amount ?? 0} €`}
                        </span>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() =>
                            updateItem(selectedOverrideItem.id, (item) => {
                              const next = { ...item.overrides };
                              delete next[month];
                              return { ...item, overrides: next };
                            })
                          }
                        >
                          Entfernen
                        </button>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverrideItemId(null)}
            >
              Schliessen
            </Button>
            <Button type="button" onClick={saveOverride}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
