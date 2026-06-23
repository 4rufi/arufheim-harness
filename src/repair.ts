import process from "node:process";

import type { HarnessClientId } from "./config.js";
import {
  parseGlobalClientSelection,
  parseLocalClientSelection,
  readClientsArg,
} from "./client-selection.js";
import {
  primeDeterministicGlobalBindingsForRepo,
  primeDeterministicRepoVerifications,
  resolveGlobalRepoContext,
  scaffoldPreferredRepoScopedBindings,
} from "./global-mode.js";
import {
  collectRepairActions,
  evaluateHarnessHealth,
  formatClientReadinessBrief,
  formatHealthBrief,
  getHealthClientLabel,
} from "./health.js";
import { refreshActiveHeadSummary } from "./headroom.js";
import { seedMissingActiveLoop } from "./loop.js";
import {
  readInitRepoPath,
  renderManagedGlobalRecoverySummary,
  renderGlobalActivationSteps,
  runInit,
  runInitGlobalWithClients,
  type GlobalClientId,
  type InitTarget,
  type ManagedGlobalWriteOptions,
} from "./init.js";
import { ensureManagedGlobalRuntime } from "./runtime.js";

export async function runRepair(argv: string[] = []): Promise<void> {
  if (argv.includes("--global-runtime")) {
    const runtime = await ensureManagedGlobalRuntime();
    process.stdout.write(
      [
        "",
        "repair summary",
        "",
        "  mode: global-runtime",
        `  runtime: ${runtime.shimPath}`,
        `  version: ${runtime.version}`,
        `  installed_at: ${runtime.installedAt}`,
        "",
      ].join("\n"),
    );
    return;
  }

  if (argv.includes("--global")) {
    const clients = parseGlobalClientSelection(argv);
    const forceManagedGlobal = argv.includes("--force-managed-global");
    const repoContext = await resolveGlobalRepoContext(argv);
    const globalOptions: ManagedGlobalWriteOptions = {
      update: true,
      forceManagedGlobal,
    };
    await runInitGlobalWithClients(clients, globalOptions);
    const preferred = repoContext
      ? await scaffoldPreferredRepoScopedBindings(repoContext.repoPath, clients, true)
      : { preferredClients: [], targets: [] };
    if (repoContext) {
      await seedMissingActiveLoop(repoContext.repoPath).catch(() => undefined);
      await refreshActiveHeadSummary(repoContext.repoPath).catch(() => undefined);
    }
    if (repoContext) {
      await primeDeterministicGlobalBindingsForRepo(repoContext.repoPath, clients);
    }
    process.stdout.write(
      [
        "",
        "repair summary",
        "",
        "  mode: global",
        `  clients: ${clients.join(", ")}`,
        repoContext
          ? `  repo_context: ${repoContext.repoPath} (${repoContext.source})`
          : "  repo_context: none",
        forceManagedGlobal
          ? "  invalid_global_recovery: enabled"
          : "  invalid_global_recovery: disabled",
        preferred.preferredClients.length > 0
          ? `  repo_scoped_preferred: ${preferred.preferredClients.join(", ")}`
          : repoContext
            ? "  repo_scoped_preferred: none"
            : "  repo_scoped_preferred: skipped",
        "  result: reconciled",
        ...renderManagedGlobalRecoverySummary(globalOptions.recoveryBackups),
        renderGlobalActivationSteps(clients, {
          repoPath: repoContext?.repoPath,
          preferredRepoScopedClients: preferred.preferredClients,
        }),
      ].join("\n"),
    );
    return;
  }

  const repoPath = readInitRepoPath(argv);
  const explicitClients = readClientsArg(argv) !== null;
  const before = await evaluateHarnessHealth(repoPath);
  const loopSeeded = await seedMissingActiveLoop(repoPath).catch(() => false);
  const targets = explicitClients
    ? normalizeLocalTargets(parseLocalClientSelection(argv))
    : deriveLocalTargets(before);
  const runtime = await ensureManagedGlobalRuntime();

  if (targets.length === 0 && !loopSeeded) {
    process.stdout.write(
      [
        "",
        "repair summary",
        "",
        `  repo: ${before.repo_path}`,
        "  result: no managed local repairs available",
        `  scaffold: ${before.scaffold_layout}`,
        `  health: ${formatHealthBrief(before)}`,
        "",
      ].join("\n") + "\n",
    );
    if (before.doctor_summary.status === "error") {
      process.exitCode = 1;
    }
    return;
  }

  for (const target of targets) {
    await runInit({
      repoPath,
      update: true,
      target,
      ensureManagedRuntime: false,
    });
  }

  await seedMissingActiveLoop(repoPath).catch(() => undefined);
  await refreshActiveHeadSummary(repoPath).catch(() => undefined);

  await primeDeterministicRepoVerifications(
    repoPath,
    expandLocalHarnessClients(targets),
  );

  const after = await evaluateHarnessHealth(repoPath, {
    persist: true,
    verifiedBy: "repair",
  });
  process.stdout.write(
    [
      "",
      "repair summary",
      "",
      `  repo: ${after.repo_path}`,
      `  targets: ${targets.length > 0 ? targets.join(", ") : "loop"}`,
      `  scaffold: ${after.scaffold_layout}`,
      `  runtime: ${runtime.shimPath}`,
      `  health: ${formatHealthBrief(after)}`,
      `  alerts: ${after.doctor_summary.active_alerts}`,
      `  binding: ${after.binding_status.state}`,
      `  activation: ${formatClientReadinessBrief(after.client_readiness)}`,
      after.last_verified_at ? `  verified_at: ${after.last_verified_at}` : undefined,
      ...expandClientReadinessSummary(after),
      "",
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  );

  if (after.doctor_summary.status === "error") {
    process.exitCode = 1;
  }
}

function deriveLocalTargets(snapshot: Awaited<ReturnType<typeof evaluateHarnessHealth>>): InitTarget[] {
  const actions = collectRepairActions(snapshot, "local");
  if (actions.length === 0) {
    return [];
  }

  const flattened = actions.flatMap(
    (action) => action.clients as Array<InitTarget | GlobalClientId>,
  );
  const localTargets = flattened.filter(isLocalTarget);
  return normalizeLocalTargets(localTargets);
}

function normalizeLocalTargets(targets: InitTarget[]): InitTarget[] {
  if (targets.includes("all")) {
    return ["all"];
  }

  const unique = new Set(targets);
  const order: InitTarget[] = ["codex", "copilot", "claude", "opencode"];
  return order.filter((target) => unique.has(target));
}

function isLocalTarget(value: InitTarget | GlobalClientId): value is InitTarget {
  return (
    value === "all" ||
    value === "claude" ||
    value === "copilot" ||
    value === "opencode" ||
    value === "codex"
  );
}

function expandLocalHarnessClients(targets: InitTarget[]): HarnessClientId[] {
  const selected = targets.includes("all")
    ? (["vscode", "claude-code", "codex", "opencode"] as HarnessClientId[])
    : targets.flatMap((target) => {
        if (target === "copilot") {
          return ["vscode"] as HarnessClientId[];
        }
        if (target === "claude") {
          return ["claude-code"] as HarnessClientId[];
        }
        if (target === "codex") {
          return ["codex"] as HarnessClientId[];
        }
        if (target === "opencode") {
          return ["opencode"] as HarnessClientId[];
        }
        return [];
      });
  return Array.from(new Set(selected));
}

function expandClientReadinessSummary(
  snapshot: Awaited<ReturnType<typeof evaluateHarnessHealth>>,
): string[] {
  return (Object.keys(snapshot.client_readiness) as Array<
    keyof typeof snapshot.client_readiness
  >)
    .flatMap((client) => {
      const readiness = snapshot.client_readiness[client];
      if (readiness.state === "verified") {
        return [];
      }
      return [
        `  ${getHealthClientLabel(client)}: ${readiness.state}`,
        `    detail: ${readiness.detail}`,
        readiness.next_step ? `    next: ${readiness.next_step}` : undefined,
      ].filter((line): line is string => Boolean(line));
    });
}
