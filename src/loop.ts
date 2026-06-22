import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LoopPolicyConfig } from "./config.js";
import { DEFAULT_LOOP_POLICY } from "./config.js";
import {
  assertExistingPathWithinRepo,
  openRepoWriteHandle,
  prepareRepoWriteTarget,
  resolveExistingWithinRepo,
} from "./safety.js";
import {
  parseFeatureHistoryText,
  parseFeatureListText,
  readFeatureListDocument,
  resolveWorkflowPaths,
  type WorkflowFeature,
  type WorkflowPaths,
} from "./workflow.js";

const LOOP_FILE_VERSION = 1;

export type LoopKind = "plan_execute_verify";
export type LoopPhase =
  | "plan"
  | "execute"
  | "verify"
  | "review"
  | "analyze"
  | "route_back"
  | "done"
  | "blocked";
export type LoopActor = "leader" | "implementer" | "reviewer" | "human";
export type LoopProgressDelta = "none" | "partial" | "meaningful";

export interface LoopBudgetState {
  max_attempts_total: number;
  max_review_route_backs: number;
  max_no_progress_rounds: number;
  require_strategy_delta: boolean;
  auto_route_back: boolean;
  remaining_attempts: number;
  remaining_review_route_backs: number;
  remaining_no_progress_rounds: number;
}

export interface LoopEventRecord {
  timestamp: string;
  phase: Exclude<LoopPhase, "done" | "blocked"> | "done" | "blocked";
  actor: LoopActor;
  outcome: string;
  summary: string;
  verification?: string;
  error_signature?: string;
  progress_delta: LoopProgressDelta;
  strategy_delta?: string;
  next_actor?: LoopActor;
}

export interface LoopTerminationState {
  status: "open" | "done" | "blocked";
  reason?: string;
  at?: string;
}

export interface LoopStateFile {
  version: number;
  feature_id: number;
  feature_name: string;
  feature_slug: string;
  loop_kind: LoopKind;
  phase: LoopPhase;
  attempt_index: number;
  review_round: number;
  next_actor: LoopActor;
  goal_summary: string;
  termination: LoopTerminationState;
  budgets: LoopBudgetState;
  last_outcome: string | null;
  last_error_signature: string | null;
  last_strategy_delta: string | null;
  no_progress_streak: number;
  repeated_failure_streak: number;
  blocked_reason?: string;
  events: LoopEventRecord[];
}

export interface LoopSummary {
  feature_id: number;
  phase: LoopPhase;
  attempt_index: number;
  review_round: number;
  next_actor: LoopActor;
  last_outcome: string | null;
  can_retry: boolean;
  budget_remaining: {
    attempts: number;
    review_route_backs: number;
    no_progress_rounds: number;
  };
  blocked_reason?: string;
}

export interface LoopStatusResult {
  exists: boolean;
  feature_id?: number;
  feature_name?: string;
  path?: string;
  loop?: LoopStateFile;
  loop_summary?: LoopSummary;
}

export interface LoopEventInput {
  phase: LoopPhase;
  actor: LoopActor;
  outcome: string;
  summary: string;
  verification?: string;
  error_signature?: string;
  progress_delta?: LoopProgressDelta;
  strategy_delta?: string;
  next_actor?: LoopActor;
}

export interface LoopHealthDiagnostic {
  code: string;
  severity: "warn" | "error";
  blocking: boolean;
  message: string;
  detail?: string;
  fix_command?: string;
  fix_hint?: string;
}

interface LoopDerivationState {
  phase: LoopPhase;
  attempt_index: number;
  review_round: number;
  next_actor: LoopActor;
  termination: LoopTerminationState;
  last_outcome: string | null;
  last_error_signature: string | null;
  last_strategy_delta: string | null;
  no_progress_streak: number;
  repeated_failure_streak: number;
  blocked_reason?: string;
  review_route_backs_used: number;
  pending_review_route_back: boolean;
}

interface LoopFileLocation {
  relativePath: string;
  absolutePath: string;
}

interface FeatureIdentity {
  id: number;
  name: string;
  description?: string;
  title?: string;
  status?: string;
}

