"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { authClient } from "~/lib/auth-client";

type SharedProject = NonNullable<
  ReturnType<typeof useQuery<typeof api.appState.getSharedProject>>
>;

export default function SharedProjectPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const sharedProject = useQuery(api.appState.getSharedProject, { token }) as
    | SharedProject
    | null
    | undefined;
  const importProject = useMutation(api.appState.importSharedProject);
  const { isAuthenticated } = useConvexAuth();
  const session = authClient.useSession();
  const [pendingImport, setPendingImport] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pendingImport || !isAuthenticated) return;
    void importProject({ token })
      .then(() => router.push("/"))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Projekt konnte nicht importiert werden.",
        );
        setPendingImport(false);
      });
  }, [importProject, isAuthenticated, pendingImport, router, token]);

  async function copyProject() {
    setError("");
    if (!session.data || session.data.user.isAnonymous) {
      setError(
        "Bitte melde dich zuerst im Rechner an und oeffne diesen Link danach erneut, um das Projekt zu kopieren.",
      );
      return;
    }
    setPendingImport(true);
  }

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

  return (
    <main className="min-h-screen bg-neutral-900 px-3 py-6 text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl border border-neutral-700 bg-neutral-950 p-5 shadow-2xl">
          <p className="text-sm tracking-wide text-neutral-400 uppercase">
            Geteiltes Projekt
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                {sharedProject.project.name}
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Read-only Ansicht. Du kannst das Projekt als eigene Kopie
                uebernehmen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void copyProject()}
                disabled={pendingImport}
              >
                {pendingImport
                  ? "Wird kopiert..."
                  : "In meine Projekte kopieren"}
              </Button>
              {(!session.data || session.data.user.isAnonymous) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/")}
                >
                  Zum Anmelden
                </Button>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
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
                  <ScenarioSummary
                    key={scenario.scenarioId}
                    title={scenario.name}
                  >
                    Kaufpreis: {formatCurrency(scenario.kaufpreis)} ·
                    Eigenkapital: {formatCurrency(scenario.eigenkapital)} ·
                    Effektivzins: {scenario.effzins}%
                  </ScenarioSummary>
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
