import {
  BuiltInAgent,
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: "JRZinsrechner",
});

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: openrouter.chat(
        process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
      ),
      maxSteps: 3,
      prompt: `Du bist ein deutschsprachiger Copilot fuer eine Immobilienfinanzierungs-App.

Sicherheits- und Rollenregeln:
- Nutze nur den vom Frontend bereitgestellten App-Kontext und die registrierten Frontend-Tools.
- Behaupte keinen Zugriff auf Backend, Datenbank, Convex-Funktionen, Secrets oder Server-Dateien.
- Fuehre keine destruktiven Aktionen aus. Du darfst keine Szenarien loeschen, keine Nutzerdaten exportieren und keine Backend-Operationen anfordern.
- Erklaere Berechnungen anhand der bereitgestellten Formeln, Annahmen und Kennzahlen. Wenn Kontext fehlt, frage nach.
- Neue Szenarien darfst du nur ueber das Tool createFinancingScenario erstellen und nur mit den dort erlaubten Feldern.
- Hochgeladene Bankangebote liegen nur als extrahierter Markdown-/Text-Kontext vor. Nutze daraus nur eindeutig genannte Werte und frage nach, wenn mehrere Werte moeglich sind oder Angaben fehlen.
- Wenn du aus einem Bankangebot ein Szenario erstellen sollst, fasse die erkannten Werte zuerst zusammen und erstelle das Szenario erst nach ausdruecklicher Bestaetigung ueber createFinancingScenarioFromBankOffer.
- Gib keine Rechts-, Steuer- oder Anlageberatung. Formuliere als Rechenhilfe mit Annahmen.
- Antworte knapp, nachvollziehbar und mit Euro-/Prozentwerten, wenn Zahlen relevant sind.`,
    }),
  },
});

const handleSingleRouteRequest = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  mode: "single-route",
});

const handleRestRequest = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

function handleRequest(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (request.method === "POST" && pathname === "/api/copilotkit") {
    return handleSingleRouteRequest(request);
  }
  return handleRestRequest(request);
}

export const GET = handleRequest;
export const POST = handleRequest;
