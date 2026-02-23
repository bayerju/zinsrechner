"use client";

import { useEffect, useRef, useState } from "react";
import { atom, useAtom, useSetAtom } from "jotai";
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
import {
  activeScenarioIdAtom,
  defaultScenarioId,
  scenariosAtom,
  type Scenario,
} from "~/state/scenarios_atom";
import {
  defaultScenarioValues,
  scenarioValuesAtom,
} from "~/state/scenario_values_atom";
import {
  defaultScenarioColor,
  getNextScenarioColor,
} from "~/lib/scenario_colors";

function createScenarioId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function buildUniqueName(name: string, takenNames: Set<string>) {
  if (!takenNames.has(name)) return name;
  let i = 2;
  while (takenNames.has(`${name} ${i}`)) {
    i += 1;
  }
  return `${name} ${i}`;
}

const createScenarioAndSelectAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      id: string;
      name: string;
      createdAt: number;
      color: string;
      duplicateFromActive: boolean;
    },
  ) => {
    const { id, name, createdAt, color, duplicateFromActive } = payload;
    const sourceScenarioId = get(activeScenarioIdAtom);

    set(scenariosAtom, (prev) => ({
      ...prev,
      [id]: { id, name, createdAt, color },
    }));

    set(scenarioValuesAtom, (prev) => {
      const sourceValues = prev[sourceScenarioId] ?? defaultScenarioValues;
      const nextValues = duplicateFromActive
        ? structuredClone(sourceValues)
        : structuredClone(defaultScenarioValues);
      return {
        ...prev,
        [id]: nextValues,
      };
    });

    set(activeScenarioIdAtom, id);
  },
);