export function loopPolicyDefaults(): LoopPolicyConfig {
  return {
    kind: DEFAULT_LOOP_POLICY.kind,
    maxAttemptsTotal: DEFAULT_LOOP_POLICY.maxAttemptsTotal,
    maxReviewRouteBacks: DEFAULT_LOOP_POLICY.maxReviewRouteBacks,
    maxNoProgressRounds: DEFAULT_LOOP_POLICY.maxNoProgressRounds,
    requireStrategyDelta: DEFAULT_LOOP_POLICY.requireStrategyDelta,
    autoRouteBack: DEFAULT_LOOP_POLICY.autoRouteBack,
  };
}

export function compactLoopSignal(summary: LoopSummary | null): string | null {
  if (!summary) {
    return null;
  }

  return `loop=${summary.phase}:a${summary.attempt_index}`;
}

export async function readLoopStatus(
  repoPath: string,
  featureId?: number,
): Promise<LoopStatusResult> {
  const feature = featureId
    ? await readFeatureById(repoPath, featureId)
    : await readActiveFeature(repoPath);
  if (!feature) {
    return { exists: false };
  }

  const loop = await readLoopStateForFeature(repoPath, feature.id);
  if (!loop) {
    return {
      exists: false,
      feature_id: feature.id,
      feature_name: feature.name,
    };
  }

  const location = await resolveExistingLoopLocation(repoPath, feature.id);
  return {
    exists: true,
    feature_id: feature.id,
    feature_name: loop.feature_name,
    path: location?.relativePath,
    loop,
    loop_summary: summarizeLoop(loop),
  };
}

export async function ensureLoopForFeature(
  repoPath: string,
  feature: FeatureIdentity,
  policy: LoopPolicyConfig = loopPolicyDefaults(),
): Promise<LoopStateFile> {
  const existing = await readLoopStateForFeature(repoPath, feature.id);
  if (!existing) {
    const created = createInitialLoopState(feature, policy);
    await writeLoopState(repoPath, created);
    return created;
  }

  const synchronized = synchronizeLoopIdentity(existing, feature, policy);
  await writeLoopState(repoPath, synchronized);
  return synchronized;
}

export async function syncLoopTerminalState(
  repoPath: string,
  feature: FeatureIdentity,
  policy: LoopPolicyConfig,
  status: "done" | "blocked",
): Promise<LoopStateFile | null> {
  const existing = await readLoopStateForFeature(repoPath, feature.id);
  if (!existing) {
    return null;
  }

  const normalized = synchronizeLoopIdentity(existing, feature, policy);
  if (normalized.termination.status === status) {
    await writeLoopState(repoPath, normalized);
    return normalized;
  }

  const terminalEvent: LoopEventRecord = {
    timestamp: new Date().toISOString(),
    phase: status,
    actor: "leader",
    outcome: status,
    summary: `Feature moved to ${status}.`,
    progress_delta: status === "done" ? "meaningful" : "partial",
  };
  const next = deriveLoopState(
    normalized.feature_id,
    feature.name,
    buildGoalSummary(feature),
    policy,
    [...normalized.events, terminalEvent],
  );
  await writeLoopState(repoPath, next);
  return next;
}

export async function syncExistingLoopIdentity(
  repoPath: string,
  feature: FeatureIdentity,
  policy: LoopPolicyConfig,
): Promise<LoopStateFile | null> {
  const existing = await readLoopStateForFeature(repoPath, feature.id);
  if (!existing) {
    return null;
  }

  const synchronized = synchronizeLoopIdentity(existing, feature, policy);
  await writeLoopState(repoPath, synchronized);
  return synchronized;
}

