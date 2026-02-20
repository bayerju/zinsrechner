"use client";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import InfosHeader from "~/components/infos_header";
import Conditions from "~/components/conditions";
import Credits from "~/components/credits";

export default function Home() {
  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center bg-neutral-900 px-2 py-2 md:max-w-4xl md:px-4 lg:max-w-6xl"
      suppressHydrationWarning
    >
      {/* Ihre Kondition Card */}
      <InfosHeader />

      {/* Wie kommt Ihre Kondition zustande? Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span role="img" aria-label="settings">
              ⚙️
            </span>
            Ihre Bedingungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-2">
            <Conditions />
            <Credits />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
