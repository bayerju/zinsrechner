"use client";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import InfosHeader from "~/components/infos_header";
import Conditions from "~/components/conditions";
import Credits from "~/components/credits";

export default function Home() {
  return (
    <main
      className="flex min-h-screen w-full flex-col items-center bg-neutral-900 py-2"
      suppressHydrationWarning
    >
      {/* Ihre Kondition Card */}
      <InfosHeader />

      {/* Wie kommt Ihre Kondition zustande? Card */}
      <Card className="w-full max-w-xl">
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
