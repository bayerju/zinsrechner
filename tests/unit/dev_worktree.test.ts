import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeEnvironment,
  findAvailableOffset,
  hashInstance,
  parseArgs,
  portsForOffset,
  resolveRunnerConfig,
  resolveStartingOffset,
  runCli,
  stopProcessTrees,
} from "../../scripts/dev-worktree.mjs";

describe("worktree development runner", () => {
  it("hashes the same worktree path to the same offset", () => {
    const instance = "/tmp/worktrees/feature-a";
    expect(resolveStartingOffset({ instance })).toBe(
      resolveStartingOffset({ instance }),
    );
  });

  it("normally gives different paths different offsets", () => {
    expect(hashInstance("/tmp/worktrees/feature-a")).not.toBe(
      hashInstance("/tmp/worktrees/feature-b"),
    );
  });

  it("prefers an explicit offset and rejects invalid offsets", () => {
    expect(
      resolveStartingOffset({ explicitOffset: 20, instance: "ignored" }),
    ).toBe(20);
    expect(() => parseArgs(["--port-offset", "-1"])).toThrow(
      "non-negative integer",
    );
    expect(() => parseArgs(["--port-offset", "abc"])).toThrow(
      "non-negative integer",
    );
  });

  it("supports both separated and equals-form arguments", () => {
    expect(
      parseArgs([
        "--home-dir",
        ".local-dev",
        "--port-offset=20",
        "--instance",
        "feature-a",
        "--dry-run",
      ]),
    ).toEqual({
      homeDir: ".local-dev",
      portOffset: 20,
      instance: "feature-a",
      dryRun: true,
      help: false,
    });
  });

  it("advances the complete port group when any port is occupied", async () => {
    const firstGroup = portsForOffset(12);
    const occupied = new Set([firstGroup.convexCloud]);
    const offset = await findAvailableOffset(
      12,
      async (port) => !occupied.has(port),
    );

    expect(offset).toBe(13);
    expect(portsForOffset(offset)).toEqual({
      web: 3024,
      convexCloud: 23024,
      convexSite: 43024,
    });
  });

  it("resolves runtime state and URLs for the current worktree", async () => {
    const root = path.resolve("/tmp/worktrees/feature-a");
    const config = await resolveRunnerConfig({
      argv: ["--port-offset", "20"],
      env: {},
      cwd: root,
      worktreeRoot: root,
      checkPort: async () => true,
    });

    expect(config.homeDir).toBe(path.join(root, ".dev"));
    expect(config.convexStateDir).toBe(path.join(root, ".convex"));
    expect(config.urls).toEqual({
      web: "http://localhost:3031",
      convexCloud: "http://localhost:23031",
      convexSite: "http://localhost:43031",
    });
    expect(config.runtimeEnv.NEXT_PUBLIC_CONVEX_URL).toBe(
      config.urls.convexCloud,
    );
    expect(config.runtimeEnv.NEXT_PUBLIC_CONVEX_SITE_URL).toBe(
      config.urls.convexSite,
    );
    expect(config.runtimeEnv.SITE_URL).toBe(config.urls.web);
  });

  it("uses CLI options before environment configuration", async () => {
    const root = path.resolve("/tmp/worktrees/feature-a");
    const config = await resolveRunnerConfig({
      argv: ["--port-offset", "7", "--home-dir", ".cli"],
      env: {
        DEV_WORKTREE_PORT_OFFSET: "99",
        DEV_WORKTREE_HOME: ".env",
      },
      cwd: root,
      worktreeRoot: root,
      checkPort: async () => true,
    });

    expect(config.offset).toBe(7);
    expect(config.homeDir).toBe(path.join(root, ".cli"));
  });

  it("passes application variables through to child environments", () => {
    const runtimeEnv = createRuntimeEnvironment({
      env: {
        OPENAI_API_KEY: "test-key",
        DATABASE_URL: "postgres://localhost/test",
      },
      homeDir: "/tmp/worktree/.dev",
      ports: { web: 3011, convexCloud: 23011, convexSite: 43011 },
      urls: {
        web: "http://localhost:3011",
        convexCloud: "http://127.0.0.1:23011",
        convexSite: "http://127.0.0.1:43011",
      },
      authSecret: "test-secret",
    });

    expect(runtimeEnv.OPENAI_API_KEY).toBe("test-key");
    expect(runtimeEnv.DATABASE_URL).toBe("postgres://localhost/test");
    expect(runtimeEnv.BETTER_AUTH_SECRET).toBe("test-secret");
    expect(runtimeEnv.PORT).toBe("3011");
  });

  it("loads local environment files without overriding shell variables", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zinsrechner-runner-"));
    fs.writeFileSync(
      path.join(root, ".env"),
      [
        'DATABASE_URL="postgres://from-file.example/database"',
        'BETTER_AUTH_SECRET="secret-from-file"',
        "",
      ].join("\n"),
    );

    try {
      const config = await resolveRunnerConfig({
        argv: ["--port-offset", "0"],
        env: { DATABASE_URL: "postgres://from-shell.example/database" },
        cwd: root,
        worktreeRoot: root,
        checkPort: async () => true,
      });

      expect(config.runtimeEnv.DATABASE_URL).toBe(
        "postgres://from-shell.example/database",
      );
      expect(config.runtimeEnv.BETTER_AUTH_SECRET).toBe("secret-from-file");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not start child processes in dry-run mode", async () => {
    const start = vi.fn(async (): Promise<0 | 130 | 143> => 0);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const root = path.resolve("/tmp/worktrees/feature-a");

    const exitCode = await runCli({
      argv: ["--dry-run", "--port-offset", "0"],
      env: {},
      cwd: root,
      worktreeRoot: root,
      checkPort: async () => true,
      start,
    });

    expect(exitCode).toBe(0);
    expect(start).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join("\n")).toContain("dry run");
    log.mockRestore();
  });

  it("stops and replaces an existing runner for the same worktree", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zinsrechner-runner-"));
    const homeDir = path.join(root, ".dev");
    fs.mkdirSync(homeDir);
    fs.writeFileSync(
      path.join(homeDir, "dev-runner.lock"),
      JSON.stringify({
        pid: process.pid,
        root,
        offset: 0,
        ports: { web: 3011, convexCloud: 23011, convexSite: 43011 },
        urls: {
          web: "http://localhost:3011",
          convexCloud: "http://localhost:23011",
          convexSite: "http://localhost:43011",
        },
      }),
    );
    const stopExisting = vi.fn(async () => undefined);
    const start = vi.fn(async (): Promise<0 | 130 | 143> => 0);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      const exitCode = await runCli({
        argv: [],
        env: {},
        cwd: root,
        worktreeRoot: root,
        publicHost: "localhost",
        checkPort: async () => false,
        stopExisting,
        start,
      });

      expect(exitCode).toBe(0);
      expect(stopExisting).toHaveBeenCalledWith(process.pid);
      expect(start).toHaveBeenCalledOnce();
      expect(log.mock.calls.flat().join("\n")).toContain("restarting");
    } finally {
      log.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("lets an explicit offset replace an active runner's ports", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zinsrechner-runner-"));
    const homeDir = path.join(root, ".dev");
    fs.mkdirSync(homeDir);
    fs.writeFileSync(
      path.join(homeDir, "dev-runner.lock"),
      JSON.stringify({
        pid: process.pid,
        root,
        offset: 7,
        ports: { web: 3018, convexCloud: 23018, convexSite: 43018 },
        urls: {
          web: "http://localhost:3018",
          convexCloud: "http://localhost:23018",
          convexSite: "http://localhost:43018",
        },
      }),
    );

    try {
      const config = await resolveRunnerConfig({
        argv: ["--port-offset", "0"],
        env: {},
        cwd: root,
        worktreeRoot: root,
        publicHost: "localhost",
        checkPort: async () => true,
      });

      expect(config.activeRunner?.pid).toBe(process.pid);
      expect(config.offset).toBe(0);
      expect(config.ports).toEqual({
        web: 3011,
        convexCloud: 23011,
        convexSite: 43011,
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "terminates a complete POSIX child process tree",
    async () => {
      const child = Object.assign(new EventEmitter(), {
        pid: 12345,
        exitCode: null as number | null,
        signalCode: null as NodeJS.Signals | null,
      });
      const kill = vi
        .spyOn(process, "kill")
        .mockImplementation((_pid, signal) => {
          child.exitCode = signal === "SIGTERM" ? 0 : child.exitCode;
          child.emit("exit", child.exitCode, signal);
          return true;
        });

      await stopProcessTrees([
        child as unknown as import("node:child_process").ChildProcess,
      ]);

      expect(kill).toHaveBeenCalledWith(12345, "SIGTERM");
      kill.mockRestore();
    },
  );
});