export async function appendLoopEvent(
  repoPath: string,
  feature: FeatureIdentity,
  input: LoopEventInput,
  policy: LoopPolicyConfig = loopPolicyDefaults(),
): Promise<{
  loop: LoopStateFile;
  loop_summary: LoopSummary;
  recommended_feature_status?: "done" | "blocked";
}> {
  const current = await ensureLoopForFeature(repoPath, feature, policy);
  if (current.termination.status !== "open") {
    throw new Error(
      `Loop for feature ${feature.id}:${feature.name} is already terminal (${current.termination.status}).`,
    );
  }

  validateLoopEvent(current, input, policy);

  const event: LoopEventRecord = {
    timestamp: new Date().toISOString(),
    phase: input.phase,
    actor: input.actor,
    outcome: input.outcome.trim(),
    summary: input.summary.trim(),
    verification: normalizeOptionalText(input.verification),
    error_signature: normalizeOptionalText(input.error_signature),
    progress_delta: normalizeEventProgressDelta(input),
    strategy_delta: normalizeOptionalText(input.strategy_delta),
    next_actor: input.next_actor,
  };

  const next = deriveLoopState(
    current.feature_id,
    feature.name,
    buildGoalSummary(feature),
    policy,
    [...current.events, event],
  );
  await writeLoopState(repoPath, next);

  return {
    loop: next,
    loop_summary: summarizeLoop(next),
    recommended_feature_status:
      next.termination.status === "open"
        ? undefined
        : next.termination.status,
  };
}

export async function seedMissingActiveLoop(
  repoPath: string,
  policy: LoopPolicyConfig = loopPolicyDefaults(),
): Promise<boolean> {
  const active = await readActiveFeature(repoPath);
  if (!active || active.status !== "in_progress") {
    return false;
  }

  const existing = await readLoopStateForFeature(repoPath, active.id);
  if (existing) {
    const synchronized = synchronizeLoopIdentity(existing, active, policy);
    await writeLoopState(repoPath, synchronized);
    return false;
  }

  const created = createInitialLoopState(active, policy);
  await writeLoopState(repoPath, created);
  return true;
}

export async function readLoopStateForFeature(
  repoPath: string,
  featureId: number,
): Promise<LoopStateFile | null> {
  const location = await resolveExistingLoopLocation(repoPath, featureId);
  if (!location) {
    return null;
  }

  const raw = await readFile(location.absolutePath, "utf8");
  return parseLoopStateText(raw);
}

export async function collectLoopDiagnostics(
  repoPath: string,
  input: {
    activeFeatures: WorkflowFeature[];
    archivedFeatures: WorkflowFeature[];
    policy: LoopPolicyConfig;
    repairCommand?: string;
  },
): Promise<LoopHealthDiagnostic[]> {
  const diagnostics: LoopHealthDiagnostic[] = [];
  const loops = await readAllLoopStates(repoPath);
  const loopById = new Map(loops.map((entry) => [entry.loop.feature_id, entry]));

  for (const feature of input.activeFeatures) {
    if (feature.status === "in_progress" && !loopById.has(feature.id)) {
      diagnostics.push({
        code: "loop.active.missing",
        severity: "error",
        blocking: true,
        message: "Feature in_progress sin loop file",
        detail: `${feature.id}:${feature.name}`,
        fix_command: input.repairCommand,
      });
    }
  }

  const terminalFeatures = new Map<number, string>();
  for (const feature of input.activeFeatures) {
    if (feature.status === "blocked") {
      terminalFeatures.set(feature.id, "blocked");
    }
  }
  for (const feature of input.archivedFeatures) {
    if (feature.status === "done" || feature.status === "blocked") {
      terminalFeatures.set(feature.id, feature.status);
    }
  }

  for (const feature of input.activeFeatures) {
    const entry = loopById.get(feature.id);
    if (!entry) {
      continue;
    }
    if (
      entry.loop.termination.status !== "open" &&
      feature.status !== entry.loop.termination.status
    ) {
      diagnostics.push({
        code: "loop.feature.inconsistent_terminal",
        severity: "error",
        blocking: true,
        message: "Loop terminal con feature no terminal",
        detail: `${feature.id}:${feature.name} -> loop=${entry.loop.termination.status} feature=${feature.status}`,
        fix_hint:
          "Alinea manualmente el estado de la feature o registra el cierre correcto del loop antes de continuar.",
      });
    }
  }

  for (const [featureId, expectedStatus] of terminalFeatures) {
    const entry = loopById.get(featureId);
    if (!entry) {
      continue;
    }
    if (entry.loop.termination.status === "open") {
      diagnostics.push({
        code: "loop.feature.terminal_open",
        severity: "warn",
        blocking: false,
        message: "Feature terminal con loop abierto",
        detail: `${featureId}:${entry.loop.feature_name} -> feature=${expectedStatus}`,
        fix_hint:
          "Cierra el loop con un evento terminal o reconcilia el estado de la feature si el cierre fue prematuro.",
      });
    }
  }

  for (const entry of loops) {
    const invalidRetry = findEquivalentRetryWithoutStrategyDelta(entry.loop);
    if (invalidRetry) {
      diagnostics.push({
        code: "loop.retry.strategy_delta_missing",
        severity: "warn",
        blocking: false,
        message: "Retry equivalente sin strategy_delta",
        detail: `${entry.loop.feature_id}:${entry.loop.feature_name} -> ${invalidRetry}`,
        fix_hint:
          "Registra un route_back con strategy_delta explícito antes de repetir el intento.",
      });
    }

    if (
      entry.loop.termination.status === "open" &&
      entry.loop.phase !== "done" &&
      entry.loop.phase !== "blocked" &&
      !summarizeLoop(entry.loop).can_retry &&
      entry.loop.next_actor !== "reviewer"
    ) {
      diagnostics.push({
        code: "loop.budget.exhausted",
        severity: "warn",
        blocking: false,
        message: "Loop sin budget restante sigue abierto",
        detail: `${entry.loop.feature_id}:${entry.loop.feature_name} -> phase=${entry.loop.phase}`,
        fix_hint:
          "Marca la feature como blocked o registra una salida terminal si ya no queda retry válido.",
      });
    }
  }

  return diagnostics;
}

