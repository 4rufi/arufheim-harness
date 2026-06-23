import process from "node:process";

import {
  evaluateHarnessHealth,
  formatClientReadinessBrief,
  formatRuntimeArtifactBrief,
  listClientReadinessEntries,
  formatHealthBrief,
  formatRuntimeSourceBrief,
} from "./health.js";

interface RunDoctorOptions {
  json?: boolean;
  persist?: boolean;
}

export async function buildDoctorSnapshot(
  repoPath: string,
  options: { persist?: boolean } = {},
) {
  return evaluateHarnessHealth(repoPath, {
    persist: options.persist ?? false,
    verifiedBy: "doctor",
  });
}

export async function runDoctor(
  repoPath?: string,
  options: RunDoctorOptions = {},
): Promise<void> {
  const root = repoPath ?? process.cwd();
  const snapshot = await buildDoctorSnapshot(root, {
    persist: options.persist ?? true,
  });

  if (options.json) {
    process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
  } else {
    console.log("\nharness doctor\n");
    console.log(`  repo: ${snapshot.repo_path}`);
    console.log(`  layout: ${snapshot.workflow_layout}`);
    console.log(`  scaffold: ${snapshot.scaffold_layout}`);
    console.log(
      `  runtime: ${snapshot.runtime_status.state} (${snapshot.runtime_status.path}) artifact=${formatRuntimeArtifactBrief(snapshot.runtime_status)} source=${formatRuntimeSourceBrief(snapshot.runtime_status)}`,
    );
    console.log(`  health: ${formatHealthBrief(snapshot)}`);
    if (snapshot.loop_summary) {
      console.log(
        `  loop: ${snapshot.loop_summary.phase} a${snapshot.loop_summary.attempt_index} review=${snapshot.loop_summary.review_round} next=${snapshot.loop_summary.next_actor}`,
      );
    } else {
      console.log("  loop: none");
    }
    console.log(
      `  activation: ${formatClientReadinessBrief(snapshot.client_readiness)}`,
    );
    console.log(
      `  summary: passed=${snapshot.doctor_summary.passed} warn=${snapshot.doctor_summary.warn} error=${snapshot.doctor_summary.error} blocking=${snapshot.doctor_summary.blocking}\n`,
    );
    for (const entry of listClientReadinessEntries(snapshot.client_readiness)) {
      if (entry.status.state === "verified") {
        continue;
      }
      console.log(`  - ${entry.label}: ${entry.status.state}`);
      console.log(`      detail: ${entry.status.detail}`);
      if (entry.status.next_step) {
        console.log(`      next: ${entry.status.next_step}`);
      }
    }
    if (listClientReadinessEntries(snapshot.client_readiness).some((entry) => entry.status.state !== "verified")) {
      console.log("");
    }

    for (const diagnostic of snapshot.diagnostics) {
      const icon = diagnostic.ok
        ? "✓"
        : diagnostic.severity === "warn"
          ? "!"
          : "✗";
      const detail = diagnostic.detail ? `  → ${diagnostic.detail}` : "";
      console.log(`  ${icon} ${diagnostic.message}${detail}`);
      if (!diagnostic.ok) {
        if (diagnostic.fix_command) {
          console.log(`      fix: ${diagnostic.fix_command}`);
        } else if (diagnostic.fix_hint) {
          console.log(`      fix: ${diagnostic.fix_hint}`);
        }
      }
    }

    if (snapshot.doctor_summary.status === "ok") {
      console.log("\n✓ Todo en orden.\n");
    } else if (snapshot.doctor_summary.status === "degraded") {
      console.log(
        "\n! Hay degradaciones no fatales. Puedes revisar `repair` o los fixes sugeridos.\n",
      );
    } else {
      console.log("\n✗ Hay problemas que resolver. Ver fixes arriba.\n");
    }
  }

  if (snapshot.doctor_summary.status === "error") {
    process.exitCode = 1;
  }
}
