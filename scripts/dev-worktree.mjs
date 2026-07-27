#!/usr/bin/env node

// @ts-check

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const BASE_PORTS = Object.freeze({
  web: 3011,
  convexCloud: 23011,
  convexSite: 43011,
});
const MAX_HASH_OFFSET = 10_000;
const MAX_PORT = 65_535;
const CONVEX_READY_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;
const RESTART_TIMEOUT_MS = 5_000;
const RUNNER_ENV_KEYS = Object.freeze({
  homeDir: "DEV_WORKTREE_HOME",
  portOffset: "DEV_WORKTREE_PORT_OFFSET",
  instance: "DEV_WORKTREE_INSTANCE",
  host: "DEV_WORKTREE_HOST",
});

/**
 * @typedef {object} RunnerLock
 * @property {number} pid
 * @property {string} root
 * @property {number} offset
 * @property {{ web: number, convexCloud: number, convexSite: number }} ports
 * @property {{ web: string, convexCloud: string, convexSite: string }} urls
 * @property {number[]} childPids
 * @property {string | undefined} startedAt
 */

export class DevRunnerError extends Error {
  /**
   * @param {string} message
   * @param {{ exitCode?: number, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "DevRunnerError";
    this.exitCode = options.exitCode ?? 1;
  }
}

/**
 * FNV-1a produces a small, stable unsigned hash without adding a dependency.
 * @param {string} value
 */
export function hashInstance(value) {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * @param {string} raw
 * @param {string} source
 */
function parseOffset(raw, source) {
  if (!/^\d+$/.test(raw)) {
    throw new DevRunnerError(
      `${source} must be a non-negative integer; received "${raw}".`,
    );
  }
  const offset = Number(raw);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new DevRunnerError(
      `${source} must be a non-negative safe integer; received "${raw}".`,
    );
  }
  if (portsForOffset(offset).convexSite > MAX_PORT) {
    throw new DevRunnerError(
      `${source}=${offset} exceeds the highest usable port offset (${MAX_PORT - BASE_PORTS.convexSite}).`,
    );
  }
  return offset;
}

/**
 * @param {readonly string[]} argv
 */
export function parseArgs(argv) {
  /** @type {{ homeDir?: string, portOffset?: number, instance?: string, dryRun: boolean, help: boolean }} */
  const result = { dryRun: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }

    const [name, inlineValue] = argument?.split("=", 2) ?? [];
    if (
      name !== "--home-dir" &&
      name !== "--port-offset" &&
      name !== "--instance"
    ) {
      throw new DevRunnerError(`Unknown option: ${argument ?? ""}`);
    }
    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new DevRunnerError(`${name} requires a value.`);
    }
    if (inlineValue === undefined) {
      index += 1;
    }

    if (name === "--home-dir") {
      result.homeDir = value;
    } else if (name === "--instance") {
      result.instance = value;
    } else {
      result.portOffset = parseOffset(value, "--port-offset");
    }
  }

  return result;
}

/**
 * @param {number} offset
 */
export function portsForOffset(offset) {
  return {
    web: BASE_PORTS.web + offset,
    convexCloud: BASE_PORTS.convexCloud + offset,
    convexSite: BASE_PORTS.convexSite + offset,
  };
}

/**
 * @param {{ explicitOffset?: number, instance: string }} input
 */
export function resolveStartingOffset({ explicitOffset, instance }) {
  return explicitOffset ?? (hashInstance(instance) % MAX_HASH_OFFSET) + 1;
}

/**
 * @param {number} port
 * @param {string} host
 */
function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      const code = /** @type {NodeJS.ErrnoException} */ (error).code;
      resolve(code === "EAFNOSUPPORT" || code === "EADDRNOTAVAIL");
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Check both loopback and wildcard bindings because Next listens on all IPv4
 * interfaces while Convex listens on loopback.
 * @param {number} port
 */
