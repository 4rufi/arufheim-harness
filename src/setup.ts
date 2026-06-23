import process from "node:process";

import type { HarnessClientId } from "./config.js";
import {
  parseGlobalClientSelection,
  parseLocalClientSelection,
} from "./client-selection.js";
import {
  primeDeterministicGlobalBindingsForRepo,
  resolveGlobalRepoContext,
  scaffoldPreferredRepoScopedBindings,
  primeDeterministicRepoVerifications,
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
  readLayoutArg,
  readInitRepoPath,
  renderManagedGlobalRecoverySummary,
  renderGlobalActivationSteps,
  runInit,
  runInitGlobalWithClients,
  type ManagedGlobalWriteOptions,
  type InitTarget,
} from "./init.js";
import { ensureManagedGlobalRuntime } from "./runtime.js";

export async function runSetup(argv: string[] = []): Promise<void> {
  if (argv.includes("--global-runtime")) {
    const runtime = await ensureManagedGlobalRuntime();
    process.stdout.write(
      [
        "",
        "setup summary",
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

  const forceUpdate = argv.includes("--update");
  const forceManagedGlobal = argv.includes("--force-managed-global");
  const layout = readLayoutArg(argv);

  if (argv.includes("--global")) {
    const globalClients = parseGlobalClientSelection(argv);
    const repoContext = await resolveGlobalRepoContext(argv);
    const globalOptions: ManagedGlobalWriteOptions = {
      update: forceUpdate,
      forceManagedGlobal,
    };
    await runInitGlobalWithClients(globalClients, globalOptions);
    const preferred = repoContext
      ? await scaffoldPreferredRepoScopedBindings(
          repoContext.repoPath,
          globalClients,
          forceUpdate,
        )
      : { preferredClients: [], targets: [] };
    if (repoContext) {
      await seedMissingActiveLoop(repoContext.repoPath);
      await refreshActiveHeadSummary(repoContext.repoPath).catch(() => undefined);
    }
    if (repoContext) {
      await primeDeterministicGlobalBindingsForRepo(
        repoContext.repoPath,
        globalClients,
      );
    }
    process.stdout.write(
      [
        "",
        "setup summary",
        "",
        "  mode: global",
        `  clients: ${globalClients.join(", ")}`,
        `  update: ${forceUpdate ? "forced" : "no"}`,
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
        "  result: configured",
        ...renderManagedGlobalRecoverySummary(globalOptions.recoveryBackups),
        renderGlobalActivationSteps(globalClients, {
          repoPath: repoContext?.repoPath,
          preferredRepoScopedClients: preferred.preferredClients,
        }),
      ].join("\n"),
    );
    return;
  }

  const repoPath = readInitRepoPath(argv);
  const targets = normalizeTargets(parseLocalClientSelection(argv));
  const runtime = await ensureManagedGlobalRuntime();

  for (const target of targets) {
    await runInit({
      repoPath,
      update: forceUpdate ? true : false,
      target,
      layout,
      ensureManagedRuntime: false,
    });
  }

  if (!forceUpdate) {
    const before = await evaluateHarnessHealth(repoPath);
    const reconcileTargets = deriveRepoUpdateTargets(before, targets);
    for (const target of reconcileTargets) {
      await runInit({
        repoPath,
        update: true,
        target,
        layout,
        ensureManagedRuntime: false,
      });
    }
  }

  await seedMissingActiveLoop(repoPath).catch(() => undefined);
  await refreshActiveHeadSummary(repoPath).catch(() => undefined);

  await primeDeterministicRepoVerifications(
    repoPath,
    expandLocalHarnessClients(targets),
  );

  const snapshot = await evaluateHarnessHealth(repoPath, {
    persist: true,
    verifiedBy: "setup",
  });
  process.stdout.write(
    [
      "",
      "setup summary",
      "",
      `  repo: ${snapshot.repo_path}`,
      `  clients: ${targets.join(", ")}`,
      `  update: ${forceUpdate ? "forced" : "auto"}`,
      `  layout: ${snapshot.workflow_layout}`,
      `  scaffold: ${snapshot.scaffold_layout}`,
      `  runtime: ${runtime.shimPath}`,
      `  health: ${formatHealthBrief(snapshot)}`,
      `  alerts: ${snapshot.doctor_summary.active_alerts}`,
      `  binding: ${snapshot.binding_status.state}`,
      `  activation: ${formatClientReadinessBrief(snapshot.client_readiness)}`,
      snapshot.last_verified_at
        ? `  verified_at: ${snapshot.last_verified_at}`
        : undefined,
      ...expandClientReadinessSummary(snapshot),
      "",
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  );

  if (snapshot.doctor_summary.status === "error") {
    process.exitCode = 1;
  }
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

function normalizeTargets(targets: InitTarget[]): InitTarget[] {
  if (targets.includes("all")) {
    return ["all"];
  }

  const order: InitTarget[] = ["codex", "copilot", "claude", "opencode"];
  return order.filter((target) => targets.includes(target));
}

function deriveRepoUpdateTargets(
  snapshot: Awaited<ReturnType<typeof evaluateHarnessHealth>>,
  requestedTargets: InitTarget[],
): InitTarget[] {
  const actions = collectRepairActions(snapshot, "local");
  if (actions.length === 0) {
    return [];
  }

  if (requestedTargets.includes("all")) {
    return ["all"];
  }

  const selected = new Set<InitTarget>();
  for (const action of actions) {
    for (const client of action.clients as InitTarget[]) {
      if (client === "all") {
        for (const requested of requestedTargets) {
          selected.add(requested);
        }
        continue;
      }
      if (requestedTargets.includes(client)) {
        selected.add(client);
      }
    }
  }

  return normalizeTargets(Array.from(selected));
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