export function ScenarioBar() {
  const [scenarios, setScenarios] = useAtom(scenariosAtom);
  const [activeScenarioId, setActiveScenarioId] = useAtom(activeScenarioIdAtom);
  const [, setScenarioValues] = useAtom(scenarioValuesAtom);
  const createScenarioAndSelect = useSetAtom(createScenarioAndSelectAtom);
  const hasValidatedInitialSelectionRef = useRef(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDuplicateFromActive, setCreateDuplicateFromActive] =
    useState(false);
  const [createValue, setCreateValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const scenarioList = Object.values(scenarios).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const activeScenario = scenarios[activeScenarioId];
  const debugEnabled = process.env.NODE_ENV !== "production";

  function debugLog(message: string, details?: Record<string, unknown>) {
    if (!debugEnabled) return;
    console.info("[ScenarioBar]", message, {
      activeScenarioId,
      scenarioIds: scenarioList.map((scenario) => scenario.id),
      ...details,
    });
  }

  useEffect(() => {
    if (scenarioList.length === 0) {
      const defaultScenario: Scenario = {
        id: defaultScenarioId,
        name: "Basis",
        createdAt: 0,
        color: defaultScenarioColor,
      };
      setScenarios({ [defaultScenario.id]: defaultScenario });
      setActiveScenarioId(defaultScenario.id);
      setScenarioValues({ [defaultScenario.id]: defaultScenarioValues });
      hasValidatedInitialSelectionRef.current = true;
      return;
    }

    if (hasValidatedInitialSelectionRef.current) {
      return;
    }

    hasValidatedInitialSelectionRef.current = true;

    if (activeScenario) {
      return;
    }

    if (!scenarioList[0]) return;

    if (debugEnabled) {
      console.info("[ScenarioBar]", "fallback to first scenario", {
        activeScenarioId,
        scenarioIds: scenarioList.map((scenario) => scenario.id),
        fallbackScenarioId: scenarioList[0].id,
      });
    }
    setActiveScenarioId(scenarioList[0].id);
  }, [
    activeScenario,
    activeScenarioId,
    debugEnabled,
    scenarioList,
    setActiveScenarioId,
    setScenarios,
    setScenarioValues,
  ]);

  useEffect(() => {
    if (!debugEnabled) return;
    console.info("[ScenarioBar]", "state snapshot", {
      activeScenarioId,
      hasActiveScenario: Boolean(activeScenario),
      scenarioIds: scenarioList.map((scenario) => scenario.id),
    });
  }, [activeScenario, activeScenarioId, debugEnabled, scenarioList]);

  function createScenario(name: string, duplicateFromActive = false) {
    const id = createScenarioId();
    const createdAt = Date.now();
    const color = getNextScenarioColor(scenarioList.map((item) => item.color));

    createScenarioAndSelect({
      id,
      name,
      createdAt,
      color,
      duplicateFromActive,
    });
    debugLog("created scenario", {
      createdScenarioId: id,
      createdScenarioName: name,
      duplicateFromActive,
    });
  }

  function openCreateDialog(duplicateFromActive: boolean) {
    const existingNames = new Set(
      scenarioList.map((scenario) => scenario.name),
    );
    const baseName = duplicateFromActive
      ? activeScenario
        ? `${activeScenario.name} Kopie`
        : "Szenario Kopie"
      : "Neues Szenario";

    setCreateDuplicateFromActive(duplicateFromActive);
    setCreateValue(buildUniqueName(baseName, existingNames));
    setCreateError(null);
    setIsActionsOpen(false);
    setIsCreateOpen(true);
  }

  function submitCreateScenario() {
    const name = createValue.trim();
    if (!name) {
      setCreateError("Szenarioname ist erforderlich.");
      return;
    }

    const nameTaken = scenarioList.some(
      (scenario) => scenario.name.toLowerCase() === name.toLowerCase(),
    );
    if (nameTaken) {
      setCreateError("Ein Szenario mit diesem Namen existiert bereits.");
      return;
    }

    createScenario(name, createDuplicateFromActive);
    setIsCreateOpen(false);
  }

  function openRenameDialog() {
    if (!activeScenario) return;
    setIsActionsOpen(false);
    setRenameValue(activeScenario.name);
    setRenameError(null);
    setIsRenameOpen(true);
  }

  function renameActiveScenario() {
    if (!activeScenario) return;
    const name = renameValue.trim();
    if (!name || name === activeScenario.name) return;

    const nameTaken = scenarioList.some(
      (scenario) =>
        scenario.id !== activeScenario.id &&
        scenario.name.toLowerCase() === name.toLowerCase(),
    );
    if (nameTaken) {
      setRenameError("Ein Szenario mit diesem Namen existiert bereits.");
      return;
    }

    setScenarios((prev) => {
      const existing = prev[activeScenario.id];
      if (!existing) return prev;
      return {
        ...prev,
        [activeScenario.id]: {
          ...existing,
          name,
        },
      };
    });
    setIsRenameOpen(false);
  }

  function openDeleteDialog() {
    if (!activeScenario || scenarioList.length <= 1) return;
    setIsActionsOpen(false);
    setIsDeleteOpen(true);
  }

  function deleteActiveScenario() {
    if (!activeScenario) return;
    if (scenarioList.length <= 1) return;

    const nextScenario = scenarioList.find(
      (scenario) => scenario.id !== activeScenario.id,
    );

    setScenarios((prev) => {
      const next = { ...prev };
      delete next[activeScenario.id];
      return next;
    });
    setScenarioValues((prev) => {
      const next = { ...prev };
      delete next[activeScenario.id];
      return next;
    });
    if (nextScenario) {
      setActiveScenarioId(nextScenario.id);
    }
    setIsDeleteOpen(false);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 p-2">
      <span className="text-sm font-medium text-black">Szenario</span>
      <select
        className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm text-black sm:min-w-44 sm:flex-none"
        value={activeScenarioId}
        onChange={(e) => {
          const nextId = e.target.value;
          debugLog("manual scenario select", { nextScenarioId: nextId });
          setActiveScenarioId(nextId);
        }}
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
        className="sm:hidden"
        onClick={() => setIsActionsOpen(true)}
      >
        Aktionen
      </Button>
      <div className="hidden items-center gap-2 sm:flex">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => openCreateDialog(false)}
        >
          Neu
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => openCreateDialog(true)}
          disabled={!activeScenario}
        >
          Duplizieren
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openRenameDialog}
          disabled={!activeScenario}
        >
          Umbenennen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openDeleteDialog}
          disabled={!activeScenario || scenarioList.length <= 1}
        >
          Loeschen
        </Button>
      </div>
      <Dialog open={isActionsOpen} onOpenChange={setIsActionsOpen}>
        <DialogContent className="sm:hidden">
          <DialogHeader>
            <DialogTitle>Szenario-Aktionen</DialogTitle>
            <DialogDescription>
              Aktionen fuer das aktive Szenario auswaehlen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                openCreateDialog(false);
              }}
            >
              Neu
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                openCreateDialog(true);
              }}
              disabled={!activeScenario}
            >
              Duplizieren
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openRenameDialog}
              disabled={!activeScenario}
            >
              Umbenennen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={openDeleteDialog}
              disabled={!activeScenario || scenarioList.length <= 1}
            >
              Loeschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createDuplicateFromActive
                ? "Szenario duplizieren"
                : "Neues Szenario"}
            </DialogTitle>
            <DialogDescription>
              Gib einen Namen fuer das neue Szenario ein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={createValue}
              onChange={(e) => {
                setCreateValue(e.target.value);
                if (createError) setCreateError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCreateScenario();
                }
              }}
              placeholder="Szenarioname"
            />
            {createError && (
              <p className="text-sm text-red-500">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={submitCreateScenario}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Szenario umbenennen</DialogTitle>
            <DialogDescription>
              Gib einen neuen Namen fuer das aktive Szenario ein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                if (renameError) setRenameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  renameActiveScenario();
                }
              }}
              placeholder="Szenarioname"
            />
            {renameError && (
              <p className="text-sm text-red-500">{renameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRenameOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={renameActiveScenario}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Szenario loeschen?</DialogTitle>
            <DialogDescription>
              Das Szenario
              {activeScenario ? ` \"${activeScenario.name}\" ` : " "}
              wird entfernt. Dieser Schritt kann nicht rueckgaengig gemacht
              werden.
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
            <Button
              type="button"
              variant="destructive"
              onClick={deleteActiveScenario}
            >
              Loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
