import os from "node:os";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { z } from "zod";

import {
  normalizePermissionPolicy,
  permissionPolicySchema,
  type PermissionPolicy,
} from "./policy.js";
import { DEFAULT_IGNORED } from "./safety.js";

const agentProviderSchema = z.enum([
  "anthropic",
  "openai",
  "openai-codex",
  "claude-code",
  "copilot-cli",
  "gemini-cli",
  "gemini-code-assist",
]);
const agentEffortSchema = z.enum(["auto", "low", "high"]);
const taskTypeSchema = z.enum([
  "architecture",
  "reasoning",
  "refactor",
  "review",
  "tooling",
  "frontend",
  "debug",
  "pr",
  "execution",
  "long_context",
  "general",
]);
const lanePreferenceSchema = z.enum(["auto", "fast", "deep"]);
const localScaffoldClientSchema = z.enum([
  "claude",
  "copilot",
  "opencode",
  "codex",
]);

const providerModelPairSchema = z.object({
  fast: z.string().min(1),
  deep: z.string().min(1),
});

const providerModelsSchema = z.object({
  anthropic: providerModelPairSchema.default({
    fast: "claude-3-5-haiku-latest",
    deep: "claude-3-7-sonnet-latest",
  }),
  openai: providerModelPairSchema.default({
    fast: "gpt-4.1",
    deep: "gpt-4.1",
  }),
  "openai-codex": providerModelPairSchema.default({
    fast: "gpt-5.5-codex",
    deep: "gpt-5.5",
  }),
  "claude-code": providerModelPairSchema.default({
    fast: "claude-haiku-4.5",
    deep: "claude-sonnet-4.6",
  }),
  "copilot-cli": providerModelPairSchema.default({
    fast: "gpt-4.1",
    deep: "claude-3-7-sonnet-latest",
  }),
  "gemini-cli": providerModelPairSchema.default({
    fast: "gemini-3-flash",
    deep: "gemini-3-pro",
  }),
  "gemini-code-assist": providerModelPairSchema.default({
    fast: "gemini-3-flash",
    deep: "gemini-3-pro",
  }),
});

const taskRoutingSchema = z.object({
  architecture: lanePreferenceSchema.default("deep"),
  reasoning: lanePreferenceSchema.default("deep"),
  refactor: lanePreferenceSchema.default("deep"),
  review: lanePreferenceSchema.default("deep"),
  tooling: lanePreferenceSchema.default("fast"),
  frontend: lanePreferenceSchema.default("deep"),
  debug: lanePreferenceSchema.default("deep"),
  pr: lanePreferenceSchema.default("deep"),
  execution: lanePreferenceSchema.default("auto"),
  long_context: lanePreferenceSchema.default("deep"),
  general: lanePreferenceSchema.default("auto"),
});

const agentRoutingSchema = z.object({
  defaultProvider: agentProviderSchema.default("anthropic"),
  effort: agentEffortSchema.default("auto"),
  complexityThreshold: z.number().int().min(0).max(20).default(5),
  autoProviderRouting: z.boolean().default(true),
  showRouting: z.boolean().default(true),
  costStrategy: z
    .enum(["balanced", "cost_first", "quality_first"])
    .default("quality_first"),
  models: providerModelsSchema.default({
    anthropic: {
      fast: "claude-3-5-haiku-latest",
      deep: "claude-3-7-sonnet-latest",
    },
    openai: {
      fast: "gpt-4.1",
      deep: "gpt-4.1",
    },
    "openai-codex": {
      fast: "gpt-5.5-codex",
      deep: "gpt-5.5",
    },
    "claude-code": {
      fast: "claude-haiku-4.5",
      deep: "claude-sonnet-4.6",
    },
    "copilot-cli": {
      fast: "gpt-4.1",
      deep: "claude-3-7-sonnet-latest",
    },
    "gemini-cli": {
      fast: "gemini-3-flash",
      deep: "gemini-3-pro",
    },
    "gemini-code-assist": {
      fast: "gemini-3-flash",
      deep: "gemini-3-pro",
    },
  }),
  taskRouting: taskRoutingSchema.default({
    architecture: "deep",
    reasoning: "deep",
    refactor: "deep",
    review: "deep",
    tooling: "fast",
    frontend: "deep",
    debug: "deep",
    pr: "deep",
    execution: "auto",
    long_context: "deep",
    general: "auto",
  }),
});