export function summarizeLoop(loop: LoopStateFile): LoopSummary {
  const budgetRemaining = {
    attempts: loop.budgets.remaining_attempts,
    review_route_backs: loop.budgets.remaining_review_route_backs,
    no_progress_rounds: loop.budgets.remaining_no_progress_rounds,
  };

  return {
    feature_id: loop.feature_id,
    phase: loop.phase,
    attempt_index: loop.attempt_index,
    review_round: loop.review_round,
    next_actor: loop.next_actor,
    last_outcome: loop.last_outcome,
    can_retry:
      loop.termination.status === "open" &&
      loop.phase !== "done" &&
      loop.phase !== "blocked" &&
      budgetRemaining.attempts > 0 &&
      budgetRemaining.no_progress_rounds > 0 &&
      !(loop.phase === "review" && budgetRemaining.review_route_backs < 0),
    budget_remaining: budgetRemaining,
    blocked_reason: loop.blocked_reason,
  };
}

export async function readActiveLoopSummary(
  repoPath: string,
): Promise<LoopSummary | null> {
  const status = await readLoopStatus(repoPath);
  return status.loop_summary ?? null;
}

export function parseLoopStateText(raw: string): LoopStateFile {
  const parsed = JSON.parse(raw) as Partial<LoopStateFile>;
  if (
    typeof parsed.feature_id !== "number" ||
    typeof parsed.feature_name !== "string" ||
    !Array.isArray(parsed.events)
  ) {
    throw new Error("Invalid loop state file.");
  }

  return deriveLoopState(
    parsed.feature_id,
    parsed.feature_name,
    typeof parsed.goal_summary === "string"
      ? parsed.goal_summary
      : parsed.feature_name,
    {
      kind:
        parsed.loop_kind === "plan_execute_verify"
          ? "plan_execute_verify"
          : DEFAULT_LOOP_POLICY.kind,
      maxAttemptsTotal:
        typeof parsed.budgets?.max_attempts_total === "number"
          ? parsed.budgets.max_attempts_total
          : DEFAULT_LOOP_POLICY.maxAttemptsTotal,
      maxReviewRouteBacks:
        typeof parsed.budgets?.max_review_route_backs === "number"
          ? parsed.budgets.max_review_route_backs
          : DEFAULT_LOOP_POLICY.maxReviewRouteBacks,
      maxNoProgressRounds:
        typeof parsed.budgets?.max_no_progress_rounds === "number"
          ? parsed.budgets.max_no_progress_rounds
          : DEFAULT_LOOP_POLICY.maxNoProgressRounds,
      requireStrategyDelta:
        typeof parsed.budgets?.require_strategy_delta === "boolean"
          ? parsed.budgets.require_strategy_delta
          : DEFAULT_LOOP_POLICY.requireStrategyDelta,
      autoRouteBack:
        typeof parsed.budgets?.auto_route_back === "boolean"
          ? parsed.budgets.auto_route_back
          : DEFAULT_LOOP_POLICY.autoRouteBack,
    },
    parsed.events.map((event) => ({
      timestamp:
        typeof event.timestamp === "string"
          ? event.timestamp
          : new Date().toISOString(),
      phase: normalizePhase(event.phase),
      actor: normalizeActor(event.actor),
      outcome:
        typeof event.outcome === "string" ? event.outcome : "unknown",
      summary:
        typeof event.summary === "string" ? event.summary : "sin resumen",
      verification:
        typeof event.verification === "string" ? event.verification : undefined,
      error_signature:
        typeof event.error_signature === "string"
          ? event.error_signature
          : undefined,
      progress_delta: normalizeProgressDelta(event.progress_delta),
      strategy_delta:
        typeof event.strategy_delta === "string"
          ? event.strategy_delta
          : undefined,
      next_actor:
        typeof event.next_actor === "string"
          ? normalizeActor(event.next_actor)
          : undefined,
    })),
  );
}