export async function isPortAvailable(port) {
  for (const host of ["127.0.0.1", "0.0.0.0", "::1", "::"]) {
    if (!(await canListen(port, host))) {
      return false;
    }
  }
  return true;
}

/**
 * @param {number} startOffset
 * @param {(port: number) => Promise<boolean>} [checkPort]
 */
export async function findAvailableOffset(
  startOffset,
  checkPort = isPortAvailable,
) {
  for (
    let offset = startOffset;
    portsForOffset(offset).convexSite <= MAX_PORT;
    offset += 1
  ) {
    const ports = portsForOffset(offset);
    const available = await Promise.all(
      Object.values(ports).map((port) => checkPort(port)),
    );
    if (available.every(Boolean)) {
      return offset;
    }
  }
  throw new DevRunnerError(
    `No complete development port group is available from offset ${startOffset}.`,
  );
}

/**
 * @param {string} cwd
 */
export function findWorktreeRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (cause) {
    throw new DevRunnerError(
      "Unable to resolve the current Git worktree root.",
      { cause },
    );
  }
}

/**
 * Parse the simple KEY=value form used by this project's local environment
 * files. The runner only needs values; Next.js still performs its own complete
 * environment-file loading.
 * @param {string} file
 */
function readEnvFile(file) {
  /** @type {Record<string, string>} */
  const values = {};
  if (!fs.existsSync(file)) {
    return values;
  }
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/,
    );
    if (!match) {
      continue;
    }
    const [, key, rawValue = ""] = match;
    let value = rawValue.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    if (key !== undefined) {
      values[key] = value;
    }
  }
  return values;
}

export function findPreferredPublicHost() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (
        address.family === "IPv4" &&
        !address.internal &&
        address.address.startsWith("10.100.100.")
      ) {
        return address.address;
      }
    }
  }
  return "localhost";
}

/**
 * @param {number} pid
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM";
  }
}

/**
 * @param {string} lockPath
 * @returns {RunnerLock | null}
 */
function readRunnerLock(lockPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Number.isInteger(parsed.pid) ||
      typeof parsed.root !== "string" ||
      !Number.isInteger(parsed.offset) ||
      typeof parsed.ports?.web !== "number" ||
      typeof parsed.ports?.convexCloud !== "number" ||
      typeof parsed.ports?.convexSite !== "number" ||
      typeof parsed.urls?.web !== "string" ||
      typeof parsed.urls?.convexCloud !== "string" ||
      typeof parsed.urls?.convexSite !== "string"
    ) {
      return null;
    }
    return {
      pid: parsed.pid,
      root: parsed.root,
      offset: parsed.offset,
      ports: parsed.ports,
      urls: parsed.urls,
      childPids: Array.isArray(parsed.childPids)
        ? parsed.childPids.filter(Number.isInteger)
        : [],
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   argv: readonly string[],
 *   env: Record<string, string | undefined>,
 *   cwd: string,
 *   worktreeRoot?: string,
 *   publicHost?: string,
 *   checkPort?: (port: number) => Promise<boolean>,
 * }} input
 */
