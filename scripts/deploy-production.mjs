import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

function required(env, key) {
  const value = env[key];
  if (!value || /[\r\n]/.test(value))
    throw new Error(`Missing or invalid ${key}`);
  return value;
}

function origin(env, key) {
  const url = new URL(required(env, key));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(`${key} must be an HTTPS origin`);
  return url.origin;
}

export function validate(env) {
  origin(env, "COOLIFY_URL");
  const cloud = new URL(origin(env, "NEXT_PUBLIC_CONVEX_URL"));
  const site = new URL(origin(env, "NEXT_PUBLIC_CONVEX_SITE_URL"));
  if (
    !cloud.hostname.endsWith(".convex.cloud") ||
    site.hostname !== cloud.hostname.replace(/\.cloud$/, ".site")
  )
    throw new Error("Convex URLs must refer to the same cloud deployment");
  const key = required(env, "CONVEX_DEPLOY_KEY");
  if (!key.startsWith("prod:"))
    throw new Error("Use a production Convex deployment key");
  if (
    key.split("|")[0] !==
    `prod:${cloud.hostname.replace(/\.convex\.cloud$/, "")}`
  )
    throw new Error(
      "CONVEX_DEPLOY_KEY does not match the frontend Convex URLs",
    );
  required(env, "COOLIFY_API_TOKEN");
  required(env, "COOLIFY_DEPLOY_TOKEN");
  appPath(env);
}

function appPath(env) {
  const uuid = required(env, "COOLIFY_APP_UUID");
  if (!/^[a-zA-Z0-9-]+$/.test(uuid))
    throw new Error("Invalid COOLIFY_APP_UUID");
  return `/applications/${uuid}`;
}

function imageConfig(env) {
  const image = required(env, "DEPLOY_IMAGE");
  const tag = required(env, "DEPLOY_TAG");
  if (!/^ghcr\.io\/[a-z0-9._-]+\/[a-z0-9._-]+$/.test(image))
    throw new Error("Invalid DEPLOY_IMAGE");
  if (!/^sha-[a-f0-9]{40}$/.test(tag))
    throw new Error("DEPLOY_TAG must contain the full commit SHA");
  return { docker_registry_image_name: image, docker_registry_image_tag: tag };
}

export async function coolifyRequest(
  env,
  path,
  { method = "GET", body, deploy = false } = {},
) {
  const base = origin(env, "COOLIFY_URL");
  const token = required(
    env,
    deploy ? "COOLIFY_DEPLOY_TOKEN" : "COOLIFY_API_TOKEN",
  );
  let response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      ...(method !== "GET" && body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "Coolify connection failed; check public DNS, HTTPS and API access",
    );
  }
  // Response bodies can contain environment values, logs or credentials.
  if (!response.ok)
    throw new Error(
      `Coolify ${method} request failed (HTTP ${response.status})`,
    );
  try {
    return await response.json();
  } catch {
    throw new Error("Coolify returned invalid JSON");
  }
}

export async function preflight(env) {
  const desired = imageConfig(env);
  const app = await coolifyRequest(env, appPath(env));
  if (app.build_pack !== "dockerimage")
    throw new Error(
      "Coolify must use Docker Image deployment; server-side builds are not allowed",
    );
  if (app.docker_registry_image_name !== desired.docker_registry_image_name)
    throw new Error(
      "Coolify application image does not match this repository; configure a Docker Image application first",
    );
  return app;
}

export async function deploy(env, { pause = sleep, attempts = 120 } = {}) {
  await preflight(env);
  await coolifyRequest(env, appPath(env), {
    method: "PATCH",
    body: imageConfig(env),
  });
  const result = await coolifyRequest(env, "/deploy", {
    method: "POST",
    deploy: true,
    body: { uuid: required(env, "COOLIFY_APP_UUID") },
  });
  const id = result.deployments?.find(
    (item) => item.resource_uuid === env.COOLIFY_APP_UUID,
  )?.deployment_uuid;
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]+$/.test(id))
    throw new Error("Coolify did not return a deployment ID");
  for (let attempt = 0; attempt < attempts; attempt++) {
    const job = await coolifyRequest(env, `/deployments/${id}`);
    if (job.status === "finished") {
      console.log("Coolify deployment finished successfully.");
      return;
    }
    if (["failed", "cancelled", "canceled"].includes(job.status))
      throw new Error(
        "Coolify deployment failed or was cancelled; inspect it in Coolify",
      );
    await pause(5000);
  }
  throw new Error(
    "Timed out waiting for Coolify; inspect the deployment before retrying",
  );
}

async function main() {
  const env = process.env;
  switch (process.argv[2]) {
    case "validate":
      validate(env);
      console.log("Production configuration validated.");
      break;
    case "preflight":
      await preflight(env);
      console.log("Coolify application is reachable and matches the image.");
      break;
    case "deploy":
      await deploy(env);
      break;
    default:
      throw new Error(
        "Usage: node scripts/deploy-production.mjs validate|preflight|deploy",
      );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
