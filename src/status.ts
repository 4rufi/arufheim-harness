import process from "node:process";
import path from "node:path";
import { readFile } from "node:fs/promises";

import type { ConfigScope } from "./config.js";
import { loadConfig } from "./config.js";
import {
  evaluateHarnessHealth,
  formatClientReadinessBrief,
  formatHealthBrief,
  listClientReadinessEntries,
  readPersistedHarnessHealth,
  type HarnessHealthSnapshot,
} from "./health.js";
import { summarizePermissionPolicy, type PermissionPolicy } from "./policy.js";
import { readSessionMetrics, recordResponseOutput } from "./session-metrics.js";
import { resolveExistingWithinRepo } from "./safety.js";
import { readMemoryEntries } from "./tools/shared-memory.js";
import {
  listPendingInboxEntries,
  parseFeatureListText,
  resolveWorkflowPaths,
} from "./workflow.js";
import { compactLoopSignal, readLoopStatus, type LoopSummary } from "./loop.js";

interface Feature {
  id: number;
  name: string;
  description?: string;
  status: string;
  sdd?: boolean;
}

type StatusMode = "full" | "brief_only" | "brief_minimal";
type StatusHealth = Pick<
  HarnessHealthSnapshot,
  | "alerts"
  | "binding_status"
  | "client_verification"
  | "client_readiness"
  | "doctor_summary"
  | "degraded_mode"
  | "last_verified_at"
  | "archived_count"
>;

interface BuildHarnessStatusInput {
  repoPath: string;
  configPath: string;
  configScope: ConfigScope;
  permissionPolicy: PermissionPolicy;
  mode?: StatusMode;
  preferCachedHealth?: boolean;
}

interface BuildHarnessStatusMeta {
  mode: StatusMode;
  active: boolean;
  inbox_count: number;
  pending_count: number;
  spec_ready_count: number;
  blocked_count: number;
}

export interface BuildHarnessStatusOutput {
  content: Record<string, unknown>;
  meta: BuildHarnessStatusMeta;
}

function isPlaceholderBody(text: string): boolean {
  return text === "_—_" || text === "_Nada pendiente._";
}

async function readRecentBlockers(
  repoPath: string,
  memoryPath: string,
  limit = 3,
) {
  const entries = await readMemoryEntries(repoPath, memoryPath);
  return entries
    .filter((entry) => entry.type === "blocker")
    .slice(-limit)
    .reverse()
    .map(({ id, timestamp, title, content, feature }) => ({
      id,
      timestamp,
      title,
      content,
      feature,
    }));
}