function deriveLoopState(
  featureId: number,
  featureName: string,
  goalSummary: string,
  policyInput: LoopPolicyConfig,
  events: LoopEventRecord[],
): LoopStateFile {
  const policy = normalizePolicy(policyInput);
  const state: LoopDerivationState = {
    phase: "plan",
    attempt_index: 1,
    review_round: 0,
    next_actor: "leader",
    termination: { status: "open" },
    last_outcome: null,
    last_error_signature: null,
    last_strategy_delta: null,
    no_progress_streak: 0,
    repeated_failure_streak: 0,
    blocked_reason: undefined,
    review_route_backs_used: 0,
    pending_review_route_back: false,
  };

  for (const event of events) {
    if (state.termination.status !== "open") {
      break;
    }

    const classification = classifyOutcome(event.outcome);
    state.last_outcome = event.outcome;
    if (event.strategy_delta) {
      state.last_strategy_delta = event.strategy_delta;
    }

    if (event.error_signature) {
      state.repeated_failure_streak =
        event.error_signature === state.last_error_signature &&
        event.progress_delta !== "meaningful"
          ? state.repeated_failure_streak + 1
          : 1;
      state.last_error_signature = event.error_signature;
    } else if (event.progress_delta === "meaningful") {
      state.repeated_failure_streak = 0;
    }

    state.no_progress_streak =
      event.progress_delta === "none" ? state.no_progress_streak + 1 : 0;

    if (event.phase === "review") {
      state.review_round += 1;
      state.pending_review_route_back = classification !== "success";
    }

    if (event.phase === "done") {
      markLoopDone(state, event.summary, event.timestamp);
      continue;
    }

    if (event.phase === "blocked") {
      markLoopBlocked(state, event.summary, event.timestamp);
      continue;
    }

    if (event.phase === "plan") {
      if (classification === "success") {
        state.phase = "execute";
        state.next_actor = event.next_actor ?? "implementer";
      } else {
        state.phase = "analyze";
        state.next_actor = "leader";
      }
    } else if (event.phase === "execute") {
      if (classification === "success") {
        state.phase = "verify";
        state.next_actor = event.next_actor ?? "leader";
      } else {
        state.phase = "analyze";
        state.next_actor = "leader";
      }
    } else if (event.phase === "verify") {
      if (classification === "success") {
        state.phase = "review";
        state.next_actor = event.next_actor ?? "reviewer";
      } else {
        state.phase = "analyze";
        state.next_actor = "leader";
      }
    } else if (event.phase === "review") {
      if (classification === "success") {
        markLoopDone(state, event.summary, event.timestamp);
        state.pending_review_route_back = false;
      } else {
        state.phase = "analyze";
        state.next_actor = "leader";
      }
    } else if (event.phase === "analyze") {
      if (classification === "blocked") {
        markLoopBlocked(state, event.summary, event.timestamp);
      } else {
        state.phase = "route_back";
        state.next_actor = event.next_actor ?? "leader";
      }
    } else if (event.phase === "route_back") {
      if (
        state.pending_review_route_back &&
        state.review_route_backs_used >= policy.maxReviewRouteBacks
      ) {
        markLoopBlocked(
          state,
          "review route-back budget exhausted",
          event.timestamp,
          "max_review_route_backs",
        );
      } else if (state.attempt_index >= policy.maxAttemptsTotal) {
        markLoopBlocked(
          state,
          "attempt budget exhausted",
          event.timestamp,
          "max_attempts_total",
        );
      } else {
        if (state.pending_review_route_back) {
          state.review_route_backs_used += 1;
          state.pending_review_route_back = false;
        }
        state.attempt_index += 1;
        state.phase = "execute";
        state.next_actor = event.next_actor ?? "implementer";
      }
    }

    if (
      state.termination.status === "open" &&
      state.phase === "analyze" &&
      state.attempt_index >= policy.maxAttemptsTotal
    ) {
      markLoopBlocked(
        state,
        "attempt budget exhausted",
        event.timestamp,
        "max_attempts_total",
      );
    }

    if (
      state.termination.status === "open" &&
      state.phase === "analyze" &&
      state.pending_review_route_back &&
      state.review_route_backs_used >= policy.maxReviewRouteBacks
    ) {
      markLoopBlocked(
        state,
        "review route-back budget exhausted",
        event.timestamp,
        "max_review_route_backs",
      );
    }

    if (
      state.termination.status === "open" &&
      state.no_progress_streak >= policy.maxNoProgressRounds
    ) {
      markLoopBlocked(
        state,
        "no progress budget exhausted",
        event.timestamp,
        "max_no_progress_rounds",
      );
    }

    if (
      state.termination.status === "open" &&
      state.repeated_failure_streak >= policy.maxNoProgressRounds &&
      state.last_error_signature
    ) {
      markLoopBlocked(
        state,
        `repeated failure: ${state.last_error_signature}`,
        event.timestamp,
        "repeated_error_signature",
      );
    }
  }

  const budgets = {
    max_attempts_total: policy.maxAttemptsTotal,
    max_review_route_backs: policy.maxReviewRouteBacks,
    max_no_progress_rounds: policy.maxNoProgressRounds,
    require_strategy_delta: policy.requireStrategyDelta,
    auto_route_back: policy.autoRouteBack,
    remaining_attempts: Math.max(0, policy.maxAttemptsTotal - state.attempt_index),
    remaining_review_route_backs: Math.max(
      0,
      policy.maxReviewRouteBacks - state.review_route_backs_used,
    ),
    remaining_no_progress_rounds: Math.max(
      0,
      policy.maxNoProgressRounds - state.no_progress_streak,
    ),
  };

  return {
    version: LOOP_FILE_VERSION,
    feature_id: featureId,
    feature_name: featureName,
    feature_slug: toFeatureSlug(featureName),
    loop_kind: "plan_execute_verify",
    phase: state.phase,
    attempt_index: state.attempt_index,
    review_round: state.review_round,
    next_actor: state.next_actor,
    goal_summary: goalSummary,
    termination: state.termination,
    budgets,
    last_outcome: state.last_outcome,
    last_error_signature: state.last_error_signature,
    last_strategy_delta: state.last_strategy_delta,
    no_progress_streak: state.no_progress_streak,
    repeated_failure_streak: state.repeated_failure_streak,
    blocked_reason: state.blocked_reason,
    events,
  };
}

