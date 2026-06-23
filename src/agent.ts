import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import type { ResolvedharnessConfig } from "./config.js";
import { refreshActiveHeadSummary } from "./headroom.js";
import { readLoopStatus, type LoopSummary } from "./loop.js";
import { resolveExistingWithinRepo } from "./safety.js";
import {
  listPendingInboxEntries,
  parseFeatureListText,
  resolveWorkflowPaths,
} from "./workflow.js";

const execFileAsync = promisify(execFile);

type AgentProvider =
  | "anthropic"
  | "openai"
  | "openai-codex"
  | "claude-code"
  | "copilot-cli"
  | "gemini-cli"
  | "gemini-code-assist";
type AgentEffort = "auto" | "low" | "high";
type AgentLane = "fast" | "deep";
type TaskType =
  | "architecture"
  | "reasoning"
  | "refactor"
  | "review"
  | "tooling"
  | "frontend"
  | "debug"
  | "pr"
  | "execution"
  | "long_context"
  | "general";

interface AgentCliOptions {
  provider: AgentProvider;
  prompt?: string;
  promptFile?: string;
  system?: string;
  systemFile?: string;
  model?: string;
  fastModel?: string;
  deepModel?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  effort: AgentEffort;
  costStrategy: "balanced" | "cost_first" | "quality_first";
  complexityThreshold: number;
  taskRouting: Record<TaskType, "auto" | "fast" | "deep">;
  showRouting: boolean;
  timeoutMs: number;
  withWorkflowContext: boolean;
  copilotCommand: string;
  geminiCommand: string;
}

interface AgentRunResult {
  provider: AgentProvider;
  model: string;
  text: string;
  usage?: Record<string, unknown>;
}

interface WorkflowBrief {
  activeFeature: string;
  pendingCount: number;
  specReadyCount: number;
  blockedCount: number;
  inboxCount: number;
  nextStep: string;
  loopSummary: LoopSummary | null;
  loopLastError: string | null;
  loopLastStrategy: string | null;
  loopNoProgressStreak: number;
  headSummary: string | null;
  headPath: string | null;
}

interface RoutingDecision {
  provider: AgentProvider;
  taskType: TaskType;
  lane: AgentLane;
  model: string;
  reason: string;
  score: number;
}

