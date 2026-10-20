// Container readiness must not depend on Convex, authentication or the model API.
export function GET() {
  return new Response("ok\n", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}