const scaffoldConfigSchema = z.object({
  localClients: z.array(localScaffoldClientSchema).default([
    "claude",
    "copilot",
    "opencode",
    "codex",
  ]),
});

export const DEFAULT_LOOP_POLICY = {
  kind: "plan_execute_verify",
  maxAttemptsTotal: 3,
  maxReviewRouteBacks: 2,
  maxNoProgressRounds: 2,
  requireStrategyDelta: true,
  autoRouteBack: true,
} as const;

const loopPolicySchema = z.object({
  kind: z.enum(["plan_execute_verify"]).default("plan_execute_verify"),
  maxAttemptsTotal: z.number().int().min(1).max(20).default(3),
  maxReviewRouteBacks: z.number().int().min(0).max(20).default(2),
  maxNoProgressRounds: z.number().int().min(1).max(20).default(2),
  requireStrategyDelta: z.boolean().default(true),
  autoRouteBack: z.boolean().default(true),
});

const harnessConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  repoPath: z.string().default("."),
  allowedCommands: z.array(z.string()).default([]),
  ignored: z.array(z.string()).default(DEFAULT_IGNORED),
  permissionPolicy: permissionPolicySchema.default({
    mode: "always_allow",
    allowedTools: [],
    allowedRisk: [],
  }),
  agentRouting: agentRoutingSchema.default({
    defaultProvider: "anthropic",
    effort: "auto",
    complexityThreshold: 5,
    autoProviderRouting: true,
    showRouting: true,
    costStrategy: "quality_first",
    models: {
      anthropic: {
        fast: "claude-3-5-haiku-latest",
        deep: "claude-3-7-sonnet-latest",
      },
      openai: {
        fast: "gpt-4.1",
        deep: "gpt-4.1",
      },
      "openai-codex": {
        fast: "gpt-5.5-codex",
        deep: "gpt-5.5",
      },
      "claude-code": {
        fast: "claude-haiku-4.5",
        deep: "claude-sonnet-4.6",
      },
      "copilot-cli": {
        fast: "gpt-4.1",
        deep: "claude-3-7-sonnet-latest",
      },
      "gemini-cli": {
        fast: "gemini-3-flash",
        deep: "gemini-3-pro",
      },
      "gemini-code-assist": {
        fast: "gemini-3-flash",
        deep: "gemini-3-pro",
      },
    },
    taskRouting: {
      architecture: "deep",
      reasoning: "deep",
      refactor: "deep",
      review: "deep",
      tooling: "fast",
      frontend: "deep",
      debug: "deep",
      pr: "deep",
      execution: "auto",
      long_context: "deep",
      general: "auto",
    },
  }),
  loopPolicy: loopPolicySchema.optional(),
  scaffold: scaffoldConfigSchema.optional(),
});

const GLOBAL_CONFIG_FILENAME = "harness.config.json";
const GLOBAL_CONFIG_DIRNAME = "arufheim-harness";

export type AgentRoutingConfig = z.infer<typeof agentRoutingSchema>;
export type HarnessConfigDocument = z.infer<typeof harnessConfigSchema>;
export type LocalScaffoldClient = z.infer<typeof localScaffoldClientSchema>;
export type LoopPolicyConfig = z.infer<typeof loopPolicySchema>;
export type HarnessClientId =
  | "vscode"
  | "claude-desktop"
  | "claude-code"
  | "codex"
  | "opencode";
export type ConfigScope = "repo" | "external";

export interface ResolvedharnessConfig {
  configPath: string;
  repoPath: string;
  configScope: ConfigScope;
  allowedCommands: string[];
  ignored: string[];
  permissionPolicy: PermissionPolicy;
  agentRouting: AgentRoutingConfig;
  loopPolicy: LoopPolicyConfig;
  clientId: HarnessClientId | null;
  logFilePath?: string;
}

