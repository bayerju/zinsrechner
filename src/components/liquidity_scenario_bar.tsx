"use client";

import { useState } from "react";
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
import { useAppState } from "~/state/app_state";

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
  const {
    activeLiquidityScenarioId: activeScenarioId,
    activeLiquidityScenario: active,
    liquidityScenarioList: scenarioList,
    setActiveLiquidityScenarioId,
    createLiquidityScenario,
    renameLiquidityScenario,
    deleteLiquidityScenarioById,
  } = useAppState();

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [createDuplicate, setCreateDuplicate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setIsActionsOpen(false);
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
    void createLiquidityScenario({
      id,
      name,
      createdAt: Date.now(),
      color: getNextScenarioColor(
        scenarioList.map((scenario) => scenario.color),
      ),
      duplicateFromActive: createDuplicate,
    });
    setIsCreateOpen(false);
  }

  function openRename() {
    if (!active) return;
    setIsActionsOpen(false);
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

    void renameLiquidityScenario(active.id, name);
    setIsRenameOpen(false);
  }

  function submitDelete() {
    if (!active || scenarioList.length <= 1) return;
    void deleteLiquidityScenarioById(active.id);
    setIsDeleteOpen(false);
  }

  function openDelete() {
    if (!active || scenarioList.length <= 1) return;
    setIsActionsOpen(false);
    setIsDeleteOpen(true);
  }

  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-neutral-300 p-2 sm:flex sm:flex-wrap lg:w-fit lg:pr-3">
      <span className="col-span-2 text-sm font-medium text-black sm:col-span-1">
        Liquiditaetsszenario
      </span>
      <select
        className="h-10 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 text-sm text-black sm:h-8 sm:w-auto sm:min-w-44 sm:flex-none lg:w-56"
        value={activeScenarioId}
        onChange={(e) => void setActiveLiquidityScenarioId(e.target.value)}
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
        className="h-10 px-3 sm:hidden"
        onClick={() => setIsActionsOpen(true)}
      >
        Aktionen
      </Button>
      <div className="hidden items-center gap-2 sm:flex">
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
          onClick={openDelete}
          disabled={!active || scenarioList.length <= 1}
        >
          Loeschen
        </Button>
      </div>

      <Dialog open={isActionsOpen} onOpenChange={setIsActionsOpen}>
        <DialogContent className="sm:hidden">
          <DialogHeader>
            <DialogTitle>Liquiditaetsszenario-Aktionen</DialogTitle>
            <DialogDescription>
              Aktionen fuer das aktive Szenario auswaehlen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openCreate(false)}
            >
              Neu
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openCreate(true)}
              disabled={!active}
            >
              Duplizieren
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openRename}
              disabled={!active}
            >
              Umbenennen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={openDelete}
              disabled={!active || scenarioList.length <= 1}
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
