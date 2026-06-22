"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { authClient } from "~/lib/auth-client";
import { useAppState } from "~/state/app_state";
import { TopNav } from "~/components/top_nav";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type Overview = NonNullable<
  ReturnType<typeof useQuery<typeof api.appState.getProjectOverview>>
>;
type LiquidityScenario = Overview["liquidityScenarios"][number];
type ShareAccess = "view" | "edit";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function uniqueName(base: string, names: Set<string>) {
  if (!names.has(base.toLowerCase())) return base;
  let index = 2;
  while (names.has(`${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const isSignedIn = !!session.data && !session.data.user.isAnonymous;
  const overview = useQuery(
    api.appState.getProjectOverview,
    isSignedIn ? {} : "skip",
  );
  const moveFinancingScenario = useMutation(
    api.appState.moveFinancingScenarioToProject,
  );
  const {
    activeProjectId,
    setActiveProjectId,
    createProject,
    renameProject,
    deleteProject,
    createProjectShare,
    revokeProjectShare,
  } = useAppState();
  const [dialog, setDialog] = useState<
    | { type: "create" }
    | { type: "rename"; projectId: string }
    | { type: "delete"; projectId: string }
    | { type: "share"; projectId: string; url: string }
    | null
  >(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selectedLiquidity, setSelectedLiquidity] = useState<Set<string>>(
    new Set(),
  );
  const [shareAccess, setShareAccess] = useState<ShareAccess>("view");
  const [copyStatus, setCopyStatus] = useState("");

  const projects = overview?.projects ?? [];
  const financingByProject = useMemo(
    () => groupByProject(overview?.financingScenarios ?? []),
    [overview?.financingScenarios],
  );
  const liquidityScenarios = overview?.liquidityScenarios ?? [];

  function projectName(projectId: string) {
    return (
      projects.find((project) => project.projectId === projectId)?.name ??
      projectId
    );
  }

  function openCreate() {
    const names = new Set(
      projects.map((project) => project.name.toLowerCase()),
    );
    setName(uniqueName("Neues Projekt", names));
    setError("");
    setDialog({ type: "create" });
  }

  function openRename(projectId: string) {
    const project = projects.find((item) => item.projectId === projectId);
    if (!project) return;
    setName(project.name);
    setError("");
    setDialog({ type: "rename", projectId });
  }

  async function submitName() {
    const nextName = name.trim();
    if (!nextName) {
      setError("Projektname ist erforderlich.");
      return;
    }
    const renamedProjectId = dialog?.type === "rename" ? dialog.projectId : "";
    const nameTaken = projects.some(
      (project) =>
        project.projectId !== renamedProjectId &&
        project.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (nameTaken) {
      setError("Ein Projekt mit diesem Namen existiert bereits.");
      return;
    }
    if (dialog?.type === "create") {
      await createProject({
        id: createId(),
        name: nextName,
        createdAt: Date.now(),
      });
    } else if (dialog?.type === "rename") {
      await renameProject(dialog.projectId, nextName);
    }
    setDialog(null);
  }

  async function openShare(projectId: string) {
    setSelectedLiquidity(new Set());
    setShareAccess("view");
    setCopyStatus("");
    setError("");
    setDialog({ type: "share", projectId, url: "" });
    const token = await createProjectShare(projectId, [], "view");
    setDialog({
      type: "share",
      projectId,
      url: `${window.location.origin}/projekt/share/${token}`,
    });
  }

  async function regenerateShareLink() {
    if (dialog?.type !== "share") return;
    setCopyStatus("");
    const token = await createProjectShare(
      dialog.projectId,
      [...selectedLiquidity],
      shareAccess,
    );
    setDialog({
      type: "share",
      projectId: dialog.projectId,
      url: `${window.location.origin}/projekt/share/${token}`,
    });
  }

  async function openProject(projectId: string) {
    await setActiveProjectId(projectId);
    router.push("/");
  }

  if (session.isPending || (isSignedIn && overview === undefined)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
        <Card className="w-full">
          <CardContent className="grid place-items-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
        <Card className="w-full">
          <CardContent className="space-y-3">
            <TopNav />
            <div className="space-y-3 pt-2">
              <h2 className="text-lg font-semibold text-black">Projekte</h2>
              <p className="text-sm text-neutral-600">
                Projekte sind nur fuer angemeldete Nutzer. Ohne Anmeldung kannst
                du weiterhin mit Szenarien im Standardbereich arbeiten.
              </p>
              <Button asChild>
                <Link href="/">Zurueck zum Rechner</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl">
      <Card className="w-full">
        <CardContent className="space-y-3">
          <TopNav />

          <div className="flex items-center justify-between pt-2">
            <h2 className="text-lg font-semibold text-black">Projekte</h2>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Neues Projekt
            </Button>
          </div>

          <div className="space-y-3">
            {projects.map((project) => {
              const financing = financingByProject.get(project.projectId) ?? [];
              const isActive = project.projectId === activeProjectId;
              return (
                <div
                  key={project.projectId}
                  className="rounded-md border border-neutral-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-black">
                        {project.name}
                        {isActive && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            aktiv
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {financing.length} Finanzierungsszenario
                        {financing.length === 1 ? "" : "n"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openProject(project.projectId)}
                        disabled={isActive}
                      >
                        Oeffnen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openRename(project.projectId)}
                      >
                        Umbenennen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openShare(project.projectId)}
                      >
                        Teilen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          project.projectId === "default" ||
                          projects.length <= 1
                        }
                        onClick={() =>
                          setDialog({
                            type: "delete",
                            projectId: project.projectId,
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {financing.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {financing.map((scenario) => (
                        <div
                          key={scenario.scenarioId}
                          className="flex items-center gap-2 rounded-md border border-neutral-200 p-2"
                        >
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: scenario.color }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                            {scenario.name}
                          </span>
                          <label className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
                            <span className="hidden sm:inline">
                              Verschieben
                            </span>
                            <select
                              className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-black"
                              value={scenario.projectId}
                              onChange={(event) => {
                                if (event.target.value !== scenario.projectId) {
                                  void moveFinancingScenario({
                                    scenarioId: scenario.scenarioId,
                                    fromProjectId: scenario.projectId,
                                    toProjectId: event.target.value,
                                  });
                                }
                              }}
                            >
                              {projects.map((target) => (
                                <option
                                  key={target.projectId}
                                  value={target.projectId}
                                >
                                  {projectName(target.projectId)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create / Rename dialog */}
      <Dialog
        open={dialog?.type === "create" || dialog?.type === "rename"}
        onOpenChange={() => setDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "create"
                ? "Neues Projekt"
                : "Projekt umbenennen"}
            </DialogTitle>
            <DialogDescription>Gib einen Projektnamen ein.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitName();
              }
            }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog(null)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={() => void submitName()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={dialog?.type === "delete"}
        onOpenChange={() => setDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Projekt loeschen?</DialogTitle>
            <DialogDescription>
              Alle Finanzierungsszenarien in diesem Projekt werden dauerhaft
              entfernt. Liquiditaetsszenarien bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (dialog?.type === "delete")
                  void deleteProject(dialog.projectId);
                setDialog(null);
              }}
            >
              Loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog
        open={dialog?.type === "share"}
        onOpenChange={() => setDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Projekt teilen</DialogTitle>
            <DialogDescription>
              Waehle, welche Liquiditaetsszenarien zusaetzlich zu den
              Finanzierungsszenarien geteilt werden sollen. Der Link zeigt die
              Live-Daten des Projekts; es wird keine Kopie erstellt.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 rounded-md border border-neutral-200 p-2 text-sm text-black sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-neutral-50">
              <input
                type="radio"
                name="shareAccess"
                checked={shareAccess === "view"}
                onChange={() => setShareAccess("view")}
              />
              Nur ansehen
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-neutral-50">
              <input
                type="radio"
                name="shareAccess"
                checked={shareAccess === "edit"}
                onChange={() => setShareAccess("edit")}
              />
              Bearbeiten erlauben
            </label>
          </div>

          {liquidityScenarios.length > 0 && (
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
              {liquidityScenarios.map((scenario) => (
                <LiquidityCheck
                  key={scenario.scenarioId}
                  scenario={scenario}
                  checked={selectedLiquidity.has(scenario.scenarioId)}
                  onToggle={() => {
                    setSelectedLiquidity((prev) => {
                      const next = new Set(prev);
                      if (next.has(scenario.scenarioId))
                        next.delete(scenario.scenarioId);
                      else next.add(scenario.scenarioId);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}

          {dialog?.type === "share" && dialog.url && (
            <Input
              readOnly
              value={dialog.url}
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
          {copyStatus && (
            <p className="text-sm text-emerald-700">{copyStatus}</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (dialog?.type === "share")
                  void revokeProjectShare(dialog.projectId);
                setDialog(null);
              }}
            >
              Link deaktivieren
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void regenerateShareLink()}
            >
              Link aktualisieren
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (dialog?.type === "share" && dialog.url) {
                  void navigator.clipboard
                    .writeText(dialog.url)
                    .then(() => setCopyStatus("Link wurde kopiert."))
                    .catch(() => setError("Link konnte nicht kopiert werden."));
                }
              }}
            >
              {copyStatus ? "Kopiert" : "Link kopieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function LiquidityCheck({
  scenario,
  checked,
  onToggle,
}: {
  scenario: LiquidityScenario;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-neutral-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 rounded border-neutral-300"
      />
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: scenario.color }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-black">
        {scenario.name}
      </span>
    </label>
  );
}

function groupByProject<
  Scenario extends { projectId: string; createdAt: number },
>(scenarios: Scenario[]) {
  const grouped = new Map<string, Scenario[]>();
  for (const scenario of scenarios) {
    const existing = grouped.get(scenario.projectId) ?? [];
    existing.push(scenario);
    grouped.set(scenario.projectId, existing);
  }
  for (const rows of grouped.values()) {
    rows.sort((left, right) => left.createdAt - right.createdAt);
  }
  return grouped;
}