export async function runAgent(
  argv: string[],
  config: ResolvedharnessConfig,
): Promise<void> {
  const options = parseAgentOptions(argv, config);
  const userPrompt = await resolvePrompt(options, config.repoPath);
  const systemPrompt = await resolveSystemPrompt(options, config.repoPath);
  const workflowBrief = options.withWorkflowContext
    ? await readWorkflowBrief(config.repoPath)
    : null;

  const combinedSystem = [
    "You are running in arufheim-harness agent mode.",
    "You act as leader and must choose response depth based on task complexity and user options.",
    "Respect the repository workflow and keep outputs actionable.",
    workflowBrief ? formatWorkflowBrief(workflowBrief) : "",
    systemPrompt ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const routing = decideRouting(options, userPrompt, workflowBrief);

  const result = await dispatchProvider(options, {
    userPrompt,
    systemPrompt: combinedSystem,
    model: routing.model,
  });

  process.stdout.write(`${result.text.trim()}\n`);
  const summary = [
    "agent mode finished",
    `provider: ${routing.provider}`,
    `model: ${result.model}`,
  ];
  if (options.showRouting) {
    summary.push(
      `task_type: ${routing.taskType}`,
      `lane: ${routing.lane}`,
      `complexity_score: ${routing.score}`,
      `routing_reason: ${routing.reason}`,
    );
  }
  process.stderr.write(summary.join("\n") + "\n");
}

function parseAgentOptions(
  argv: string[],
  config: ResolvedharnessConfig,
): AgentCliOptions {
  const defaults = config.agentRouting;
  const providerRaw =
    readArg(argv, "--provider") ??
    (process.env.HARNESS_AGENT_PROVIDER as AgentProvider | undefined) ??
    defaults.defaultProvider;
  const provider = normalizeProvider(providerRaw);
  const providerDefaults = defaults.models[provider];

  const timeoutMsRaw =
    readArg(argv, "--timeout-ms") ?? process.env.HARNESS_AGENT_TIMEOUT_MS;

  return {
    provider,
    prompt: readArg(argv, "--prompt"),
    promptFile: readArg(argv, "--prompt-file"),
    system: readArg(argv, "--system"),
    systemFile: readArg(argv, "--system-file"),
    model: readArg(argv, "--model") ?? process.env.HARNESS_AGENT_MODEL,
    fastModel:
      readArg(argv, "--fast-model") ??
      process.env.HARNESS_AGENT_FAST_MODEL ??
      providerDefaults.fast,
    deepModel:
      readArg(argv, "--deep-model") ??
      process.env.HARNESS_AGENT_DEEP_MODEL ??
      providerDefaults.deep,
    apiKey: readArg(argv, "--api-key"),
    baseUrl: readArg(argv, "--base-url"),
    maxTokens: parseOptionalInt(
      readArg(argv, "--max-tokens") ?? process.env.HARNESS_AGENT_MAX_TOKENS,
    ),
    temperature: parseOptionalNumber(
      readArg(argv, "--temperature") ?? process.env.HARNESS_AGENT_TEMPERATURE,
    ),
    effort: normalizeEffort(
      readArg(argv, "--effort") ??
        process.env.HARNESS_AGENT_EFFORT ??
        defaults.effort,
    ),
    complexityThreshold:
      parseOptionalInt(
        readArg(argv, "--complexity-threshold") ??
          process.env.HARNESS_AGENT_COMPLEXITY_THRESHOLD,
      ) ?? defaults.complexityThreshold,
    taskRouting: defaults.taskRouting,
    showRouting: resolveBooleanSetting(
      readArg(argv, "--show-routing"),
      process.env.HARNESS_AGENT_SHOW_ROUTING,
      defaults.showRouting,
    ),
    costStrategy: defaults.costStrategy,
    timeoutMs: parseOptionalInt(timeoutMsRaw) ?? 120_000,
    withWorkflowContext:
      readArg(argv, "--with-workflow-context") !== "false" &&
      process.env.HARNESS_AGENT_WITH_WORKFLOW_CONTEXT !== "false",
    copilotCommand:
      readArg(argv, "--copilot-command") ??
      process.env.HARNESS_COPILOT_COMMAND ??
      "gh",
    geminiCommand:
      readArg(argv, "--gemini-command") ??
      process.env.HARNESS_GEMINI_COMMAND ??
      "gemini",
  };
}

function resolveBooleanSetting(
  cliValue: string | undefined,
  envValue: string | undefined,
  fallback: boolean,
): boolean {
  if (cliValue === "true") return true;
  if (cliValue === "false") return false;
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return fallback;
}

function normalizeProvider(value: string): AgentProvider {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "anthropic" ||
    normalized === "openai" ||
    normalized === "openai-codex" ||
    normalized === "claude-code" ||
    normalized === "copilot-cli" ||
    normalized === "gemini-cli" ||
    normalized === "gemini-code-assist"
  ) {
    return normalized;
  }

  throw new Error(
    `Unsupported provider '${value}'. Use anthropic, openai, openai-codex, claude-code, copilot-cli, gemini-cli, or gemini-code-assist.`,
  );
}

function normalizeEffort(value: string): AgentEffort {
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto" || normalized === "low" || normalized === "high") {
    return normalized;
  }

  throw new Error(`Unsupported effort '${value}'. Use auto, low, or high.`);
}

function readArg(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === name) {
      return argv[index + 1];
    }
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1);
    }
  }

  return undefined;
}

function parseOptionalInt(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected integer value, got '${value}'.`);
  }
  return parsed;
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected numeric value, got '${value}'.`);
  }
  return parsed;
}

async function resolvePrompt(
  options: AgentCliOptions,
  repoPath: string,
): Promise<string> {
  if (options.prompt && options.promptFile) {
    throw new Error("Use either --prompt or --prompt-file, not both.");
  }

  if (options.prompt) {
    return options.prompt;
  }

  if (options.promptFile) {
    const absolutePath = await resolveExistingWithinRepo(
      repoPath,
      options.promptFile,
    );
    return (await readFile(absolutePath, "utf8")).trim();
  }

  throw new Error("Missing prompt. Use --prompt or --prompt-file.");
}

async function resolveSystemPrompt(
  options: AgentCliOptions,
  repoPath: string,
): Promise<string | undefined> {
  if (options.system && options.systemFile) {
    throw new Error("Use either --system or --system-file, not both.");
  }

  if (options.system) {
    return options.system;
  }

  if (options.systemFile) {
    const absolutePath = await resolveExistingWithinRepo(
      repoPath,
      options.systemFile,
    );
    return (await readFile(absolutePath, "utf8")).trim();
  }

  return undefined;
}