export async function resolveRunnerConfig({
  argv,
  env,
  cwd,
  worktreeRoot = findWorktreeRoot(cwd),
  publicHost = "localhost",
  checkPort = isPortAvailable,
}) {
  const options = parseArgs(argv);
  const root = path.resolve(worktreeRoot);
  const effectiveEnv = {
    ...readEnvFile(path.join(root, ".env")),
    ...readEnvFile(path.join(root, ".env.local")),
    ...env,
  };
  const instance =
    options.instance?.trim() ||
    effectiveEnv[RUNNER_ENV_KEYS.instance]?.trim() ||
    root;
  const envOffset = effectiveEnv[RUNNER_ENV_KEYS.portOffset]?.trim();
  const explicitOffset =
    options.portOffset ??
    (envOffset
      ? parseOffset(envOffset, RUNNER_ENV_KEYS.portOffset)
      : undefined);
  const startingOffset = resolveStartingOffset({ explicitOffset, instance });
  const configuredHome =
    options.homeDir?.trim() || effectiveEnv[RUNNER_ENV_KEYS.homeDir]?.trim();
  const homeDir = path.resolve(root, configuredHome || ".dev");
  const lockPath = path.join(homeDir, "dev-runner.lock");
  const existingLock = readRunnerLock(lockPath);
  const activeRunner =
    existingLock?.root === root && isProcessAlive(existingLock.pid)
      ? existingLock
      : null;
  const reuseActivePorts =
    activeRunner !== null &&
    (explicitOffset === undefined || explicitOffset === activeRunner.offset);
  const offset =
    (reuseActivePorts ? activeRunner.offset : undefined) ??
    (await findAvailableOffset(startingOffset, checkPort));
  const ports = reuseActivePorts ? activeRunner.ports : portsForOffset(offset);
  const resolvedHost = effectiveEnv[RUNNER_ENV_KEYS.host]?.trim() || publicHost;
  const urls = reuseActivePorts
    ? activeRunner.urls
    : {
        web: `http://${resolvedHost}:${ports.web}`,
        convexCloud: `http://${resolvedHost}:${ports.convexCloud}`,
        convexSite: `http://${resolvedHost}:${ports.convexSite}`,
      };
  const authSecret =
    effectiveEnv.BETTER_AUTH_SECRET?.trim() ||
    "worktree-dev-better-auth-secret-at-least-32-chars";
  const runtimeEnv = createRuntimeEnvironment({
    env: effectiveEnv,
    homeDir,
    ports,
    urls,
    authSecret,
  });

  return {
    root,
    instance,
    startingOffset,
    offset,
    collisionAdjusted: offset !== startingOffset,
    homeDir,
    lockPath,
    activeRunner,
    convexStateDir: path.join(root, ".convex"),
    ports,
    urls,
    runtimeEnv,
    dryRun: options.dryRun,
    help: options.help,
    childCommands: {
      convex: [
        "pnpm",
        "exec",
        "convex",
        "dev",
        "--env-file",
        path.join(homeDir, "convex.env"),
        "--local-cloud-port",
        String(ports.convexCloud),
        "--local-site-port",
        String(ports.convexSite),
        "--tail-logs",
        "always",
      ],
      web: [
        "pnpm",
        "exec",
        "next",
        "dev",
        "--turbo",
        "-p",
        String(ports.web),
        "--hostname",
        "0.0.0.0",
      ],
    },
  };
}

/**
 * @param {{
 *   env: Record<string, string | undefined>,
 *   homeDir: string,
 *   ports: { web: number, convexCloud: number, convexSite: number },
 *   urls: { web: string, convexCloud: string, convexSite: string },
 *   authSecret: string,
 * }} input
 * @returns {Record<string, string | undefined>}
 */
export function createRuntimeEnvironment({
  env,
  homeDir,
  ports,
  urls,
  authSecret,
}) {
  return {
    ...env,
    CONVEX_AGENT_MODE: "anonymous",
    DATABASE_URL: env.DATABASE_URL?.trim() || "file:./db.sqlite",
    NEXT_PUBLIC_CONVEX_URL: urls.convexCloud,
    NEXT_PUBLIC_CONVEX_SITE_URL: urls.convexSite,
    SITE_URL: urls.web,
    TRUSTED_ORIGINS: [
      urls.web,
      `http://localhost:${ports.web}`,
      `http://127.0.0.1:${ports.web}`,
      `http://localhost:${BASE_PORTS.web}`,
      `http://127.0.0.1:${BASE_PORTS.web}`,
    ].join(","),
    BETTER_AUTH_SECRET: authSecret,
    DEV_WORKTREE_HOME: homeDir,
    PORT: String(ports.web),
  };
}

/**
 * @param {Awaited<ReturnType<typeof resolveRunnerConfig>>} config
 */
