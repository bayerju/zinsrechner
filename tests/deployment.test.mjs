import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  coolifyRequest,
  deploy,
  preflight,
  validate,
} from "../scripts/deploy-production.mjs";

const env = {
  COOLIFY_URL: "https://coolify.example.test",
  COOLIFY_APP_UUID: "app-123",
  COOLIFY_API_TOKEN: "test-read-write",
  COOLIFY_DEPLOY_TOKEN: "test-deploy",
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  CONVEX_DEPLOY_KEY: "prod:example|test-key",
  DEPLOY_IMAGE: "ghcr.io/example/app",
  DEPLOY_TAG: `sha-${"a".repeat(40)}`,
};
const app = {
  build_pack: "dockerimage",
  docker_registry_image_name: env.DEPLOY_IMAGE,
};
const json = (value) => new Response(JSON.stringify(value));
afterEach(() => mock.restoreAll());

test("only accepts a production key matching both frontend URLs", () => {
  assert.doesNotThrow(() => validate(env));
  assert.throws(
    () => validate({ ...env, CONVEX_DEPLOY_KEY: "dev:example|key" }),
    /production/,
  );
  assert.throws(
    () => validate({ ...env, CONVEX_DEPLOY_KEY: "prod:other|key" }),
    /does not match/,
  );
  assert.throws(
    () =>
      validate({
        ...env,
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://other.convex.site",
      }),
    /same cloud/,
  );
});

test("rejects server-side builds and unrelated images without modifying Coolify", async () => {
  for (const value of [
    { ...app, build_pack: "nixpacks" },
    { ...app, docker_registry_image_name: "ghcr.io/other/app" },
  ]) {
    const request = mock.method(globalThis, "fetch", async () => json(value));
    await assert.rejects(preflight(env), /server-side builds|does not match/);
    assert.equal(request.mock.calls.length, 1);
    assert.equal(request.mock.calls[0].arguments[1].method, "GET");
    mock.restoreAll();
  }
});

test("does not leak API error bodies or follow redirects", async () => {
  const request = mock.method(
    globalThis,
    "fetch",
    async () => new Response("private-secret", { status: 403 }),
  );
  await assert.rejects(coolifyRequest(env, "/version"), {
    message: "Coolify GET request failed (HTTP 403)",
  });
  assert.equal(request.mock.calls[0].arguments[1].redirect, "error");
});

for (const status of ["finished", "failed", "cancelled", "queued"]) {
  test(`release treats ${status} correctly and separates deployment credentials`, async () => {
    const responses = [
      app,
      {},
      {
        deployments: [
          { resource_uuid: env.COOLIFY_APP_UUID, deployment_uuid: "job" },
        ],
      },
      { status },
    ];
    const request = mock.method(globalThis, "fetch", async () =>
      json(responses.shift()),
    );
    const result = deploy(env, { pause: async () => {}, attempts: 1 });
    if (status === "finished") await result;
    else await assert.rejects(result, /failed|cancelled|Timed out/);
    const calls = request.mock.calls;
    assert.equal(calls[1].arguments[1].method, "PATCH");
    assert.deepEqual(JSON.parse(calls[1].arguments[1].body), {
      docker_registry_image_name: env.DEPLOY_IMAGE,
      docker_registry_image_tag: env.DEPLOY_TAG,
    });
    assert.equal(
      calls[1].arguments[1].headers.Authorization,
      "Bearer test-read-write",
    );
    assert.equal(
      calls[2].arguments[1].headers.Authorization,
      "Bearer test-deploy",
    );
  });
}