function validateLoopEvent(
  current: LoopStateFile,
  input: LoopEventInput,
  policy: LoopPolicyConfig,
): void {
  if (!input.outcome.trim()) {
    throw new Error("Loop outcome cannot be empty.");
  }
  if (!input.summary.trim()) {
    throw new Error("Loop summary cannot be empty.");
  }

  const lastEvent = current.events.at(-1);
  const nextStrategyDelta = normalizeOptionalText(input.strategy_delta);
  const nextErrorSignature = normalizeOptionalText(input.error_signature);
  const progressDelta = input.progress_delta ?? inferProgressDelta(input.phase, input.outcome);

  const repeatingSameError =
    nextErrorSignature !== undefined &&
    nextErrorSignature !== null &&
    nextErrorSignature === current.last_error_signature;

  if (
    policy.requireStrategyDelta &&
    input.phase === "route_back" &&
    !nextStrategyDelta
  ) {
    throw new Error(
      "Route-back requires strategy_delta to document what changed before the next attempt.",
    );
  }

  if (
    policy.requireStrategyDelta &&
    repeatingSameError &&
    progressDelta === "none" &&
    !nextStrategyDelta
  ) {
    throw new Error(
      "Equivalent retry detected: same error_signature with no progress requires strategy_delta.",
    );
  }

  if (
    policy.requireStrategyDelta &&
    lastEvent?.phase === "analyze" &&
    input.phase === "route_back" &&
    !nextStrategyDelta
  ) {
    throw new Error(
      "Route-back after analyze requires strategy_delta.",
    );
  }
}