async function readWorkflowBrief(
  repoPath: string,
): Promise<WorkflowBrief | null> {
  try {
    const workflowPaths = await resolveWorkflowPaths(repoPath);
    const [featureListRaw, currentMdRaw, inboxEntries] = await Promise.all([
      readFile(
        path.join(repoPath, workflowPaths.featureListPath),
        "utf8",
      ).catch(() => ""),
      readFile(path.join(repoPath, workflowPaths.currentPath), "utf8").catch(
        () => "",
      ),
      listPendingInboxEntries(repoPath),
    ]);

    if (!featureListRaw) {
      return null;
    }

    const features = parseFeatureListText(featureListRaw).features;
    const activeFeature =
      features.find((feature) => feature.status === "in_progress") ?? null;
    const pendingCount = features.filter(
      (feature) => feature.status === "pending",
    ).length;
    const specReadyCount = features.filter(
      (feature) => feature.status === "spec_ready",
    ).length;
    const blockedCount = features.filter(
      (feature) => feature.status === "blocked",
    ).length;

    const match = currentMdRaw.match(
      /##\s+Próximo paso\s*\n([\s\S]*?)(?=\n##|$)/,
    );
    const nextStep = match?.[1]?.trim() || "(sin próximo paso definido)";
    const loopStatus = activeFeature
      ? await readLoopStatus(repoPath, activeFeature.id)
      : { loop: undefined, loop_summary: null };
    const headSummary = activeFeature
      ? await refreshActiveHeadSummary(repoPath)
      : null;

    return {
      activeFeature: activeFeature
        ? `${activeFeature.id}:${activeFeature.name}`
        : "none",
      pendingCount,
      specReadyCount,
      blockedCount,
      inboxCount: inboxEntries.length,
      nextStep,
      loopSummary: loopStatus.loop_summary ?? null,
      loopLastError: loopStatus.loop?.last_error_signature ?? null,
      loopLastStrategy: loopStatus.loop?.last_strategy_delta ?? null,
      loopNoProgressStreak: loopStatus.loop?.no_progress_streak ?? 0,
      headSummary: headSummary?.content.trim() ?? null,
      headPath: headSummary?.path ?? null,
    };
  } catch {
    return null;
  }
}

function formatWorkflowBrief(brief: WorkflowBrief): string {
  return [
    "Workflow brief (harness):",
    `- active: ${brief.activeFeature}`,
    `- pending: ${brief.pendingCount}`,
    `- spec_ready: ${brief.specReadyCount}`,
    `- blocked: ${brief.blockedCount}`,
    `- inbox: ${brief.inboxCount}`,
    `- next_step: ${brief.nextStep}`,
    brief.loopSummary
      ? `- loop: phase=${brief.loopSummary.phase} attempt=${brief.loopSummary.attempt_index} review=${brief.loopSummary.review_round} next=${brief.loopSummary.next_actor}`
      : "- loop: none",
    brief.loopSummary
      ? `- loop_budget: attempts=${brief.loopSummary.budget_remaining.attempts} review_route_backs=${brief.loopSummary.budget_remaining.review_route_backs} no_progress=${brief.loopSummary.budget_remaining.no_progress_rounds}`
      : "",
    brief.loopLastError ? `- last_error: ${brief.loopLastError}` : "",
    brief.loopLastStrategy ? `- last_strategy_delta: ${brief.loopLastStrategy}` : "",
    brief.headPath ? `- head_path: ${brief.headPath}` : "",
    brief.headSummary ? `\nHead summary:\n${brief.headSummary}` : "",
  ].join("\n");
}