interface LoadConfigOptions {
  argv?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<ResolvedharnessConfig> {
  const cwd = options.cwd ?? process.cwd();
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const clientId = readClientIdFromArgs(argv);

  // --repo-path / harness_REPO_PATH: apunta harness a cualquier repo sin necesitar
  // un harness.config.json en ese repo. Si existe uno, se usa para allowedCommands
  // e ignored, pero repoPath siempre viene del argumento.
  const explicitRepoPath = readRepoPathFromArgs(argv) ?? env.harness_REPO_PATH;
  if (explicitRepoPath) {
    const repoPath = path.resolve(cwd, explicitRepoPath);
    const configPath = path.resolve(repoPath, "harness.config.json");
    let parsed: z.infer<typeof harnessConfigSchema>;
    try {
      const raw = await readFile(configPath, "utf8");
      parsed = harnessConfigSchema.parse(JSON.parse(raw));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        parsed = harnessConfigSchema.parse({});
      } else {
        throw err;
      }
    }
    return {
      configPath,
      repoPath,
      configScope: inferConfigScope(repoPath, configPath),
      allowedCommands: normalizeCommands(parsed.allowedCommands),
      ignored: normalizeIgnored(parsed.ignored),
      permissionPolicy: normalizePermissionPolicy(parsed.permissionPolicy),
      agentRouting: normalizeAgentRouting(parsed.agentRouting),
      loopPolicy: normalizeLoopPolicy(parsed.loopPolicy),
      clientId,
      logFilePath: undefined,
    };
  }

  const explicitPath = readConfigPathFromArgs(argv) ?? env.harness_CONFIG;
  const globalConfigPath = getGlobalConfigPath(env);
  const configPath = explicitPath
    ? path.resolve(cwd, explicitPath)
    : await resolveDefaultConfigPath(cwd, globalConfigPath);

  let parsed: z.infer<typeof harnessConfigSchema>;
  try {
    const raw = await readFile(configPath, "utf8");
    parsed = harnessConfigSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if (!explicitPath && (err as NodeJS.ErrnoException).code === "ENOENT") {
      parsed = harnessConfigSchema.parse({});
    } else {
      throw err;
    }
  }

  const usingGlobalDefaultsPath =
    !explicitPath && path.resolve(configPath) === path.resolve(globalConfigPath);
  if (usingGlobalDefaultsPath && parsed.repoPath === ".") {
    throw new Error(
      "Global config fallback requires an explicit repo binding. Pass --repo-path <repo> or use a repo-local harness.config.json.",
    );
  }

  const repoPath = path.resolve(path.dirname(configPath), parsed.repoPath);

  return {
    configPath,
    repoPath,
    configScope: inferConfigScope(repoPath, configPath),
    allowedCommands: normalizeCommands(parsed.allowedCommands),
    ignored: normalizeIgnored(parsed.ignored),
    permissionPolicy: normalizePermissionPolicy(parsed.permissionPolicy),
    agentRouting: normalizeAgentRouting(parsed.agentRouting),
    loopPolicy: normalizeLoopPolicy(parsed.loopPolicy),
    clientId,
    logFilePath: undefined,
  };
}

export function createDefaultHarnessConfig(): HarnessConfigDocument {
  return harnessConfigSchema.parse({});
}

export function parseHarnessConfigDocument(
  input: unknown,
): HarnessConfigDocument {
  return harnessConfigSchema.parse(input);
}

export function getGlobalConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const root = env.XDG_CONFIG_HOME
    ? path.resolve(env.XDG_CONFIG_HOME)
    : path.join(os.homedir(), ".config");

  return path.join(root, GLOBAL_CONFIG_DIRNAME, GLOBAL_CONFIG_FILENAME);
}

export async function ensureConfigFile(configPath: string): Promise<void> {
  if (await pathExists(configPath)) {
    return;
  }

  await writeFile(
    configPath,
    JSON.stringify(createDefaultHarnessConfig(), null, 2) + "\n",
    "utf8",
  );
}

export function resolveConfigPath(
  argv: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  const fromArg = readConfigPathFromArgs(argv);
  const candidate =
    fromArg ?? env.harness_CONFIG ?? path.resolve(cwd, "harness.config.json");
  return path.resolve(cwd, candidate);
}