export function formatDryRun(config) {
  const env = config.runtimeEnv;
  return [
    "[dev-runner] dry run",
    `Worktree root: ${config.root}`,
    `Instance: ${config.instance}`,
    `Starting port offset: ${config.startingOffset}`,
    `Resolved port offset: ${config.offset}`,
    `Ports: web=${config.ports.web} convexCloud=${config.ports.convexCloud} convexSite=${config.ports.convexSite}`,
    `Runtime config: ${config.homeDir}`,
    `Convex state: ${config.convexStateDir}`,
    `Status: ${config.activeRunner ? `already running (pid ${config.activeRunner.pid})` : "stopped"}`,
    "Environment:",
    `  PORT=${env.PORT}`,
    `  DATABASE_URL=${redactUrlCredentials(env.DATABASE_URL)}`,
    `  NEXT_PUBLIC_CONVEX_URL=${env.NEXT_PUBLIC_CONVEX_URL}`,
    `  NEXT_PUBLIC_CONVEX_SITE_URL=${env.NEXT_PUBLIC_CONVEX_SITE_URL}`,
    `  SITE_URL=${env.SITE_URL}`,
    `  TRUSTED_ORIGINS=${env.TRUSTED_ORIGINS}`,
    "  BETTER_AUTH_SECRET=<redacted>",
    `Child command (Convex): ${config.childCommands.convex.join(" ")}`,
    `Child command (web): ${config.childCommands.web.join(" ")}`,
  ].join("\n");
}

/**
 * @param {string | undefined} value
 */
function redactUrlCredentials(value) {
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "<redacted>";
      url.password = "<redacted>";
      return url.toString();
    }
    return value;
  } catch {
    return value;
  }
}

function helpText() {
  return `Usage: pnpm dev [options]

Starts a worktree-local Convex backend and Next.js development server.

Options:
  --home-dir <path>       Generated runtime configuration (default: .dev)
  --port-offset <number>  Override the deterministic worktree port offset
  --instance <value>      Override the value hashed for automatic ports
  --dry-run               Print resolved configuration without starting
  -h, --help              Show this help

Environment equivalents:
  ${RUNNER_ENV_KEYS.homeDir}
  ${RUNNER_ENV_KEYS.portOffset}
  ${RUNNER_ENV_KEYS.instance}
  ${RUNNER_ENV_KEYS.host}`;
}

/**
 * @param {string} file
 * @param {string} content
 */
function writePrivateFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { encoding: "utf8", mode: 0o600 });
}

/**
 * @param {Awaited<ReturnType<typeof resolveRunnerConfig>>} config
 */
