import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config.js";
import { buildDoctorSnapshot } from "../src/doctor.js";
import { runInit } from "../src/init.js";
import { buildSimulationReport } from "../src/simulate.js";
import { buildHarnessStatus } from "../src/status.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("runtime contracts", () => {
  it("builds doctor/status/simulate payloads on a scaffolded repo", async () => {
    const repoPath = await mkdtemp(path.join(os.tmpdir(), "harness-contract-"));
    const xdgHome = await mkdtemp(path.join(os.tmpdir(), "harness-contract-xdg-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const previousXdg = process.env.XDG_CONFIG_HOME;
    const previousArgv1 = process.argv[1];
    try {
      process.env.XDG_CONFIG_HOME = xdgHome;
      process.argv[1] = path.join(repoRoot, "dist", "index.js");
      await runInit({
        repoPath,
        update: false,
        target: "codex",
        ensureManagedRuntime: true,
      });

      const config = await loadConfig({
        argv: ["--repo-path", repoPath],
        cwd: repoPath,
      });
      const status = await buildHarnessStatus({
        repoPath,
        configPath: config.configPath,
        configScope: config.configScope,
        permissionPolicy: config.permissionPolicy,
        mode: "brief_only",
        preferCachedHealth: false,
      });
      const doctor = await buildDoctorSnapshot(repoPath, { persist: false });
      const simulation = await buildSimulationReport(config, [
        "startup",
        "triage",
      ]);

      expect(status.content.repo_path).toBe(repoPath);
      expect(status.content.scaffold_layout).toBe("thin");
      expect(typeof status.content.startup_brief).toBe("string");
      expect(doctor.scaffold_layout).toBe("thin");
      expect(doctor.doctor_summary.status).toMatch(/^(ok|degraded)$/);
      expect(doctor.doctor_summary.blocking).toBe(0);
      expect(simulation.repo_path).toBe(repoPath);
      expect(simulation.flows).toHaveLength(2);
      expect(simulation.flows[0]?.steps[0]?.surface).toContain("status");
    } finally {
      if (previousXdg === undefined) {
        delete process.env.XDG_CONFIG_HOME;
      } else {
        process.env.XDG_CONFIG_HOME = previousXdg;
      }
      if (previousArgv1 === undefined) {
        delete process.argv[1];
      } else {
        process.argv[1] = previousArgv1;
      }
      logSpy.mockRestore();
      await rm(repoPath, { recursive: true, force: true });
      await rm(xdgHome, { recursive: true, force: true });
    }
  });
});