function decideRouting(
  options: AgentCliOptions,
  prompt: string,
  workflowBrief: WorkflowBrief | null,
): RoutingDecision {
  const taskType = classifyTaskType(prompt);
  const suggestedLane = options.taskRouting[taskType];
  const forcedLane = readLaneHint(prompt);
  const score = computeComplexityScore(prompt, workflowBrief);

  if (options.model) {
    return {
      provider: options.provider,
      taskType,
      lane: forcedLane ?? (options.effort === "high" ? "deep" : "fast"),
      model: options.model,
      reason: "explicit --model override",
      score,
    };
  }

  if (forcedLane) {
    return {
      provider: options.provider,
      taskType,
      lane: forcedLane,
      model: laneModel(options.provider, options, forcedLane),
      reason: `prompt hint ${forcedLane}`,
      score,
    };
  }

  if (options.effort === "low") {
    return {
      provider: options.provider,
      taskType,
      lane: "fast",
      model: laneModel(options.provider, options, "fast"),
      reason: "user selected --effort low",
      score,
    };
  }

  if (options.effort === "high") {
    return {
      provider: options.provider,
      taskType,
      lane: "deep",
      model: laneModel(options.provider, options, "deep"),
      reason: "user selected --effort high",
      score,
    };
  }

  const laneByComplexity: AgentLane =
    score >= options.complexityThreshold ? "deep" : "fast";
  const lane: AgentLane =
    suggestedLane === "auto" ? laneByComplexity : suggestedLane;

  let finalLane = lane;
  if (options.costStrategy === "cost_first" && lane === "deep" && score < 8) {
    finalLane = "fast";
  }
  if (
    options.costStrategy === "quality_first" &&
    lane === "fast" &&
    score >= 4
  ) {
    finalLane = "deep";
  }

  return {
    provider: options.provider,
    taskType,
    lane: finalLane,
    model: laneModel(options.provider, options, finalLane),
    reason: `auto routing task=${taskType}, task_lane=${suggestedLane}, threshold=${options.complexityThreshold}, strategy=${options.costStrategy}`,
    score,
  };
}

function classifyTaskType(prompt: string): TaskType {
  const text = prompt.toLowerCase();

  if (
    /(architect|arquitect|boundary|contrato|contract|system design|domain model)/.test(
      text,
    )
  )
    return "architecture";
  if (/(reason|razon|tradeoff|decision|anali[sz]e|evaluate)/.test(text))
    return "reasoning";
  if (/(refactor|cleanup|modulari[sz]e|restructure)/.test(text))
    return "refactor";
  if (/(review|code review|audit|checklist|regression)/.test(text))
    return "review";
  if (/(tool|cli|script|automation|pipeline|devx)/.test(text)) return "tooling";
  if (/(frontend|ui|ux|react|css|layout|component)/.test(text))
    return "frontend";
  if (/(debug|bug|fix|root cause|stack trace|error)/.test(text)) return "debug";
  if (/(pull request|\bpr\b|merge|branch)/.test(text)) return "pr";
  if (/(run|execute|terminal|shell|command|test suite)/.test(text))
    return "execution";
  if (
    /(long context|large repo|monorepo|many files|full codebase|global analysis)/.test(
      text,
    )
  )
    return "long_context";
  return "general";
}

function readLaneHint(prompt: string): AgentLane | null {
  if (/(@mode:deep|#deep\b)/i.test(prompt)) {
    return "deep";
  }
  if (/(@mode:fast|#fast\b)/i.test(prompt)) {
    return "fast";
  }
  return null;
}

function computeComplexityScore(
  prompt: string,
  workflowBrief: WorkflowBrief | null,
): number {
  let score = 0;
  const trimmed = prompt.trim();

  if (trimmed.length > 300) score += 1;
  if (trimmed.length > 900) score += 1;
  if (trimmed.split(/\s+/).length > 120) score += 1;

  if (
    /(arquitect|architecture|diseñ|design|refactor|migraci|migration|seguridad|security|boundary|contrato|contract|debug|root cause|multiarchivo|multi-file|sdd|estrategia|strategy)/i.test(
      trimmed,
    )
  ) {
    score += 2;
  }

  if (workflowBrief) {
    if (workflowBrief.blockedCount > 0) score += 1;
    if (workflowBrief.specReadyCount > 0) score += 1;
    if (workflowBrief.pendingCount > 6) score += 1;
    if (
      workflowBrief.loopSummary &&
      (workflowBrief.loopSummary.phase === "analyze" ||
        workflowBrief.loopSummary.phase === "review")
    ) {
      score += 1;
    }
    if (
      workflowBrief.loopSummary &&
      workflowBrief.loopSummary.attempt_index >= 2
    ) {
      score += 1;
    }
    if (workflowBrief.loopNoProgressStreak > 0) {
      score += 1;
    }
  }

  return score;
}

function laneModel(
  provider: AgentProvider,
  options: AgentCliOptions,
  lane: AgentLane,
): string {
  if (lane === "fast" && options.fastModel) {
    return options.fastModel;
  }
  if (lane === "deep" && options.deepModel) {
    return options.deepModel;
  }

  if (provider === "anthropic") {
    return lane === "fast"
      ? "claude-3-5-haiku-latest"
      : "claude-3-7-sonnet-latest";
  }

  if (provider === "claude-code") {
    return lane === "fast" ? "claude-haiku-4.5" : "claude-sonnet-4.6";
  }

  if (provider === "openai") {
    return "gpt-4.1";
  }

  if (provider === "openai-codex") {
    return lane === "fast" ? "gpt-5.5-codex" : "gpt-5.5";
  }

  if (provider === "gemini-cli" || provider === "gemini-code-assist") {
    return lane === "fast" ? "gemini-3-flash" : "gemini-3-pro";
  }

  return lane === "fast" ? "gpt-4.1" : "claude-3-7-sonnet-latest";
}

async function dispatchProvider(
  options: AgentCliOptions,
  payload: { userPrompt: string; systemPrompt: string; model: string },
): Promise<AgentRunResult> {
  if (options.provider === "anthropic" || options.provider === "claude-code") {
    return runAnthropic(options, payload);
  }
  if (options.provider === "openai" || options.provider === "openai-codex") {
    return runOpenAI(options, payload);
  }
  if (
    options.provider === "gemini-cli" ||
    options.provider === "gemini-code-assist"
  ) {
    return runGeminiCli(options, payload);
  }
  return runCopilotCli(options, payload);
}

async function runAnthropic(
  options: AgentCliOptions,
  payload: { userPrompt: string; systemPrompt: string; model: string },
): Promise<AgentRunResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY (or --api-key).");
  }

  const model = payload.model;
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com";
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1024,
      ...(typeof options.temperature === "number"
        ? { temperature: options.temperature }
        : {}),
      system: payload.systemPrompt,
      messages: [{ role: "user", content: payload.userPrompt }],
    }),
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  const raw = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(raw.error?.message ?? `Anthropic error ${response.status}`);
  }

  const text = (raw.content ?? [])
    .filter((chunk) => chunk.type === "text" && typeof chunk.text === "string")
    .map((chunk) => chunk.text)
    .join("\n")
    .trim();

  return {
    provider: "anthropic",
    model,
    text: text || "(sin contenido de respuesta)",
    usage: raw.usage,
  };
}