function acquireRunnerLock(config) {
  fs.mkdirSync(config.homeDir, { recursive: true });
  /** @type {RunnerLock} */
  const state = {
    pid: process.pid,
    root: config.root,
    offset: config.offset,
    ports: config.ports,
    urls: config.urls,
    childPids: [],
    startedAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = fs.openSync(config.lockPath, "wx", 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`);
      fs.closeSync(descriptor);
      return state;
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "EEXIST") {
        throw error;
      }
      const existing = readRunnerLock(config.lockPath);
      if (existing && isProcessAlive(existing.pid)) {
        throw new DevRunnerError(
          `This worktree is already running at ${existing.urls.web} (pid ${existing.pid}).`,
        );
      }
      fs.rmSync(config.lockPath, { force: true });
    }
  }
  throw new DevRunnerError(
    `Unable to acquire the runner lock at ${config.lockPath}.`,
  );
}

/**
 * @param {string} lockPath
 * @param {ReturnType<typeof acquireRunnerLock>} state
 */
function writeRunnerLock(lockPath, state) {
  fs.writeFileSync(lockPath, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
}

/**
 * @param {string} lockPath
 */
function releaseRunnerLock(lockPath) {
  const current = readRunnerLock(lockPath);
  if (current?.pid === process.pid) {
    fs.rmSync(lockPath, { force: true });
  }
}

/**
 * @param {string[]} command
 * @param {{ cwd: string, env: Record<string, string | undefined>, detached?: boolean, stdin?: "inherit" | "ignore" }} options
 */
function spawnCommand(command, options) {
  const executable = command[0];
  if (executable === undefined) {
    throw new DevRunnerError("Cannot start an empty child command.");
  }
  /** @type {import("node:child_process").ChildProcess} */
  const child = spawn(executable, command.slice(1), {
    cwd: options.cwd,
    env: /** @type {NodeJS.ProcessEnv} */ (options.env),
    stdio: [options.stdin ?? "inherit", "inherit", "inherit"],
    // Keep children in the runner's process group. Terminals and Playwright can
    // then signal the whole stack even if an intermediate package-manager shell
    // is the process they started.
    detached: options.detached ?? false,
    shell: false,
  });
  /** @type {Promise<{ code: number | null, signal: NodeJS.Signals | null }>} */
  const exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  return { child, exit };
}

/**
 * @param {number} rootPid
 * @param {NodeJS.Signals} signal
 */
function signalPidTree(rootPid, signal) {
  try {
    if (process.platform === "win32") {
      spawn(
        "taskkill",
        [
          "/pid",
          String(rootPid),
          "/t",
          signal === "SIGKILL" ? "/f" : "",
        ].filter(Boolean),
        {
          stdio: "ignore",
        },
      );
    } else {
      const processRows = execFileSync("ps", ["-eo", "pid=,ppid="], {
        encoding: "utf8",
      });
      /** @type {Map<number, number[]>} */
      const childrenByParent = new Map();
      for (const row of processRows.trim().split("\n")) {
        const [pidText, parentText] = row.trim().split(/\s+/, 2);
        const pid = Number(pidText);
        const parent = Number(parentText);
        if (!Number.isInteger(pid) || !Number.isInteger(parent)) {
          continue;
        }
        const siblings = childrenByParent.get(parent) ?? [];
        siblings.push(pid);
        childrenByParent.set(parent, siblings);
      }
      /** @type {number[]} */
      const descendants = [];
      /** @param {number} parent */
      const collectDescendants = (parent) => {
        for (const pid of childrenByParent.get(parent) ?? []) {
          collectDescendants(pid);
          descendants.push(pid);
        }
      };
      collectDescendants(rootPid);
      for (const pid of [...descendants, rootPid]) {
        try {
          process.kill(pid, signal);
        } catch (error) {
          if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ESRCH") {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ESRCH") {
      throw error;
    }
  }
}

/**
 * @param {import("node:child_process").ChildProcess} child
 * @param {NodeJS.Signals} signal
 */
function signalProcessTree(child, signal) {
  if (
    child.pid === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }
  signalPidTree(child.pid, signal);
}

/**
 * @param {number} pid
 */
export async function stopProcessTreeByPid(pid) {
  signalPidTree(pid, "SIGTERM");
  const deadline = Date.now() + RESTART_TIMEOUT_MS;
  while (isProcessAlive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (isProcessAlive(pid)) {
    signalPidTree(pid, "SIGKILL");
  }
}

/**
 * @param {import("node:child_process").ChildProcess[]} children
 */
export async function stopProcessTrees(children) {
  for (const child of children) {
    signalProcessTree(child, "SIGTERM");
  }
  await Promise.race([
    Promise.all(
      children.map((child) =>
        child.exitCode !== null || child.signalCode !== null
          ? Promise.resolve()
          : new Promise((resolve) => child.once("exit", resolve)),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
  ]);
  for (const child of children) {
    signalProcessTree(child, "SIGKILL");
  }
}

/**
 * @param {number} port
 * @param {Promise<unknown>} convexExit
 */
async function waitForConvex(port, convexExit) {
  const deadline = Date.now() + CONVEX_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = fetch(`http://127.0.0.1:${port}/instance_name`)
      .then(async (response) =>
        response.ok ? (await response.text()).trim() : "",
      )
      .catch(() => "");
    const result = await Promise.race([
      ready.then((deploymentName) => ({ kind: "probe", deploymentName })),
      convexExit.then((exit) => ({ kind: "exit", exit })),
    ]);
    if ("exit" in result) {
      const exit =
        /** @type {{ code: number | null, signal: NodeJS.Signals | null }} */ (
          result.exit
        );
      throw new DevRunnerError(
        `Convex exited before becoming ready (${exit.signal ?? `code ${exit.code ?? 1}`}).`,
        { exitCode: exit.code ?? 1 },
      );
    }
    if (result.deploymentName) {
      return result.deploymentName;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new DevRunnerError(
    `Convex did not become ready within ${CONVEX_READY_TIMEOUT_MS / 1000} seconds.`,
  );
}

/**
 * @param {Awaited<ReturnType<typeof resolveRunnerConfig>>} config
 */
export async function startDevelopment(config) {
  fs.mkdirSync(config.homeDir, { recursive: true });
  const convexEnvFile = path.join(config.homeDir, "convex.env");
  const authEnvFile = path.join(config.homeDir, "convex-auth.env");
  writePrivateFile(convexEnvFile, "CONVEX_DEPLOYMENT=anonymous-agent\n");
  writePrivateFile(
    authEnvFile,
    [
      `SITE_URL=${config.runtimeEnv.SITE_URL}`,
      `TRUSTED_ORIGINS=${config.runtimeEnv.TRUSTED_ORIGINS}`,
      `BETTER_AUTH_SECRET=${config.runtimeEnv.BETTER_AUTH_SECRET}`,
      "",
    ].join("\n"),
  );

  const envLocalPath = path.join(config.root, ".env.local");
  const envLocalSnapshot = fs.existsSync(envLocalPath)
    ? {
        content: fs.readFileSync(envLocalPath),
        mode: fs.statSync(envLocalPath).mode,
      }
    : null;
  let envLocalRestored = false;
  const envLocalChanged = () => {
    if (!fs.existsSync(envLocalPath)) {
      return envLocalSnapshot !== null;
    }
    if (envLocalSnapshot === null) {
      return true;
    }
    return !fs.readFileSync(envLocalPath).equals(envLocalSnapshot.content);
  };
  const waitForEnvLocalWrite = async () => {
    const deadline = Date.now() + 3_000;
    while (!envLocalChanged() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const restoreEnvLocal = () => {
    if (envLocalRestored) {
      return;
    }
    if (envLocalSnapshot === null) {
      fs.rmSync(envLocalPath, { force: true });
    } else {
      fs.writeFileSync(envLocalPath, envLocalSnapshot.content, {
        mode: envLocalSnapshot.mode,
      });
    }
    envLocalRestored = true;
  };

  const childEnv = { ...config.runtimeEnv };
  delete childEnv.CONVEX_DEPLOY_KEY;
  delete childEnv.CONVEX_DEPLOYMENT_TOKEN;
  delete childEnv.CONVEX_SELF_HOSTED_URL;
  delete childEnv.CONVEX_SELF_HOSTED_ADMIN_KEY;

  console.log(
    `[dev-runner] ${config.urls.web} | Convex ${config.urls.convexCloud} | state ${config.convexStateDir}`,
  );
  if (config.collisionAdjusted) {
    console.log(
      `[dev-runner] port group ${config.startingOffset} was occupied; using ${config.offset}.`,
    );
  }

  /** @type {import("node:child_process").ChildProcess[]} */
  const children = [];
  const runnerState = acquireRunnerLock(config);
  let receivedSignal = null;
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await stopProcessTrees(children);
  };
  /** @param {NodeJS.Signals} signal */
  const handleSignal = (signal) => {
    receivedSignal = signal;
    void shutdown();
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    const convex = spawnCommand(config.childCommands.convex, {
      cwd: config.root,
      env: childEnv,
      // Convex only auto-installs/updates AI guidance in interactive mode.
      // The runner supplies all required configuration, so it does not need stdin.
      stdin: "ignore",
    });
    children.push(convex.child);
    if (convex.child.pid !== undefined) {
      runnerState.childPids.push(convex.child.pid);
      writeRunnerLock(config.lockPath, runnerState);
    }
    const deploymentName = await waitForConvex(
      config.ports.convexCloud,
      convex.exit,
    );

    const authEnv = { ...childEnv, CONVEX_DEPLOYMENT: deploymentName };
    const configureAuth = spawnCommand(
      [
        "pnpm",
        "exec",
        "convex",
        "env",
        "set",
        "--from-file",
        authEnvFile,
        "--force",
      ],
      { cwd: config.root, env: authEnv, detached: false },
    );
    const authExit =
      /** @type {{ code: number | null, signal: NodeJS.Signals | null }} */ (
        await configureAuth.exit
      );
    if (authExit.code !== 0) {
      throw new DevRunnerError(
        `Configuring the local Convex auth environment failed (${authExit.signal ?? `code ${authExit.code ?? 1}`}).`,
        { exitCode: authExit.code ?? 1 },
      );
    }
    await waitForEnvLocalWrite();
    restoreEnvLocal();

    const web = spawnCommand(config.childCommands.web, {
      cwd: config.root,
      env: childEnv,
    });
    children.push(web.child);
    if (web.child.pid !== undefined) {
      runnerState.childPids.push(web.child.pid);
      writeRunnerLock(config.lockPath, runnerState);
    }
    const firstExit =
      /** @type {{ source: string, code: number | null, signal: NodeJS.Signals | null }} */ (
        await Promise.race([
          convex.exit.then((exit) => ({
            source: "Convex",
            .../** @type {object} */ (exit),
          })),
          web.exit.then((exit) => ({
            source: "Next.js",
            .../** @type {object} */ (exit),
          })),
        ])
      );
    if (receivedSignal) {
      return receivedSignal === "SIGINT" ? 130 : 143;
    }
    if (firstExit.code !== 0) {
      throw new DevRunnerError(
        `${firstExit.source} exited (${firstExit.signal ?? `code ${firstExit.code ?? 1}`}).`,
        { exitCode: firstExit.code ?? 1 },
      );
    }
    return 0;
  } finally {
    restoreEnvLocal();
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
    await shutdown();
    releaseRunnerLock(config.lockPath);
  }
}

/**
 * @param {{
 *   argv?: readonly string[],
 *   env?: Record<string, string | undefined>,
 *   cwd?: string,
 *   worktreeRoot?: string,
 *   publicHost?: string,
 *   checkPort?: (port: number) => Promise<boolean>,
 *   stopExisting?: typeof stopProcessTreeByPid,
 *   start?: typeof startDevelopment,
 * }} [input]
 */
export async function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  worktreeRoot,
  publicHost = findPreferredPublicHost(),
  checkPort,
  stopExisting = stopProcessTreeByPid,
  start = startDevelopment,
} = {}) {
  const config = await resolveRunnerConfig({
    argv,
    env,
    cwd,
    ...(worktreeRoot === undefined ? {} : { worktreeRoot }),
    publicHost,
    ...(checkPort === undefined ? {} : { checkPort }),
  });
  if (config.help) {
    console.log(helpText());
    return 0;
  }
  if (config.dryRun) {
    console.log(formatDryRun(config));
    return 0;
  }
  if (config.activeRunner) {
    console.log(
      `[dev-runner] restarting ${config.urls.web} (pid ${config.activeRunner.pid}).`,
    );
    await stopExisting(config.activeRunner.pid);
    config.activeRunner = null;
  }
  return await start(config);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[dev-runner] ${message}`);
      process.exitCode = error instanceof DevRunnerError ? error.exitCode : 1;
    });
}
