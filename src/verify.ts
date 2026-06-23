import process from "node:process";

import { buildDoctorSnapshot } from "./doctor.js";
import {
  formatClientReadinessBrief,
  formatHealthBrief,
  formatRuntimeArtifactBrief,
  formatRuntimeSourceBrief,
  listClientReadinessEntries,
} from "./health.js";
import { readInitRepoPath } from "./init.js";

export async function runVerify(argv: string[] = []): Promise<void> {
  const repoPath = readInitRepoPath(argv);
  const json = argv.includes("--json");
  const snapshot = await buildDoctorSnapshot(repoPath, { persist: true });

  if (json) {
    process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
  } else {
    const lines = [
      "",
      "harness verify",
      "",
      `  repo: ${snapshot.repo_path}`,
      `  layout: ${snapshot.workflow_layout}`,
      `  scaffold: ${snapshot.scaffold_layout}`,
      `  runtime: ${snapshot.runtime_status.state} (artifact=${formatRuntimeArtifactBrief(snapshot.runtime_status)} source=${formatRuntimeSourceBrief(snapshot.runtime_status)})`,
      `  health: ${formatHealthBrief(snapshot)}`,
      `  activation: ${formatClientReadinessBrief(snapshot.client_readiness)}`,
      `  summary: passed=${snapshot.doctor_summary.passed} warn=${snapshot.doctor_summary.warn} error=${snapshot.doctor_summary.error} blocking=${snapshot.doctor_summary.blocking}`,
      "",
    ];

    for (const entry of listClientReadinessEntries(snapshot.client_readiness)) {
      if (entry.status.state === "verified") {
        continue;
      }
      lines.push(`  - ${entry.label}: ${entry.status.state}`);
      lines.push(`      detail: ${entry.status.detail}`);
      if (entry.status.next_step) {
        lines.push(`      next: ${entry.status.next_step}`);
      }
    }

    if (snapshot.doctor_summary.status === "ok") {
      lines.push("", "✓ Repo listo.", "");
    } else if (snapshot.doctor_summary.status === "degraded") {
      lines.push(
        "",
        "! Repo utilizable con degradaciones; revisa `arufheim-harness doctor --json` o `repair`.",
        "",
      );
    } else {
      lines.push(
        "",
        "✗ Repo no verificó; revisa `arufheim-harness doctor --json` o `repair`.",
        "",
      );
    }

    process.stdout.write(lines.join("\n"));
  }

  if (snapshot.doctor_summary.status === "error") {
    process.exitCode = 1;
  }
}
