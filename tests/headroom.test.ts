import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { refreshActiveHeadSummary } from "../src/headroom.js";
import { runInit } from "../src/init.js";

async function createHarnessRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "harness-head-"));
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    await runInit({
      repoPath,
      update: false,
      target: "codex",
    });
  } finally {
    logSpy.mockRestore();
  }
  return repoPath;
}

describe("headroom", () => {
  it("renders and writes head_<feature>.md for the active feature", async () => {
    const repoPath = await createHarnessRepo();
    try {
      await writeFile(
        path.join(repoPath, "package.json"),
        JSON.stringify(
          {
            packageManager: "pnpm@10.33.4",
            scripts: {
              "test:unit": "vitest run",
              smoke: "node smoke.mjs",
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      await writeFile(
        path.join(repoPath, ".harness", "feature_list.json"),
        JSON.stringify(
          {
            project: "tmp",
            description: "tmp",
            rules: {
              one_feature_at_a_time: true,
              require_green_verification_to_close: true,
              require_approved_spec_to_implement: true,
              valid_status: [
                "pending",
                "spec_ready",
                "in_progress",
                "done",
                "blocked",
              ],
              sdd_required_when: 'feature has "sdd": true',
            },
            features: [
              {
                id: 1,
                name: "doctor_status_contract",
                description: "Ajusta doctor/status json contract",
                status: "in_progress",
                sdd: true,
              },
            ],
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      await mkdir(path.join(repoPath, "specs", "doctor_status_contract"), {
        recursive: true,
      });
      await writeFile(
        path.join(repoPath, "specs", "doctor_status_contract", "spec_summary.md"),
        "# Goal\njson contract\n",
        "utf8",
      );
      await writeFile(
        path.join(repoPath, "specs", "doctor_status_contract", "requirements.md"),
        "- R1. doctor expone output estable\n- R2. status expone output estable\n",
        "utf8",
      );
      await writeFile(
        path.join(repoPath, "specs", "doctor_status_contract", "tasks.md"),
        "- [ ] T1 (R2) ajustar output\n- [x] T2 (R1) cubrir doctor\n",
        "utf8",
      );

      const result = await refreshActiveHeadSummary(repoPath);
      expect(result?.path).toBe(".harness/progress/head_doctor_status_contract.md");
      expect(result?.content).toContain("requirements_focus: R2");
      expect(result?.content).toContain("test_layer: contract");
      expect(result?.content).toContain("fast_command: pnpm test:unit");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});