async function readAllLoopStates(
  repoPath: string,
): Promise<Array<{ relativePath: string; loop: LoopStateFile }>> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const loopsDir = path.join(repoPath, workflowPaths.loopMetricsDir);
  try {
    const names = (await readdir(loopsDir))
      .filter((name) => name.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right));
    const results: Array<{ relativePath: string; loop: LoopStateFile }> = [];
    for (const name of names) {
      const absolutePath = await assertExistingPathWithinRepo(
        repoPath,
        path.join(loopsDir, name),
      );
      const raw = await readFile(absolutePath, "utf8");
      results.push({
        relativePath: path.join(workflowPaths.loopMetricsDir, name),
        loop: parseLoopStateText(raw),
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function resolveExistingLoopLocation(
  repoPath: string,
  featureId: number,
): Promise<LoopFileLocation | null> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const loopsDir = path.join(repoPath, workflowPaths.loopMetricsDir);
  try {
    const names = await readdir(loopsDir);
    const match = names.find((name) =>
      name.startsWith(`${featureId}_`) && name.endsWith(".json"),
    );
    if (!match) {
      return null;
    }

    const relativePath = path.join(workflowPaths.loopMetricsDir, match);
    const absolutePath = await resolveExistingWithinRepo(repoPath, relativePath);
    return { relativePath, absolutePath };
  } catch {
    return null;
  }
}

async function writeLoopState(
  repoPath: string,
  loop: LoopStateFile,
): Promise<void> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const desiredRelativePath = path.join(
    workflowPaths.loopMetricsDir,
    `${loop.feature_id}_${loop.feature_slug}.json`,
  );
  const existing = await resolveExistingLoopLocation(repoPath, loop.feature_id);
  if (
    existing &&
    existing.relativePath !== desiredRelativePath
  ) {
    const fromPath = existing.absolutePath;
    const toPath = await prepareRepoWriteTarget(repoPath, desiredRelativePath);
    await mkdir(path.dirname(toPath), { recursive: true });
    await rename(fromPath, toPath);
  }

  const handle = await openRepoWriteHandle(repoPath, desiredRelativePath);
  try {
    await handle.writeFile(JSON.stringify(loop, null, 2) + "\n", "utf8");
  } finally {
    await handle.close();
  }
}

function createInitialLoopState(
  feature: FeatureIdentity,
  policy: LoopPolicyConfig,
): LoopStateFile {
  return deriveLoopState(
    feature.id,
    feature.name,
    buildGoalSummary(feature),
    policy,
    [],
  );
}

function synchronizeLoopIdentity(
  current: LoopStateFile,
  feature: FeatureIdentity,
  policy: LoopPolicyConfig,
): LoopStateFile {
  return deriveLoopState(
    feature.id,
    feature.name,
    buildGoalSummary(feature),
    policy,
    current.events,
  );
}

async function readActiveFeature(
  repoPath: string,
): Promise<FeatureIdentity | null> {
  try {
    const { document } = await readFeatureListDocument(repoPath);
    const active = document.features.find(
      (feature) => feature.status === "in_progress",
    );
    return active ?? null;
  } catch {
    return null;
  }
}

async function readFeatureById(
  repoPath: string,
  featureId: number,
): Promise<FeatureIdentity | null> {
  try {
    const { document } = await readFeatureListDocument(repoPath);
    const active = document.features.find((feature) => feature.id === featureId);
    if (active) {
      return active;
    }
  } catch {
    // continue to archived lookup
  }

  try {
    const workflowPaths = await resolveWorkflowPaths(repoPath);
    const raw = await readFile(
      path.join(repoPath, workflowPaths.featureHistoryPath),
      "utf8",
    );
    return (
      parseFeatureHistoryText(raw).find((feature) => feature.id === featureId) ??
      null
    );
  } catch {
    return null;
  }
}

function buildGoalSummary(feature: FeatureIdentity): string {
  return (
    normalizeOptionalText(feature.description) ??
    normalizeOptionalText(feature.title) ??
    feature.name
  );
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function inferProgressDelta(
  phase: LoopPhase,
  outcome: string,
): LoopProgressDelta {
  const classification = classifyOutcome(outcome);
  if (phase === "route_back") {
    return "meaningful";
  }
  if (classification === "success") {
    return "meaningful";
  }
  if (classification === "blocked") {
    return "partial";
  }
  if (classification === "rejected") {
    return "partial";
  }
  return "none";
}

function normalizeEventProgressDelta(
  input: LoopEventInput,
): LoopProgressDelta {
  if (
    input.phase === "route_back" &&
    normalizeOptionalText(input.strategy_delta)
  ) {
    return "meaningful";
  }

  return input.progress_delta ?? inferProgressDelta(input.phase, input.outcome);
}

function classifyOutcome(
  outcome: string,
): "success" | "failed" | "rejected" | "blocked" | "other" {
  const normalized = outcome.trim().toLowerCase();
  if (
    [
      "approved",
      "aprobado",
      "success",
      "passed",
      "verified",
      "done",
      "completed",
    ].includes(normalized)
  ) {
    return "success";
  }
  if (
    [
      "changes_requested",
      "review_rejected",
      "rejected",
      "verification_failed",
    ].includes(normalized)
  ) {
    return "rejected";
  }
  if (
    [
      "blocked",
      "external_blocker",
      "needs_human",
      "human_input_required",
    ].includes(normalized)
  ) {
    return "blocked";
  }
  if (
    [
      "failed",
      "tool_failure",
      "context_gap",
      "error",
      "route_back",
      "retry",
    ].includes(normalized)
  ) {
    return "failed";
  }
  return "other";
}

function normalizePolicy(policy: LoopPolicyConfig): LoopPolicyConfig {
  return {
    kind: policy.kind,
    maxAttemptsTotal: policy.maxAttemptsTotal,
    maxReviewRouteBacks: policy.maxReviewRouteBacks,
    maxNoProgressRounds: policy.maxNoProgressRounds,
    requireStrategyDelta: policy.requireStrategyDelta,
    autoRouteBack: policy.autoRouteBack,
  };
}

function markLoopDone(
  state: LoopDerivationState,
  reason: string,
  timestamp: string,
): void {
  state.phase = "done";
  state.next_actor = "leader";
  state.termination = {
    status: "done",
    reason,
    at: timestamp,
  };
  state.blocked_reason = undefined;
}

function markLoopBlocked(
  state: LoopDerivationState,
  reason: string,
  timestamp: string,
  blockedReason?: string,
): void {
  state.phase = "blocked";
  state.next_actor = "human";
  state.termination = {
    status: "blocked",
    reason,
    at: timestamp,
  };
  state.blocked_reason = blockedReason ?? reason;
}

function normalizePhase(value: unknown): LoopPhase {
  if (
    value === "plan" ||
    value === "execute" ||
    value === "verify" ||
    value === "review" ||
    value === "analyze" ||
    value === "route_back" ||
    value === "done" ||
    value === "blocked"
  ) {
    return value;
  }

  return "analyze";
}

function normalizeActor(value: unknown): LoopActor {
  if (
    value === "leader" ||
    value === "implementer" ||
    value === "reviewer" ||
    value === "human"
  ) {
    return value;
  }

  return "leader";
}

function normalizeProgressDelta(value: unknown): LoopProgressDelta {
  if (value === "none" || value === "partial" || value === "meaningful") {
    return value;
  }
  return "none";
}

function findEquivalentRetryWithoutStrategyDelta(
  loop: LoopStateFile,
): string | null {
  for (let index = 1; index < loop.events.length; index += 1) {
    const previous = loop.events[index - 1];
    const current = loop.events[index];
    if (
      current.phase === "route_back" &&
      current.error_signature &&
      current.error_signature === previous.error_signature &&
      current.progress_delta === "none" &&
      !current.strategy_delta
    ) {
      return `event ${index + 1} repeats ${current.error_signature}`;
    }
  }
  return null;
}

function toFeatureSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "feature";
}
