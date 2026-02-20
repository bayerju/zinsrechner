"use client";

import { useAtom, useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
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
import { cn } from "~/lib/utils";

function createItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

const LABEL_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

function getLabelColor(label: string) {
  const hash = Array.from(label).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return LABEL_COLORS[hash % LABEL_COLORS.length] ?? "#3b82f6";
}

export default function LiquiditaetsplanPage() {
  const [values, setValues] = useAtom(activeLiquidityScenarioValuesAtom);
  const creditScenarios = useAtomValue(scenariosAtom);
  const creditScenarioValues = useAtomValue(scenarioValuesAtom);

  const [newIncomeName, setNewIncomeName] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState(0);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState(0);

  const [settingsItemId, setSettingsItemId] = useState<string | null>(null);
  const [settingsFrequency, setSettingsFrequency] =
    useState<LiquidityFrequency>("monthly");
  const [settingsStartMonth, setSettingsStartMonth] = useState(
    values.startMonth,
  );
  const [settingsEndMonth, setSettingsEndMonth] = useState("");
  const [settingsNewLabel, setSettingsNewLabel] = useState("");

  const [incomeLabelFilter, setIncomeLabelFilter] = useState<string[]>([]);
  const [expenseLabelFilter, setExpenseLabelFilter] = useState<string[]>([]);

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
  const settingsItem =
    values.items.find((item) => item.id === settingsItemId) ?? null;

  const incomeLabels = useMemo(
    () =>
      Array.from(
        new Set(
          values.items
            .filter((item) => item.type === "income")
            .flatMap((item) => item.labels),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [values.items],
  );
  const expenseLabels = useMemo(
    () =>
      Array.from(
        new Set(
          values.items
            .filter((item) => item.type === "expense")
            .flatMap((item) => item.labels),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [values.items],
  );

  const labelSuggestions = useMemo(() => {
    if (!settingsItem) return [] as string[];
    const pool = settingsItem.type === "income" ? incomeLabels : expenseLabels;
    return pool.filter((label) => !settingsItem.labels.includes(label));
  }, [settingsItem, incomeLabels, expenseLabels]);

  const incomeItems = values.items.filter(
    (item) =>
      item.type === "income" &&
      incomeLabelFilter.every((label) => item.labels.includes(label)),
  );
  const expenseItems = values.items.filter(
    (item) =>
      item.type === "expense" &&
      expenseLabelFilter.every((label) => item.labels.includes(label)),
  );

  const incomeFilteredSum = incomeItems.reduce(
    (sum, item) => sum + item.defaultAmount,
    0,
  );
  const expenseFilteredSum = expenseItems.reduce(
    (sum, item) => sum + item.defaultAmount,
    0,
  );

  function updateValues(
    update:
      | LiquidityScenarioValues
      | ((prev: LiquidityScenarioValues) => LiquidityScenarioValues),
  ) {
    setValues(update);
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

  function addItem(type: "income" | "expense") {
    const name = type === "income" ? newIncomeName : newExpenseName;
    const amount = type === "income" ? newIncomeAmount : newExpenseAmount;
    if (!name.trim()) return;

    const item: LiquidityItem = {
      id: createItemId(),
      name: name.trim(),
      type,
      defaultAmount: amount,
      labels: [],
      frequency: "monthly",
      startMonth: values.startMonth,
      endMonth: undefined,
      overrides: {},
    };

    updateValues((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));

    if (type === "income") {
      setNewIncomeName("");
      setNewIncomeAmount(0);
    } else {
      setNewExpenseName("");
      setNewExpenseAmount(0);
    }
  }

  function removeItem(itemId: string) {
    updateValues((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  }

  function openSettings(item: LiquidityItem) {
    setSettingsItemId(item.id);
    setSettingsFrequency(item.frequency);
    setSettingsStartMonth(item.startMonth);
    setSettingsEndMonth(item.endMonth ?? "");
    setSettingsNewLabel("");
  }

  function saveSettings() {
    if (!settingsItemId) return;
    updateItem(settingsItemId, (item) => ({
      ...item,
      frequency: settingsFrequency,
      startMonth: settingsStartMonth,
      endMonth: settingsEndMonth || undefined,
    }));
    setSettingsItemId(null);
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

  function addLabelToSettingsItem(explicitLabel?: string) {
    if (!settingsItemId) return;
    const label = (explicitLabel ?? settingsNewLabel).trim();
    if (!label) return;
    updateItem(settingsItemId, (item) => ({
      ...item,
      labels: item.labels.includes(label)
        ? item.labels
        : [...item.labels, label],
    }));
    setSettingsNewLabel("");
  }

  function removeLabelFromSettingsItem(label: string) {
    if (!settingsItemId) return;
    updateItem(settingsItemId, (item) => ({
      ...item,
      labels: item.labels.filter((current) => current !== label),
    }));
  }

  function toggleIncomeLabelFilter(label: string) {
    setIncomeLabelFilter((prev) =>
      prev.includes(label)
        ? prev.filter((current) => current !== label)
        : [...prev, label],
    );
  }

  function toggleExpenseLabelFilter(label: string) {
    setExpenseLabelFilter((prev) =>
      prev.includes(label)
        ? prev.filter((current) => current !== label)
        : [...prev, label],
    );
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
                  updateValues((prev) => ({ ...prev, startCapital: value }))
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
                  updateValues((prev) => ({ ...prev, creditScenarioId: value }))
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

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-md border border-neutral-300 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-black">Einnahmen</h4>
                <span className="text-sm font-medium text-green-700">
                  Summe: {incomeFilteredSum.toLocaleString("de-DE")} €
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-600">Filter (AND):</span>
                {incomeLabels.length === 0 ? (
                  <span className="text-xs text-neutral-400">Keine Labels</span>
                ) : (
                  incomeLabels.map((label) => {
                    const selected = incomeLabelFilter.includes(label);
                    return (
                      <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className="h-7"
                        onClick={() => toggleIncomeLabelFilter(label)}
                      >
                        <span style={{ color: getLabelColor(label) }}>#</span>
                        <span>{label}</span>
                      </Button>
                    );
                  })
                )}
                {incomeLabelFilter.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => setIncomeLabelFilter([])}
                  >
                    Zuruecksetzen
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_180px_auto] gap-2">
                <Input
                  className="h-9 border-neutral-300 bg-white text-black"
                  placeholder="Name"
                  value={newIncomeName}
                  onChange={(e) => setNewIncomeName(e.target.value)}
                />
                <NumberInput
                  unit="€"
                  className="h-9 border-neutral-300 bg-white text-black"
                  value={newIncomeAmount}
                  onChange={setNewIncomeAmount}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => addItem("income")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {incomeItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_180px_auto_auto] gap-2"
                >
                  <div className="relative">
                    {item.labels.length > 0 && (
                      <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center gap-0.5">
                        {item.labels.slice(0, 2).map((label) => (
                          <span
                            key={label}
                            className="text-xs font-semibold"
                            style={{ color: getLabelColor(label) }}
                          >
                            #
                          </span>
                        ))}
                        {item.labels.length > 2 && (
                          <span className="ml-1 text-[10px] text-neutral-500">
                            +{item.labels.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    <Input
                      className={cn(
                        "h-9 border-neutral-300 bg-white text-black",
                        item.labels.length > 0 && "pl-10",
                      )}
                      value={item.name}
                      onChange={(e) =>
                        updateItem(item.id, (old) => ({
                          ...old,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => openSettings(item)}
                    title="Einstellungen"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    title="Entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-md border border-neutral-300 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-black">Ausgaben</h4>
                <span className="text-sm font-medium text-red-700">
                  Summe: {expenseFilteredSum.toLocaleString("de-DE")} €
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-600">Filter (AND):</span>
                {expenseLabels.length === 0 ? (
                  <span className="text-xs text-neutral-400">Keine Labels</span>
                ) : (
                  expenseLabels.map((label) => {
                    const selected = expenseLabelFilter.includes(label);
                    return (
                      <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        className="h-7"
                        onClick={() => toggleExpenseLabelFilter(label)}
                      >
                        <span style={{ color: getLabelColor(label) }}>#</span>
                        <span>{label}</span>
                      </Button>
                    );
                  })
                )}
                {expenseLabelFilter.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => setExpenseLabelFilter([])}
                  >
                    Zuruecksetzen
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_180px_auto] gap-2">
                <Input
                  className="h-9 border-neutral-300 bg-white text-black"
                  placeholder="Name"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                />
                <NumberInput
                  unit="€"
                  className="h-9 border-neutral-300 bg-white text-black"
                  value={newExpenseAmount}
                  onChange={setNewExpenseAmount}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => addItem("expense")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {expenseItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_180px_auto_auto] gap-2"
                >
                  <div className="relative">
                    {item.labels.length > 0 && (
                      <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center gap-0.5">
                        {item.labels.slice(0, 2).map((label) => (
                          <span
                            key={label}
                            className="text-xs font-semibold"
                            style={{ color: getLabelColor(label) }}
                          >
                            #
                          </span>
                        ))}
                        {item.labels.length > 2 && (
                          <span className="ml-1 text-[10px] text-neutral-500">
                            +{item.labels.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    <Input
                      className={cn(
                        "h-9 border-neutral-300 bg-white text-black",
                        item.labels.length > 0 && "pl-10",
                      )}
                      value={item.name}
                      onChange={(e) =>
                        updateItem(item.id, (old) => ({
                          ...old,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => openSettings(item)}
                    title="Einstellungen"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    title="Entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={settingsItemId !== null}
        onOpenChange={(open) => !open && setSettingsItemId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Einstellungen {settingsItem ? `- ${settingsItem.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs text-neutral-700">
              Intervall
              <Select
                value={settingsFrequency}
                onValueChange={(value) =>
                  setSettingsFrequency(value as LiquidityFrequency)
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
            </label>

            <label className="text-xs text-neutral-700">
              Startmonat
              <MonthPicker
                className="h-9 border-neutral-300 bg-white text-black"
                value={settingsStartMonth}
                onChange={setSettingsStartMonth}
              />
            </label>

            <label className="text-xs text-neutral-700">
              Endmonat
              <MonthPicker
                className="h-9 border-neutral-300 bg-white text-black"
                value={settingsEndMonth}
                onChange={setSettingsEndMonth}
                placeholder="Kein Endmonat"
              />
            </label>

            <div className="space-y-2">
              <label className="text-xs text-neutral-700">Labels</label>
              <div className="flex gap-2">
                <Input
                  className="h-9 border-neutral-300 bg-white text-black"
                  placeholder="Label hinzufuegen"
                  list="label-suggestions"
                  value={settingsNewLabel}
                  onChange={(e) => setSettingsNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLabelToSettingsItem();
                    }
                  }}
                />
                <datalist id="label-suggestions">
                  {labelSuggestions.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </datalist>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addLabelToSettingsItem()}
                >
                  Hinzufuegen
                </Button>
              </div>
              {labelSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {labelSuggestions.slice(0, 8).map((label) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => addLabelToSettingsItem(label)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
              {settingsItem && settingsItem.labels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {settingsItem.labels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                      onClick={() => removeLabelFromSettingsItem(label)}
                      title="Label entfernen"
                    >
                      {label} ×
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">
                  Keine Labels gesetzt.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsEndMonth("")}
              >
                Endmonat entfernen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!settingsItem) return;
                  setOverrideItemId(settingsItem.id);
                  setOverrideMonth(values.startMonth);
                  setOverrideAmount(settingsItem.defaultAmount);
                  setOverrideUseDefault(true);
                  setOverrideDisabled(false);
                }}
              >
                Monatswerte anpassen
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsItemId(null)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={saveSettings}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