async function runOpenAI(
  options: AgentCliOptions,
  payload: { userPrompt: string; systemPrompt: string; model: string },
): Promise<AgentRunResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (or --api-key).");
  }

  const model = payload.model;
  const baseUrl = options.baseUrl ?? "https://api.openai.com";
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: payload.systemPrompt },
        { role: "user", content: payload.userPrompt },
      ],
      ...(typeof options.temperature === "number"
        ? { temperature: options.temperature }
        : {}),
      ...(typeof options.maxTokens === "number"
        ? { max_tokens: options.maxTokens }
        : {}),
    }),
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(raw.error?.message ?? `OpenAI error ${response.status}`);
  }

  const text = raw.choices?.[0]?.message?.content?.trim() ?? "";

  return {
    provider: "openai",
    model,
    text: text || "(sin contenido de respuesta)",
    usage: raw.usage,
  };
}

async function runCopilotCli(
  options: AgentCliOptions,
  payload: { userPrompt: string; systemPrompt: string; model: string },
): Promise<AgentRunResult> {
  const model = payload.model;
  const prompt = `${payload.systemPrompt}\n\n${payload.userPrompt}`;

  if (options.copilotCommand === "gh") {
    const { stdout } = await execFileAsync(
      "gh",
      ["copilot", "suggest", "-t", "general", prompt],
      {
        timeout: options.timeoutMs,
        maxBuffer: 1024 * 1024,
      },
    );

    return {
      provider: "copilot-cli",
      model,
      text: stdout.trim() || "(sin contenido de respuesta)",
    };
  }

  const { stdout } = await execFileAsync(options.copilotCommand, [prompt], {
    timeout: options.timeoutMs,
    maxBuffer: 1024 * 1024,
  });

  return {
    provider: "copilot-cli",
    model,
    text: stdout.trim() || "(sin contenido de respuesta)",
  };
}

async function runGeminiCli(
  options: AgentCliOptions,
  payload: { userPrompt: string; systemPrompt: string; model: string },
): Promise<AgentRunResult> {
  const model = payload.model;
  const prompt = `${payload.systemPrompt}\n\n${payload.userPrompt}`;

  const { stdout } = await execFileAsync(
    options.geminiCommand,
    ["-m", model, "-p", prompt],
    {
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024,
    },
  );

  return {
    provider:
      options.provider === "gemini-code-assist"
        ? "gemini-code-assist"
        : "gemini-cli",
    model,
    text: stdout.trim() || "(sin contenido de respuesta)",
  };
}
