import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const image = process.argv[2];
if (!image || image.startsWith("-"))
  throw new Error("Usage: node scripts/smoke-image.mjs <image>");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const container = docker(
  "run",
  "--detach",
  "--publish",
  "127.0.0.1::3000",
  "--env",
  "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:9",
  "--env",
  "NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:9",
  image,
);
try {
  const port = docker("port", container, "3000/tcp").split(":").at(-1);
  const base = `http://127.0.0.1:${port}`;
  const request = (path, options) =>
    fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(30000) });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await request("/healthz");
      if (response.ok && (await response.text()).trim() === "ok") {
        ready = true;
        break;
      }
    } catch {
      /* Runtime may still be starting. */
    }
    await sleep(500);
  }
  assert(ready, "Container did not become ready");
  const root = await request("/");
  assert.equal(root.status, 200);
  const html = await root.text();
  const asset = html.match(/src="(\/_next\/static\/[^"\s]+\.js)"/)?.[1];
  assert(asset, "Next.js client asset is missing");
  assert.equal((await request(asset)).status, 200);
  assert.equal((await request("/favicon.ico")).status, 200);
  assert.equal((await request("/finanzplan")).status, 200);
  assert.equal(
    (await request("/projekt/share/smoke-test/finanzplan")).status,
    200,
  );
  // Import and execute the server-only document parser without third-party services.
  const form = new FormData();
  form.append("file", new Blob(["Runtime extraction works"]), "offer.txt");
  const extracted = await request("/api/documents/extract", {
    method: "POST",
    body: form,
  });
  assert.equal(extracted.status, 200, "Document extraction route failed");
  assert.equal((await extracted.json()).markdown, "Runtime extraction works");
  const rtf = new FormData();
  rtf.append(
    "file",
    new Blob(["{\\rtf1\\ansi Runtime parser works}"]),
    "offer.rtf",
  );
  const converted = await request("/api/documents/extract", {
    method: "POST",
    body: rtf,
  });
  assert.equal(
    converted.status,
    200,
    "Packaged officeparser conversion failed",
  );
  assert.match((await converted.json()).markdown, /Runtime parser works/);
  // PDF parsing exercises native dependencies and dynamically loaded parser assets
  // that standalone output tracing might otherwise accidentally omit.
  const pdfText = "BT /F1 12 Tf 20 100 Td (Runtime PDF works) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${pdfText.length} >>\nstream\n${pdfText}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const pdfForm = new FormData();
  pdfForm.append(
    "file",
    new Blob([pdf], { type: "application/pdf" }),
    "offer.pdf",
  );
  const pdfResponse = await request("/api/documents/extract", {
    method: "POST",
    body: pdfForm,
  });
  assert.equal(pdfResponse.status, 200, "Packaged PDF extraction failed");
  assert.match((await pdfResponse.json()).markdown, /Runtime PDF works/);
  // Copilot's discovery endpoint loads the runtime without spending model tokens.
  const info = await request("/api/copilotkit/info");
  assert.equal(info.status, 200, "Copilot runtime failed to load");
  assert((await info.json()).agents, "Copilot agent discovery is missing");
  assert.notEqual(
    docker("exec", container, "id", "-u"),
    "0",
    "Runtime must not run as root",
  );
  docker(
    "exec",
    container,
    "node",
    "--input-type=module",
    "-e",
    `
    import { readdirSync } from 'node:fs';
    import assert from 'node:assert/strict';
    for (const path of readdirSync('/app', { recursive: true })) {
      assert(!/(^|\\/)\\.env[^/]*(\\/|$)|(^|\\/)\\.next\\/cache(\\/|$)/.test(path), 'Unexpected env file or build cache');
    }
  `,
  );
  console.log(
    "Image smoke test passed: health, pages, assets, extraction, Copilot, non-root runtime, no env files/build cache.",
  );
} finally {
  docker("rm", "--force", container);
}