function extractNextStep(currentMd: string): string {
  const match = currentMd.match(/##\s+Próximo paso\s*\n([\s\S]*?)(?=\n##|$)/);
  if (!match) {
    return "(sin plan activo)";
  }

  const text = match[1].trim();
  if (!text || isPlaceholderBody(text)) {
    return "(sin plan activo)";
  }

  return text;
}

async function readStatusHealth(
  repoPath: string,
  mode: StatusMode,
  preferCachedHealth: boolean,
): Promise<StatusHealth> {
  if ((mode === "brief_only" || mode === "brief_minimal") && preferCachedHealth) {
    const stored = await readPersistedHarnessHealth(repoPath);
    if (stored) {
      return {
        alerts: stored.alerts,
        binding_status: stored.binding_status,
        client_verification: stored.client_verification,
        client_readiness: stored.client_readiness,
        doctor_summary: stored.doctor_summary,
        degraded_mode: stored.degraded_mode,
        last_verified_at: stored.last_verified_at,
        archived_count: stored.archived_count,
      };
    }

    const refreshed = await evaluateHarnessHealth(repoPath, {
      persist: true,
      verifiedBy: "status",
    });
    return {
      alerts: refreshed.alerts,
      binding_status: refreshed.binding_status,
      client_verification: refreshed.client_verification,
      client_readiness: refreshed.client_readiness,
      doctor_summary: refreshed.doctor_summary,
      degraded_mode: refreshed.degraded_mode,
      last_verified_at: refreshed.last_verified_at,
      archived_count: refreshed.archived_count,
    };
  }

  const fresh = await evaluateHarnessHealth(repoPath);
  return {
    alerts: fresh.alerts,
    binding_status: fresh.binding_status,
    client_verification: fresh.client_verification,
    client_readiness: fresh.client_readiness,
    doctor_summary: fresh.doctor_summary,
    degraded_mode: fresh.degraded_mode,
    last_verified_at: fresh.last_verified_at,
    archived_count: fresh.archived_count,
  };
}

function buildMinimalStartupBrief(input: {
  repoPath: string;
  configScope: ConfigScope;
  workflowLayout: "hidden" | "root-legacy";
  health: StatusHealth;
  loopSummary: LoopSummary | null;
}): string {
  const parts = [
    `repo=${input.repoPath}`,
    `config_scope=${input.configScope}`,
    `layout=${input.workflowLayout}`,
    `health=${formatStatusHealthBrief(
      input.repoPath,
      input.workflowLayout,
      input.health,
    )}`,
  ];
  const loopSignal = compactLoopSignal(input.loopSummary);
  if (loopSignal) {
    parts.push(loopSignal);
  }
  return parts.join(" | ");
}

function formatStatusHealthBrief(
  repoPath: string,
  workflowLayout: "hidden" | "root-legacy",
  health: StatusHealth,
): string {
  return formatHealthBrief({
    repo_path: repoPath,
    workflow_layout: workflowLayout,
    diagnostics: [],
    alerts: health.alerts,
    binding_status: health.binding_status,
    client_verification: health.client_verification,
    client_readiness: health.client_readiness,
    doctor_summary: health.doctor_summary,
    degraded_mode: health.degraded_mode,
    last_verified_at: health.last_verified_at,
    archived_count: health.archived_count,
    loop_summary: null,
  });
}

function buildStartupBrief(input: {
  repoPath: string;
  configScope: ConfigScope;
  workflowLayout: "hidden" | "root-legacy";
  health: StatusHealth;
  activeFeature: Feature | null;
  nextStep: string;
  pendingFeatures: Feature[];
  specReadyFeatures: Feature[];
  blockedFeatures: Feature[];
  inboxFiles: string[];
  loopSummary: LoopSummary | null;
}): string {
  const activeLabel = input.activeFeature
    ? `${input.activeFeature.id}:${input.activeFeature.name}:${input.activeFeature.status}`
    : "none";
  const specReadyLabel =
    input.specReadyFeatures.length > 0
      ? input.specReadyFeatures
          .map((feature) => `${feature.id}:${feature.name}`)
          .join(", ")
      : "none";
  const pendingLabel =
    input.pendingFeatures.length > 0
      ? input.pendingFeatures
          .slice(0, 5)
          .map((feature) => `${feature.id}:${feature.name}`)
          .join(", ")
      : "none";
  const blockedLabel =
    input.blockedFeatures.length > 0
      ? input.blockedFeatures
          .slice(0, 5)
          .map((feature) => `${feature.id}:${feature.name}`)
          .join(", ")
      : "none";
  const inboxLabel =
    input.inboxFiles.length > 0 ? input.inboxFiles.slice(0, 5).join(", ") : "none";

  const parts = [
    `repo=${input.repoPath}`,
    `config_scope=${input.configScope}`,
    `layout=${input.workflowLayout}`,
    `health=${formatStatusHealthBrief(input.repoPath, input.workflowLayout, input.health)}`,
    `active=${activeLabel}`,
    `next=${input.nextStep}`,
    `spec_ready=${specReadyLabel}`,
    `pending=${pendingLabel}`,
    `blocked=${blockedLabel}`,
    `inbox=${inboxLabel}`,
  ];
  const loopSignal = compactLoopSignal(input.loopSummary);
  if (loopSignal) {
    parts.push(loopSignal);
  }
  return parts.join(" | ");
}

export async function buildHarnessStatus(
  input: BuildHarnessStatusInput,
): Promise<BuildHarnessStatusOutput> {
  const mode = input.mode ?? "full";
  const preferCachedHealth = input.preferCachedHealth ?? false;
  const repoPath = path.resolve(input.repoPath);
  const workflowPaths = await resolveWorkflowPaths(repoPath);

  if (mode === "brief_minimal") {
    const [health, loopStatus] = await Promise.all([
      readStatusHealth(repoPath, mode, preferCachedHealth),
      readLoopStatus(repoPath),
    ]);
    const startupBrief = buildMinimalStartupBrief({
      repoPath,
      configScope: input.configScope,
      workflowLayout: workflowPaths.layout,
      health,
      loopSummary: loopStatus.loop_summary ?? null,
    });

    return {
      content: {
        startup_brief: startupBrief,
        repo_path: repoPath,
        config_scope: input.configScope,
        doctor_summary: health.doctor_summary,
      },
      meta: {
        mode,
        active: Boolean(loopStatus.loop_summary),
        inbox_count: 0,
        pending_count: 0,
        spec_ready_count: 0,
        blocked_count: 0,
      },
    };
  }

  const [features, currentMd, inboxFiles, health] =
    await Promise.all([
      resolveExistingWithinRepo(repoPath, workflowPaths.featureListPath)
        .then((safePath) => readFile(safePath, "utf8"))
        .then((raw) => parseFeatureListText(raw).features as Feature[])
        .catch(() => [] as Feature[]),
      resolveExistingWithinRepo(repoPath, workflowPaths.currentPath)
        .then((safePath) => readFile(safePath, "utf8"))
        .catch(() => ""),
      listPendingInboxEntries(repoPath),
      readStatusHealth(repoPath, mode, preferCachedHealth),
    ]);

  const activeFeature = features.find((feature) => feature.status === "in_progress") ?? null;
  const pendingFeatures = features.filter((feature) => feature.status === "pending");
  const specReadyFeatures = features.filter(
    (feature) => feature.status === "spec_ready",
  );
  const blockedFeatures = features.filter((feature) => feature.status === "blocked");
  const nextStep = extractNextStep(currentMd);
  const loopStatus = activeFeature
    ? await readLoopStatus(repoPath, activeFeature.id)
    : { exists: false as const, loop_summary: null };
  const startupBrief = buildStartupBrief({
    repoPath,
    configScope: input.configScope,
    workflowLayout: workflowPaths.layout,
    health,
    activeFeature,
    nextStep,
    pendingFeatures,
    specReadyFeatures,
    blockedFeatures,
    inboxFiles,
    loopSummary: loopStatus.loop_summary ?? null,
  });

  const briefContent = {
    startup_brief: startupBrief,
    repo_path: repoPath,
    config_path: path.resolve(input.configPath),
    config_scope: input.configScope,
    workflow_layout: workflowPaths.layout,
    active_feature: activeFeature,
    next_step: nextStep,
    pending_count: pendingFeatures.length,
    spec_ready_count: specReadyFeatures.length,
    blocked_count: blockedFeatures.length,
    inbox_count: inboxFiles.length,
    archived_count: health.archived_count,
    alerts: health.alerts,
    binding_status: health.binding_status,
    client_verification: health.client_verification,
    client_readiness: health.client_readiness,
    doctor_summary: health.doctor_summary,
    last_verified_at: health.last_verified_at,
    degraded_mode: health.degraded_mode,
    loop_summary: loopStatus.loop_summary ?? null,
  };

  if (mode === "brief_only") {
    return {
      content: briefContent,
      meta: {
        mode,
        active: activeFeature !== null,
        inbox_count: inboxFiles.length,
        pending_count: pendingFeatures.length,
        spec_ready_count: specReadyFeatures.length,
        blocked_count: blockedFeatures.length,
      },
    };
  }

  const [recentBlockers, sessionMetrics] = await Promise.all([
    readRecentBlockers(repoPath, workflowPaths.memoryPath),
    readSessionMetrics(repoPath),
  ]);

  return {
    content: {
      initialized:
        features.length > 0 || health.archived_count > 0 || inboxFiles.length > 0,
      repo_path: repoPath,
      config_path: path.resolve(input.configPath),
      config_scope: input.configScope,
      workflow_layout: workflowPaths.layout,
      active_feature: activeFeature,
      spec_ready_features: specReadyFeatures,
      blocked_features: blockedFeatures,
      pending_features: pendingFeatures,
      next_step: nextStep,
      inbox_pending: inboxFiles,
      total_features: features.length,
      archived_features_count: health.archived_count,
      recent_memory_blockers: recentBlockers,
      session_metrics: sessionMetrics,
      permission_policy: summarizePermissionPolicy(input.permissionPolicy),
      alerts: health.alerts,
      binding_status: health.binding_status,
      client_verification: health.client_verification,
      client_readiness: health.client_readiness,
      doctor_summary: health.doctor_summary,
      last_verified_at: health.last_verified_at,
      degraded_mode: health.degraded_mode,
      loop_summary: loopStatus.loop_summary ?? null,
      startup_brief: startupBrief,
    },
    meta: {
      mode,
      active: activeFeature !== null,
      inbox_count: inboxFiles.length,
      pending_count: pendingFeatures.length,
      spec_ready_count: specReadyFeatures.length,
      blocked_count: blockedFeatures.length,
    },
  };
}

function buildStatusText(
  snapshot: BuildHarnessStatusOutput,
  mode: StatusMode,
): string {
  if (mode === "brief_minimal") {
    return `${String(snapshot.content.startup_brief ?? "")}\n`;
  }

  if (mode === "brief_only") {
    return (
      `${String(snapshot.content.startup_brief ?? "")}\n` +
      `activation: ${formatClientReadinessBrief(contentClientReadiness(snapshot.content))}\n`
    );
  }

  const content = snapshot.content;
  const activeFeature =
    typeof content.active_feature === "object" && content.active_feature !== null
      ? (content.active_feature as Feature)
      : null;

  const lines = [
    "",
    "harness status",
    "",
    `  repo: ${content.repo_path}`,
    `  config: ${content.config_path} (${content.config_scope})`,
    `  layout: ${content.workflow_layout}`,
    `  health: ${formatStatusHealthBrief(
      String(content.repo_path),
      content.workflow_layout as "hidden" | "root-legacy",
      {
        alerts: content.alerts as HarnessHealthSnapshot["alerts"],
        binding_status:
          content.binding_status as HarnessHealthSnapshot["binding_status"],
        client_verification:
          content.client_verification as HarnessHealthSnapshot["client_verification"],
        client_readiness:
          content.client_readiness as HarnessHealthSnapshot["client_readiness"],
        doctor_summary:
          content.doctor_summary as HarnessHealthSnapshot["doctor_summary"],
        degraded_mode: Boolean(content.degraded_mode),
        last_verified_at:
          typeof content.last_verified_at === "string"
            ? content.last_verified_at
            : null,
        archived_count:
          typeof content.archived_count === "number" ? content.archived_count : 0,
      },
    )}`,
    `  active: ${activeFeature ? `${activeFeature.id}:${activeFeature.name}:${activeFeature.status}` : "none"}`,
    `  loop: ${formatLoopSummary(content.loop_summary as LoopSummary | null)}`,
    `  next: ${content.next_step}`,
    `  counts: pending=${snapshot.meta.pending_count} spec_ready=${snapshot.meta.spec_ready_count} blocked=${snapshot.meta.blocked_count} inbox=${snapshot.meta.inbox_count}`,
    `  activation: ${formatClientReadinessBrief(contentClientReadiness(content))}`,
  ];

  for (const entry of listClientReadinessEntries(contentClientReadiness(content))) {
    if (entry.status.state === "verified") {
      continue;
    }
    lines.push(`    ${entry.label}: ${entry.status.state}`);
    lines.push(`      detail: ${entry.status.detail}`);
    if (entry.status.next_step) {
      lines.push(`      next: ${entry.status.next_step}`);
    }
  }

  lines.push(`  startup_brief: ${content.startup_brief}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function recordStatusResponseMetric(
  repoPath: string,
  mode: StatusMode,
  json: boolean,
  output: string,
): Promise<void> {
  await recordResponseOutput(
    repoPath,
    `cli:status:${mode}:${json ? "json" : "text"}`,
    Buffer.byteLength(output, "utf8"),
  );
}

export async function runStatus(argv: string[] = []): Promise<void> {
  const brief = argv.includes("--brief");
  const briefMinimal = argv.includes("--brief-minimal");
  const json = argv.includes("--json");
  const config = await loadConfig({ argv });
  const mode: StatusMode = briefMinimal ? "brief_minimal" : brief ? "brief_only" : "full";
  const snapshot = await buildHarnessStatus({
    repoPath: config.repoPath,
    configPath: config.configPath,
    configScope: config.configScope,
    permissionPolicy: config.permissionPolicy,
    mode,
    preferCachedHealth: brief || briefMinimal,
  });

  const output = json
    ? JSON.stringify(snapshot.content, null, 2) + "\n"
    : buildStatusText(snapshot, mode);

  await recordStatusResponseMetric(config.repoPath, mode, json, output).catch(
    () => undefined,
  );

  process.stdout.write(output);
}

function contentClientReadiness(
  content: Record<string, unknown>,
): HarnessHealthSnapshot["client_readiness"] {
  return content.client_readiness as HarnessHealthSnapshot["client_readiness"];
}

function formatLoopSummary(summary: LoopSummary | null): string {
  if (!summary) {
    return "none";
  }

  const blocked = summary.blocked_reason
    ? ` blocked=${summary.blocked_reason}`
    : "";
  return `${summary.phase} attempt=${summary.attempt_index} review=${summary.review_round} next=${summary.next_actor} retry=${summary.can_retry ? "yes" : "no"} budget[a=${summary.budget_remaining.attempts},r=${summary.budget_remaining.review_route_backs},n=${summary.budget_remaining.no_progress_rounds}]${blocked}`;
}