async function resolveDefaultConfigPath(
  cwd: string,
  globalConfigPath: string,
): Promise<string> {
  const repoConfigPath = path.resolve(cwd, "harness.config.json");
  if (await pathExists(repoConfigPath)) {
    return repoConfigPath;
  }
  if (await pathExists(globalConfigPath)) {
    return globalConfigPath;
  }
  return repoConfigPath;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeCommands(commands: string[]): string[] {
  return Array.from(
    new Set(commands.map((command) => command.trim()).filter(Boolean)),
  );
}

function normalizeIgnored(ignored: string[]): string[] {
  return Array.from(new Set([...DEFAULT_IGNORED, ...ignored]));
}

function normalizeAgentRouting(
  routing: AgentRoutingConfig,
): AgentRoutingConfig {
  return {
    defaultProvider: routing.defaultProvider,
    effort: routing.effort,
    complexityThreshold: routing.complexityThreshold,
    autoProviderRouting: routing.autoProviderRouting,
    showRouting: routing.showRouting,
    costStrategy: routing.costStrategy,
    models: {
      anthropic: {
        fast: routing.models.anthropic.fast.trim(),
        deep: routing.models.anthropic.deep.trim(),
      },
      openai: {
        fast: routing.models.openai.fast.trim(),
        deep: routing.models.openai.deep.trim(),
      },
      "openai-codex": {
        fast: routing.models["openai-codex"].fast.trim(),
        deep: routing.models["openai-codex"].deep.trim(),
      },
      "claude-code": {
        fast: routing.models["claude-code"].fast.trim(),
        deep: routing.models["claude-code"].deep.trim(),
      },
      "copilot-cli": {
        fast: routing.models["copilot-cli"].fast.trim(),
        deep: routing.models["copilot-cli"].deep.trim(),
      },
      "gemini-cli": {
        fast: routing.models["gemini-cli"].fast.trim(),
        deep: routing.models["gemini-cli"].deep.trim(),
      },
      "gemini-code-assist": {
        fast: routing.models["gemini-code-assist"].fast.trim(),
        deep: routing.models["gemini-code-assist"].deep.trim(),
      },
    },
    taskRouting: {
      architecture: routing.taskRouting.architecture,
      reasoning: routing.taskRouting.reasoning,
      refactor: routing.taskRouting.refactor,
      review: routing.taskRouting.review,
      tooling: routing.taskRouting.tooling,
      frontend: routing.taskRouting.frontend,
      debug: routing.taskRouting.debug,
      pr: routing.taskRouting.pr,
      execution: routing.taskRouting.execution,
      long_context: routing.taskRouting.long_context,
      general: routing.taskRouting.general,
    },
  };
}

function normalizeLoopPolicy(
  policy: LoopPolicyConfig | undefined,
): LoopPolicyConfig {
  const source = policy ?? DEFAULT_LOOP_POLICY;
  return {
    kind: source.kind,
    maxAttemptsTotal: source.maxAttemptsTotal,
    maxReviewRouteBacks: source.maxReviewRouteBacks,
    maxNoProgressRounds: source.maxNoProgressRounds,
    requireStrategyDelta: source.requireStrategyDelta,
    autoRouteBack: source.autoRouteBack,
  };
}

function readConfigPathFromArgs(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--config") {
      return argv[index + 1];
    }
    if (value.startsWith("--config=")) {
      return value.slice("--config=".length);
    }
  }

  return undefined;
}

function readRepoPathFromArgs(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--repo-path") {
      return argv[index + 1];
    }
    if (value.startsWith("--repo-path=")) {
      return value.slice("--repo-path=".length);
    }
  }

  return undefined;
}

export function inferConfigScope(
  repoPath: string,
  configPath: string,
): ConfigScope {
  const normalizedRepoPath = repoPath.endsWith("/") ? repoPath : `${repoPath}/`;
  return configPath === repoPath || configPath.startsWith(normalizedRepoPath)
    ? "repo"
    : "external";
}

function readClientIdFromArgs(argv: string[]): HarnessClientId | null {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--client") {
      return parseClientId(argv[index + 1]);
    }
    if (value.startsWith("--client=")) {
      return parseClientId(value.slice("--client=".length));
    }
  }

  return null;
}

function parseClientId(value: string | undefined): HarnessClientId {
  if (
    value === "vscode" ||
    value === "claude-desktop" ||
    value === "claude-code" ||
    value === "codex" ||
    value === "opencode"
  ) {
    return value;
  }

  throw new Error(
    `Unsupported harness client '${value ?? ""}'. Use vscode, claude-desktop, claude-code, codex or opencode.`,
  );
}
