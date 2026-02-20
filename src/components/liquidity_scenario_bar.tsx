"use client";

import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { getNextScenarioColor } from "~/lib/scenario_colors";
import {
  activeLiquidityScenarioIdAtom,
  defaultLiquidityScenarioId,
  defaultLiquidityScenarioValues,
  liquidityScenariosAtom,
  liquidityScenarioValuesAtom,
  type LiquidityScenario,
} from "~/state/liquidity_scenarios_atom";

function createScenarioId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function buildUniqueName(name: string, existing: Set<string>) {
  if (!existing.has(name)) return name;
  let index = 2;
  while (existing.has(`${name} ${index}`)) {
    index += 1;
  }
  return `${name} ${index}`;
}

export function LiquidityScenarioBar() {
  const [scenarios, setScenarios] = useAtom(liquidityScenariosAtom);
  const [activeScenarioId, setActiveScenarioId] = useAtom(
    activeLiquidityScenarioIdAtom,
  );
  const [, setScenarioValues] = useAtom(liquidityScenarioValuesAtom);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [createDuplicate, setCreateDuplicate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scenarioList = Object.values(scenarios).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const active = scenarios[activeScenarioId];

  useEffect(() => {
    if (scenarioList.length > 0) return;

    const initial: LiquidityScenario = {
      id: defaultLiquidityScenarioId,
      name: "Basis",
      createdAt: 0,
      color: "#60a5fa",
    };

    setScenarios({ [initial.id]: initial });
    setScenarioValues({ [initial.id]: defaultLiquidityScenarioValues });
    setActiveScenarioId(initial.id);
  }, [scenarioList, setScenarios, setScenarioValues, setActiveScenarioId]);

  useEffect(() => {
    if (active || !scenarioList[0]) return;
    setActiveScenarioId(scenarioList[0].id);
  }, [active, scenarioList, setActiveScenarioId]);

  function openCreate(duplicate: boolean) {
    const names = new Set(scenarioList.map((scenario) => scenario.name));
    const baseName = duplicate
      ? active
        ? `${active.name} Kopie`
        : "Szenario Kopie"
      : "Neues Szenario";
    setCreateDuplicate(duplicate);
    setCreateName(buildUniqueName(baseName, names));
    setError(null);
    setIsCreateOpen(true);
  }

  function submitCreate() {
    const name = createName.trim();
    if (!name) {
      setError("Szenarioname ist erforderlich.");
      return;
    }
    if (
      scenarioList.some(
        (scenario) => scenario.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("Ein Szenario mit diesem Namen existiert bereits.");
      return;
    }

    const id = createScenarioId();
    const nextMeta: LiquidityScenario = {
      id,
      name,
      createdAt: Date.now(),
      color: getNextScenarioColor(
        scenarioList.map((scenario) => scenario.color),
      ),
    };
    setScenarios((prev) => ({ ...prev, [id]: nextMeta }));
    setScenarioValues((prev) => {
      const baseValues = createDuplicate
        ? (prev[activeScenarioId] ?? defaultLiquidityScenarioValues)
        : defaultLiquidityScenarioValues;
      return {
        ...prev,
        [id]: structuredClone(baseValues),
      };
    });
    setActiveScenarioId(id);
    setIsCreateOpen(false);
  }

  function openRename() {
    if (!active) return;
    setRenameName(active.name);
    setError(null);
    setIsRenameOpen(true);
  }

  function submitRename() {
    if (!active) return;
    const name = renameName.trim();
    if (!name) {
      setError("Szenarioname ist erforderlich.");
      return;
    }
    if (
      scenarioList.some(
        (scenario) =>
          scenario.id !== active.id &&
          scenario.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("Ein Szenario mit diesem Namen existiert bereits.");
      return;
    }

    setScenarios((prev) => {
      const current = prev[active.id];
      if (!current) return prev;
      return {
        ...prev,
        [active.id]: {
          ...current,
          name,
        },
      };
    });
    setIsRenameOpen(false);
  }

  function submitDelete() {
    if (!active || scenarioList.length <= 1) return;
    const next = scenarioList.find((scenario) => scenario.id !== active.id);
    setScenarios((prev) => {
      const copy = { ...prev };
      delete copy[active.id];
      return copy;
    });
    setScenarioValues((prev) => {
      const copy = { ...prev };
      delete copy[active.id];
      return copy;
    });
    if (next) setActiveScenarioId(next.id);
    setIsDeleteOpen(false);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 p-2">
      <span className="text-sm font-medium text-black">
        Liquiditaetsszenario
      </span>
      <select
        className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm text-black sm:min-w-44 sm:flex-none"
        value={activeScenarioId}
        onChange={(e) => setActiveScenarioId(e.target.value)}
      >
        {scenarioList.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openCreate(false)}
      >
        Neu
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openCreate(true)}
        disabled={!active}
      >
        Duplizieren
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={openRename}
        disabled={!active}
      >
        Umbenennen
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsDeleteOpen(true)}
        disabled={!active || scenarioList.length <= 1}
      >
        Loeschen
      </Button>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createDuplicate
                ? "Liquiditaetsszenario duplizieren"
                : "Neues Liquiditaetsszenario"}
            </DialogTitle>
            <DialogDescription>Bitte Namen festlegen.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={createName}
            onChange={(e) => {
              setCreateName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCreate();
              }
            }}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={submitCreate}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liquiditaetsszenario umbenennen</DialogTitle>
            <DialogDescription>Bitte neuen Namen festlegen.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameName}
            onChange={(e) => {
              setRenameName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRename();
              }
            }}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRenameOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={submitRename}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liquiditaetsszenario loeschen?</DialogTitle>
            <DialogDescription>
              Das Szenario {active ? `"${active.name}"` : ""} wird entfernt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" onClick={submitDelete}>
              Loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
