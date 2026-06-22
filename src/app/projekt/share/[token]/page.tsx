"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

type SharedProject = NonNullable<
  ReturnType<typeof useQuery<typeof api.appState.getSharedProject>>
>;
type FinancingScenario = SharedProject["financingScenarios"][number];

export default function SharedProjectPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const sharedProject = useQuery(api.appState.getSharedProject, { token }) as
    | SharedProject
    | null
    | undefined;
  const updateProject = useMutation(api.appState.updateSharedProject);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (sharedProject) setProjectName(sharedProject.project.name);
  }, [sharedProject]);

  if (sharedProject === undefined) {
    return <ShareShell title="Projekt wird geladen" />;
  }

  if (sharedProject === null) {
    return (
      <ShareShell
        title="Link nicht verfuegbar"
        description="Der Link ist ungueltig oder wurde deaktiviert."
      />
    );
  }

  const canEdit = sharedProject.access === "edit";

  async function saveProjectName() {
    if (!canEdit) return;
    setError("");
    try {
      await updateProject({ token, name: projectName });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Projekt konnte nicht gespeichert werden.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-neutral-900 px-3 py-6 text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl border border-neutral-700 bg-neutral-950 p-5 shadow-2xl">
          <p className="text-sm tracking-wide text-neutral-400 uppercase">
            Geteiltes Live-Projekt
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <div className="flex max-w-xl gap-2">
                  <Input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    onBlur={() => void saveProjectName()}
                    className="bg-white text-black"
                  />
                  <Button type="button" onClick={() => void saveProjectName()}>
                    Speichern
                  </Button>
                </div>
              ) : (
                <h1 className="text-2xl font-semibold text-white">
                  {sharedProject.project.name}
                </h1>
              )}
              <p className="mt-2 text-sm text-neutral-400">
                {canEdit
                  ? "Bearbeitungslink: Aenderungen werden direkt im Originalprojekt gespeichert."
                  : "Nur-Lesen-Link: Du siehst laufend die aktuellen Daten des Originalprojekts."}
              </p>
            </div>
            <span className="w-fit rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-200">
              {canEdit ? "Bearbeiten erlaubt" : "Nur ansehen"}
            </span>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild type="button">
              <Link href={`/projekt/share/${token}/konditionen`}>
                Konditionen ansehen
              </Link>
            </Button>
            <Button
              asChild
              type="button"
              variant="outline"
              className="bg-white text-black hover:bg-neutral-100 hover:text-black"
            >
              <Link href={`/projekt/share/${token}/finanzplan`}>
                Finanzplan ansehen
              </Link>
            </Button>
            <Button
              asChild
              type="button"
              variant="outline"
              className="bg-white text-black hover:bg-neutral-100 hover:text-black"
            >
              <Link href={`/projekt/share/${token}/liquiditaetsplan`}>
                Liquiditaetsplan ansehen
              </Link>
            </Button>
            <Button
              asChild
              type="button"
              variant="outline"
              className="bg-white text-black hover:bg-neutral-100 hover:text-black"
            >
              <Link href={`/projekt/share/${token}/liquiditaetsauswertung`}>
                Auswertung ansehen
              </Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Finanzierungsszenarien</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sharedProject.financingScenarios.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Keine Szenarien vorhanden.
                </p>
              ) : (
                sharedProject.financingScenarios.map((scenario) => (
                  <FinancingScenarioCard
                    key={scenario.scenarioId}
                    token={token}
                    scenario={scenario}
                    canEdit={canEdit}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liquiditaetsszenarien</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sharedProject.liquidityScenarios.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Keine Szenarien vorhanden.
                </p>
              ) : (
                sharedProject.liquidityScenarios.map((scenario) => (
                  <ScenarioSummary
                    key={scenario.scenarioId}
                    title={scenario.name}
                  >
                    Startkapital: {formatCurrency(scenario.startCapital)} ·
                    Start: {scenario.startMonth} · Horizont:{" "}
                    {scenario.horizonMonths} Monate
                  </ScenarioSummary>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function FinancingScenarioCard({
  token,
  scenario,
  canEdit,
}: {
  token: string;
  scenario: FinancingScenario;
  canEdit: boolean;
}) {
  const updateScenario = useMutation(
    api.appState.updateSharedFinancingScenario,
  );
  const [draft, setDraft] = useState(scenario);
  const [error, setError] = useState("");

  useEffect(() => setDraft(scenario), [scenario]);

  async function save() {
    if (!canEdit) return;
    setError("");
    try {
      await updateScenario({ token, scenario: draft });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Szenario konnte nicht gespeichert werden.",
      );
    }
  }

  if (!canEdit) {
    return (
      <ScenarioSummary title={scenario.name}>
        Kaufpreis: {formatCurrency(scenario.kaufpreis)} · Eigenkapital:{" "}
        {formatCurrency(scenario.eigenkapital)} · Effektivzins:{" "}
        {scenario.effzins}%
      </ScenarioSummary>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
      <Input
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        onBlur={() => void save()}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <NumberField
          label="Kaufpreis"
          value={draft.kaufpreis}
          onChange={(kaufpreis) => setDraft({ ...draft, kaufpreis })}
          onBlur={save}
        />
        <NumberField
          label="Eigenkapital"
          value={draft.eigenkapital}
          onChange={(eigenkapital) => setDraft({ ...draft, eigenkapital })}
          onBlur={save}
        />
        <NumberField
          label="Effektivzins %"
          value={draft.effzins}
          onChange={(effzins) => setDraft({ ...draft, effzins })}
          onBlur={save}
        />
        <NumberField
          label="Tilgungssatz %"
          value={draft.tilgungssatz}
          onChange={(tilgungssatz) => setDraft({ ...draft, tilgungssatz })}
          onBlur={save}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void | Promise<void>;
}) {
  return (
    <label className="block text-xs text-neutral-600">
      {label}
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={() => void onBlur()}
        className="mt-1"
      />
    </label>
  );
}

function ScenarioSummary({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-sm">
      <p className="font-medium text-black">{title}</p>
      <p className="mt-1 text-neutral-600">{children}</p>
    </div>
  );
}

function ShareShell({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-900 px-4 text-neutral-100">
      <div className="rounded-2xl border border-neutral-700 bg-neutral-950 p-6 text-center shadow-2xl">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-neutral-400">{description}</p>
        )}
      </div>
    </main>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
