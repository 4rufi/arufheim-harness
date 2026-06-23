import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_LOOP_POLICY,
  parseHarnessConfigDocument,
  type ConfigScope,
  type HarnessClientId,
  type ScaffoldLayout,
  type LocalScaffoldClient,
  type LoopPolicyConfig,
} from "./config.js";
import {
  AGENTS_MANAGED_END_MARKER,
  AGENTS_MANAGED_START_MARKER,
  AGENTS_VERSION_MARKER,
  getClaudeCodeConfigPath,
  getClaudeDesktopConfigPath,
  getCodexConfigPath,
  getVSCodeGlobalMcpPath,
  parseJsonc,
  type GlobalClientId,
  type InitTarget,
} from "./init.js";
import {
  REPO_RUNTIME_LAUNCHER_PATH,
  evaluateManagedGlobalRuntimeStatus,
  getManagedGlobalRuntimeArtifactPath,
  getManagedGlobalRuntimeMetadataPath,
  getManagedGlobalRuntimeShimPath,
  type ManagedRuntimeArtifactKind,
  type ManagedRuntimeSourceKind,
  type ManagedRuntimeStatus,
} from "./runtime.js";
import {
  parseFeatureHistoryText,
  parseFeatureListText,
  resolveWorkflowPaths,
  type WorkflowFeature,
  type WorkflowPaths,
} from "./workflow.js";
import {
  collectLoopDiagnostics,
  readActiveLoopSummary,
  type LoopSummary,
} from "./loop.js";
import { inferScaffoldLayout } from "./scaffold-layout.js";
import { HARNESS_VERSION } from "./version.js";

const HARNESS_CONFIG_VERSION = 1;

export type HealthSeverity = "info" | "warn" | "error";
export type HealthRecordSource = "doctor" | "setup" | "repair" | "status";

export interface RepairAction {
  kind: "repo_update" | "global_clients";
  clients: Array<InitTarget | GlobalClientId>;
}

export interface HealthDiagnostic {
  code: string;
  severity: HealthSeverity;
  blocking: boolean;
  ok: boolean;
  message: string;
  detail?: string;
  detected_at: string;
  fix_available: boolean;
  fix_command?: string;
  fix_hint?: string;
  repair_action?: RepairAction;
}

export interface HealthAlert {
  code: string;
  severity: Exclude<HealthSeverity, "info">;
  blocking: boolean;
  message: string;
  detail?: string;
  detected_at: string;
  fix_available: boolean;
  fix_command?: string;
  fix_hint?: string;
}

type BindingState =
  | "ok"
  | "missing"
  | "portable"
  | "assumed"
  | "verified"
  | "legacy"
  | "ambiguous"
  | "shadowed"
  | "invalid"
  | "absent";

interface BindingClientStatus {
  state: BindingState;
  detail?: string;
}

export interface BindingStatus {
  state:
    | "repo_scoped"
    | "repo_scoped_partial"
    | "global_fallback"
    | "global_assumed"
    | "ambiguous"
    | "missing";
  repo_scoped: {
    vscode: boolean;
    claude: boolean;
    codex: boolean;
    opencode: boolean;
  };
  global: {
    vscode: BindingClientStatus;
    claude_desktop: BindingClientStatus;
    claude_code: BindingClientStatus;
    codex: BindingClientStatus;
  };
}

export type ClientVerificationState =
  | "missing"
  | "configured"
  | "verified"
  | "stale";

export interface ClientVerificationStatus {
  state: ClientVerificationState;
  detail?: string;
  verified_at?: string | null;
  config_scope?: ConfigScope;
  binding_scope?: "repo_scoped" | "global";
}

export interface ClientVerificationSnapshot {
  vscode: ClientVerificationStatus;
  claude_desktop: ClientVerificationStatus;
  claude_code: ClientVerificationStatus;
  codex: ClientVerificationStatus;
  opencode: ClientVerificationStatus;
}

export type ClientReadinessState =
  | "missing"
  | "verified"
  | "configured_needs_activation"
  | "stale_reverification_required"
  | "invalid_manual_fix_required";

export interface ClientReadinessStatus {
  state: ClientReadinessState;
  detail: string;
  next_step?: string;
  fix_command?: string;
  verified_at?: string | null;
  config_scope?: ConfigScope;
  binding_scope?: "repo_scoped" | "global";
}

export interface ClientReadinessSnapshot {
  vscode: ClientReadinessStatus;
  claude_desktop: ClientReadinessStatus;
  claude_code: ClientReadinessStatus;
  codex: ClientReadinessStatus;
  opencode: ClientReadinessStatus;
}

export interface DoctorSummary {
  status: "ok" | "degraded" | "error";
  healthy: boolean;
  total: number;
  passed: number;
  info: number;
  warn: number;
  error: number;
  active_alerts: number;
  blocking: number;
  fixable: number;
}

export interface HarnessHealthSnapshot {
  repo_path: string;
  workflow_layout: "hidden" | "root-legacy";
  scaffold_layout: ScaffoldLayout;
  archived_count: number;
  diagnostics: HealthDiagnostic[];
  alerts: HealthAlert[];
  runtime_status: ManagedRuntimeStatus;
  binding_status: BindingStatus;
  client_verification: ClientVerificationSnapshot;
  client_readiness: ClientReadinessSnapshot;
  doctor_summary: DoctorSummary;
  degraded_mode: boolean;
  last_verified_at: string | null;
  loop_summary: LoopSummary | null;
}

interface StoredHealthSnapshot {
  last_verified_at: string;
  archived_count?: number;
  runtime_status?: ManagedRuntimeStatus;
  binding_status: BindingStatus;
  client_verification: ClientVerificationSnapshot;
  client_readiness?: ClientReadinessSnapshot;
  doctor_summary: DoctorSummary;
  alerts: HealthAlert[];
  workflow_layout: "hidden" | "root-legacy";
  scaffold_layout: ScaffoldLayout;
  verified_by: HealthRecordSource;
  input_signature?: StoredHealthInputSignature;
}

interface StoredHealthInputSignature {
  version: number;
  files: StoredHealthInputFile[];
}

interface StoredHealthInputFile {
  path: string;
  mode: "exists" | "mtime";
  exists: boolean;
  mtime_ms: number | null;
}

interface EvaluateHarnessHealthOptions {
  persist?: boolean;
  verifiedBy?: HealthRecordSource;
}

interface ManagedFileCheck {
  code: string;
  label: string;
  path: string;
  severity: Exclude<HealthSeverity, "info">;
  blocking: boolean;
  repairAction: RepairAction;
}

function formatRuntimeSourceKind(kind: ManagedRuntimeSourceKind): string {
  return kind;
}

function formatRuntimeArtifactKind(kind: ManagedRuntimeArtifactKind): string {
  return kind;
}

export function formatRuntimeSourceBrief(
  runtimeStatus: ManagedRuntimeStatus,
): string {
  return formatRuntimeSourceKind(runtimeStatus.runtime_source.kind);
}

export function formatRuntimeArtifactBrief(
  runtimeStatus: ManagedRuntimeStatus,
): string {
  return formatRuntimeArtifactKind(runtimeStatus.runtime_artifact.kind);
}

type HealthClientKey = keyof ClientVerificationSnapshot;
type RuntimeBindingScope = "repo_scoped" | "global";

const HEALTH_CLIENT_ORDER: HealthClientKey[] = [
  "vscode",
  "claude_desktop",
  "claude_code",
  "codex",
  "opencode",
];

const HEALTH_CLIENT_LABELS: Record<HealthClientKey, string> = {
  vscode: "VS Code",
  claude_desktop: "Claude Desktop",
  claude_code: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
};

const CLIENT_ALERT_PREFIXES: Record<HealthClientKey, string[]> = {
  vscode: ["client.copilot", "bindings.repo.vscode", "bindings.global.vscode"],
  claude_desktop: ["bindings.global.claude_desktop"],
  claude_code: ["client.claude", "bindings.repo.claude", "bindings.global.claude_code"],
  codex: ["client.codex", "bindings.repo.codex", "bindings.global.codex"],
  opencode: ["client.opencode", "bindings.repo.opencode"],
};

interface DetectedClientBinding {
  client: HarnessClientId;
  key: HealthClientKey;
  repo_path: string;
  source: RuntimeBindingScope;
  verification_mode: "config_sufficient" | "runtime_required";
  signature: string;
  config_scope: ConfigScope;
  detail?: string;
}

type BindingContractState = "managed" | "legacy" | "invalid";

interface StoredClientVerificationRecord {
  client: HarnessClientId;
  repo_path: string;
  config_scope: ConfigScope;
  verified_at: string;
  binding_scope: RuntimeBindingScope;
  binding_signature: string;
}

interface StoredClientVerificationIndex {
  version: number;
  verifications: Partial<Record<HarnessClientId, StoredClientVerificationRecord>>;
}

const CLIENT_VERIFICATION_VERSION = 1;
const HEALTH_INPUT_SIGNATURE_VERSION = 1;
const DEFAULT_LOCAL_SCAFFOLD_CLIENTS: LocalScaffoldClient[] = [
  "claude",
  "copilot",
  "opencode",
  "codex",
];
const LOCAL_SCAFFOLD_TO_HEALTH_CLIENTS: Record<
  LocalScaffoldClient,
  HealthClientKey[]
> = {
  claude: ["claude_desktop", "claude_code"],
  copilot: ["vscode"],
  codex: ["codex"],
  opencode: ["opencode"],
};

const FULL_CORE_FILES: ManagedFileCheck[] = [
  scaffoldFile("scaffold.agents", "AGENTS.md", "AGENTS.md", "error", true, ["all"]),
  scaffoldFile(
    "scaffold.checkpoints",
    "CHECKPOINTS.md",
    "CHECKPOINTS.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "scaffold.config",
    "harness.config.json",
    "harness.config.json",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile("scaffold.repo_init", "init.sh", "init.sh", "error", true, ["all"]),
  scaffoldFile(
    "scaffold.runtime_launcher",
    ".harness/runtime/launch-global-runtime.mjs",
    ".harness/runtime/launch-global-runtime.mjs",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.architecture",
    ".harness-docs/architecture.md",
    ".harness-docs/architecture.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.conventions",
    ".harness-docs/conventions.md",
    ".harness-docs/conventions.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.specs",
    ".harness-docs/specs.md",
    ".harness-docs/specs.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.specs_policy",
    ".harness-docs/specs_policy.md",
    ".harness-docs/specs_policy.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.verification",
    ".harness-docs/verification.md",
    ".harness-docs/verification.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.model_interface",
    ".harness-docs/model_interface.md",
    ".harness-docs/model_interface.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.context_manager",
    ".harness-docs/context_manager.md",
    ".harness-docs/context_manager.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.execution_engine",
    ".harness-docs/execution_engine.md",
    ".harness-docs/execution_engine.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.memory_system",
    ".harness-docs/memory_system.md",
    ".harness-docs/memory_system.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.orchestration",
    ".harness-docs/orchestration.md",
    ".harness-docs/orchestration.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.tool_catalog",
    ".harness-docs/tool_catalog.md",
    ".harness-docs/tool_catalog.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.observation_policy",
    ".harness-docs/observation_policy.md",
    ".harness-docs/observation_policy.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.loop_contract",
    ".harness-docs/loop_contract.md",
    ".harness-docs/loop_contract.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.planning_model",
    ".harness-docs/planning_model.md",
    ".harness-docs/planning_model.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.budgets",
    ".harness-docs/budgets.md",
    ".harness-docs/budgets.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.contract_versions",
    ".harness-docs/contract_versions.md",
    ".harness-docs/contract_versions.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "docs.frontend_adapters",
    ".harness-docs/frontend_adapters.md",
    ".harness-docs/frontend_adapters.md",
    "error",
    true,
    ["all"],
  ),
];

const THIN_CORE_FILES: ManagedFileCheck[] = [
  scaffoldFile("scaffold.agents", "AGENTS.md", "AGENTS.md", "error", true, ["all"]),
  scaffoldFile(
    "scaffold.config",
    "harness.config.json",
    "harness.config.json",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "scaffold.runtime_launcher",
    ".harness/runtime/launch-global-runtime.mjs",
    ".harness/runtime/launch-global-runtime.mjs",
    "error",
    true,
    ["all"],
  ),
];

const FULL_CLIENT_FILES: ManagedFileCheck[] = [
  scaffoldFile("client.codex.instructions", "CODEX.md", "CODEX.md", "warn", false, ["codex"]),
  scaffoldFile("client.claude.instructions", "CLAUDE.md", "CLAUDE.md", "warn", false, ["claude"]),
  scaffoldFile(
    "client.copilot.instructions",
    ".github/copilot-instructions.md",
    ".github/copilot-instructions.md",
    "warn",
    false,
    ["copilot"],
  ),
  scaffoldFile("client.claude.mcp", ".mcp.json", ".mcp.json", "warn", false, ["claude"]),
  scaffoldFile(
    "client.claude.command",
    ".claude/commands/harness.md",
    ".claude/commands/harness.md",
    "warn",
    false,
    ["claude"],
  ),
  scaffoldFile(
    "client.codex.config",
    ".codex/config.toml",
    ".codex/config.toml",
    "warn",
    false,
    ["codex"],
  ),
  scaffoldFile(
    "client.opencode.config",
    ".opencode/opencode.json",
    ".opencode/opencode.json",
    "warn",
    false,
    ["opencode"],
  ),
  scaffoldFile(
    "client.opencode.command",
    ".opencode/commands/harness.md",
    ".opencode/commands/harness.md",
    "warn",
    false,
    ["opencode"],
  ),
  scaffoldFile(
    "client.copilot.mcp",
    ".vscode/mcp.json",
    ".vscode/mcp.json",
    "warn",
    false,
    ["copilot"],
  ),
];

const THIN_CLIENT_FILES: ManagedFileCheck[] = [
  scaffoldFile("client.codex.instructions", "CODEX.md", "CODEX.md", "warn", false, ["codex"]),
  scaffoldFile("client.claude.instructions", "CLAUDE.md", "CLAUDE.md", "warn", false, ["claude"]),
  scaffoldFile(
    "client.copilot.instructions",
    ".github/copilot-instructions.md",
    ".github/copilot-instructions.md",
    "warn",
    false,
    ["copilot"],
  ),
  scaffoldFile("client.claude.mcp", ".mcp.json", ".mcp.json", "warn", false, ["claude"]),
  scaffoldFile(
    "client.codex.config",
    ".codex/config.toml",
    ".codex/config.toml",
    "warn",
    false,
    ["codex"],
  ),
  scaffoldFile(
    "client.opencode.config",
    ".opencode/opencode.json",
    ".opencode/opencode.json",
    "warn",
    false,
    ["opencode"],
  ),
  scaffoldFile(
    "client.copilot.mcp",
    ".vscode/mcp.json",
    ".vscode/mcp.json",
    "warn",
    false,
    ["copilot"],
  ),
];

const LEGACY_CORE_FILES: ManagedFileCheck[] = [
  scaffoldFile("scaffold.agents", "AGENTS.md", "AGENTS.md", "error", true, ["all"]),
  scaffoldFile(
    "scaffold.checkpoints",
    "CHECKPOINTS.md",
    "CHECKPOINTS.md",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile(
    "scaffold.config",
    "harness.config.json",
    "harness.config.json",
    "error",
    true,
    ["all"],
  ),
  scaffoldFile("docs.architecture", "docs/architecture.md", "docs/architecture.md", "error", true, ["all"]),
  scaffoldFile("docs.conventions", "docs/conventions.md", "docs/conventions.md", "error", true, ["all"]),
  scaffoldFile("docs.specs", "docs/specs.md", "docs/specs.md", "error", true, ["all"]),
  scaffoldFile(
    "docs.verification",
    "docs/verification.md",
    "docs/verification.md",
    "error",
    true,
    ["all"],
  ),
];

const LEGACY_CLIENT_FILES: ManagedFileCheck[] = [
  scaffoldFile(
    "client.copilot.instructions",
    ".github/copilot-instructions.md",
    ".github/copilot-instructions.md",
    "warn",
    false,
    ["copilot"],
  ),
  scaffoldFile("client.codex.instructions", "CODEX.md", "CODEX.md", "warn", false, ["codex"]),
  scaffoldFile("client.claude.instructions", "CLAUDE.md", "CLAUDE.md", "warn", false, ["claude"]),
  scaffoldFile(
    "client.claude.command",
    ".claude/commands/harness.md",
    ".claude/commands/harness.md",
    "warn",
    false,
    ["claude"],
  ),
  scaffoldFile(
    "client.copilot.mcp",
    ".vscode/mcp.json",
    ".vscode/mcp.json",
    "warn",
    false,
    ["copilot"],
  ),
];

function scaffoldFile(
  code: string,
  label: string,
  filePath: string,
  severity: Exclude<HealthSeverity, "info">,
  blocking: boolean,
  clients: InitTarget[],
): ManagedFileCheck {
  return {
    code,
    label,
    path: filePath,
    severity,
    blocking,
    repairAction: {
      kind: "repo_update",
      clients,
    },
  };
}

function repoUpdateAction(clients: InitTarget[]): RepairAction {
  return {
    kind: "repo_update",
    clients,
  };
}

function globalClientAction(clients: GlobalClientId[]): RepairAction {
  return {
    kind: "global_clients",
    clients,
  };
}

function hasManagedAgentsBlock(content: string): boolean {
  const startIndex = content.indexOf(AGENTS_MANAGED_START_MARKER);
  const endIndex = content.indexOf(AGENTS_MANAGED_END_MARKER);
  return startIndex !== -1 && endIndex !== -1 && endIndex > startIndex;
}

function createDiagnostic(input: {
  code: string;
  ok: boolean;
  severity?: HealthSeverity;
  blocking?: boolean;
  message: string;
  detail?: string;
  detectedAt: string;
  fixCommand?: string;
  fixHint?: string;
  repairAction?: RepairAction;
}): HealthDiagnostic {
  const severity = input.ok ? "info" : (input.severity ?? "error");
  return {
    code: input.code,
    severity,
    blocking: input.ok ? false : (input.blocking ?? false),
    ok: input.ok,
    message: input.message,
    detail: input.detail,
    detected_at: input.detectedAt,
    fix_available: Boolean(!input.ok && (input.fixCommand || input.fixHint)),
    fix_command: input.ok ? undefined : input.fixCommand,
    fix_hint: input.ok ? undefined : input.fixHint,
    repair_action: input.ok ? undefined : input.repairAction,
  };
}

function toAlert(diagnostic: HealthDiagnostic): HealthAlert | null {
  if (diagnostic.ok || diagnostic.severity === "info") {
    return null;
  }

  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    blocking: diagnostic.blocking,
    message: diagnostic.message,
    detail: diagnostic.detail,
    detected_at: diagnostic.detected_at,
    fix_available: diagnostic.fix_available,
    fix_command: diagnostic.fix_command,
    fix_hint: diagnostic.fix_hint,
  };
}

function pushClientIdentityDiagnostic(
  diagnostics: HealthDiagnostic[],
  input: {
    code: string;
    detectedAt: string;
    expectedClient: HarnessClientId;
    actualClient: HarnessClientId | null;
    message: string;
    fixCommand?: string;
    repairAction?: RepairAction;
  },
): void {
  const ok = input.actualClient === input.expectedClient;
  diagnostics.push(
    createDiagnostic({
      code: input.code,
      ok,
      severity: "warn",
      blocking: false,
      message: input.message,
      detail: ok
        ? input.actualClient ?? undefined
        : input.actualClient
          ? `usa --client ${input.actualClient}; esperado ${input.expectedClient}`
          : `falta --client ${input.expectedClient}`,
      detectedAt: input.detectedAt,
      fixCommand: ok ? undefined : input.fixCommand,
      repairAction: ok ? undefined : input.repairAction,
    }),
  );
}

function summarizeDiagnostics(diagnostics: HealthDiagnostic[]): DoctorSummary {
  let passed = 0;
  let info = 0;
  let warn = 0;
  let error = 0;
  let activeAlerts = 0;
  let blocking = 0;
  let fixable = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.ok) {
      passed += 1;
      info += 1;
      continue;
    }

    activeAlerts += 1;
    if (diagnostic.severity === "warn") {
      warn += 1;
    } else {
      error += 1;
    }
    if (diagnostic.blocking) {
      blocking += 1;
    }
    if (diagnostic.fix_available) {
      fixable += 1;
    }
  }

  const status =
    error > 0 ? "error" : activeAlerts > 0 ? "degraded" : "ok";

  return {
    status,
    healthy: error === 0,
    total: diagnostics.length,
    passed,
    info,
    warn,
    error,
    active_alerts: activeAlerts,
    blocking,
    fixable,
  };
}

function formatLocalRepairCommand(repoPath: string, clients?: InitTarget[]): string {
  const unique = dedupeClients(clients);
  const flags = [`--repo-path ${quoteCliArg(repoPath)}`];

  if (
    unique.length > 0 &&
    !(unique.length === 1 && unique[0] === "all")
  ) {
    flags.push(`--clients ${unique.join(",")}`);
  }

  return `arufheim-harness repair ${flags.join(" ")}`;
}

function formatGlobalRepairCommand(clients: GlobalClientId[]): string {
  const aliases = new Set<string>();

  for (const client of clients) {
    if (client === "vscode") {
      aliases.add("copilot");
      continue;
    }
    if (client === "claude-desktop" || client === "claude-code") {
      aliases.add("claude");
      continue;
    }
    aliases.add(client);
  }

  const suffix =
    aliases.size > 0 ? ` --clients ${Array.from(aliases).join(",")}` : "";
  return `arufheim-harness repair --global${suffix}`;
}

function formatForcedGlobalRepairCommand(clients: GlobalClientId[]): string {
  return `${formatGlobalRepairCommand(clients)} --force-managed-global`;
}

function quoteCliArg(value: string): string {
  return value.includes(" ") ? JSON.stringify(value) : value;
}

function dedupeClients<T extends string>(clients?: T[]): T[] {
  if (!clients || clients.length === 0) {
    return [];
  }
  if (clients.includes("all" as T)) {
    return ["all" as T];
  }
  return Array.from(new Set(clients));
}

function extractFlagArg(args: unknown, flagName: string): string | null {
  if (!Array.isArray(args)) {
    return null;
  }

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (typeof value !== "string") {
      continue;
    }
    if (value === flagName) {
      const next = args[index + 1];
      return typeof next === "string" ? next : null;
    }
    if (value.startsWith(`${flagName}=`)) {
      return value.slice(`${flagName}=`.length);
    }
  }

  return null;
}

function extractRepoPathArg(args: unknown): string | null {
  return extractFlagArg(args, "--repo-path");
}

function extractClientArg(args: unknown): HarnessClientId | null {
  const value = extractFlagArg(args, "--client");
  if (
    value === "vscode" ||
    value === "claude-desktop" ||
    value === "claude-code" ||
    value === "codex" ||
    value === "opencode"
  ) {
    return value;
  }
  return null;
}

function readCommandString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isLegacyHarnessArgs(args: unknown): boolean {
  return (
    Array.isArray(args) &&
    args.some(
      (value) =>
        value === "arufheim-harness" ||
        value === "npx" ||
        value === "--yes",
    )
  );
}

function classifyRepoLauncherContract(
  command: unknown,
  args: unknown,
): BindingContractState {
  const commandString = readCommandString(command);
  if (
    commandString === "node" &&
    Array.isArray(args) &&
    args[0] === REPO_RUNTIME_LAUNCHER_PATH
  ) {
    return "managed";
  }

  if (
    commandString === "npx" ||
    commandString === "arufheim-harness" ||
    isLegacyHarnessArgs(args)
  ) {
    return "legacy";
  }

  return "invalid";
}

function classifyOpenCodeLauncherContract(command: unknown): BindingContractState {
  if (
    Array.isArray(command) &&
    command[0] === "node" &&
    command[1] === REPO_RUNTIME_LAUNCHER_PATH
  ) {
    return "managed";
  }

  if (
    Array.isArray(command) &&
    command.some((value) => value === "npx" || value === "arufheim-harness")
  ) {
    return "legacy";
  }

  return "invalid";
}

type GlobalBindingClientKey = keyof BindingStatus["global"];

function isPortableRepoBinding(repoPathArg: string | null): boolean {
  return (
    repoPathArg === "." ||
    repoPathArg === "${workspaceFolder}" ||
    repoPathArg === "${PWD}" ||
    repoPathArg === "${PWD:-.}"
  );
}

function classifyGlobalPortableBinding(
  clientKey: GlobalBindingClientKey,
  repoPathArg: string | null,
): "portable" | "assumed" | "incompatible" {
  if (repoPathArg === null) {
    return "incompatible";
  }
  if (clientKey === "vscode") {
    if (repoPathArg === "${workspaceFolder}") {
      return "portable";
    }
    return isPortableRepoBinding(repoPathArg) ? "assumed" : "incompatible";
  }
  return isPortableRepoBinding(repoPathArg) ? "assumed" : "incompatible";
}

function classifyRepoBinding(
  clientKey: GlobalBindingClientKey,
  repoPathArg: string | null,
  expectedRepoPath: string,
): "explicit" | "portable" | "assumed" | "incompatible" {
  if (repoPathArg === expectedRepoPath) {
    return "explicit";
  }
  return classifyGlobalPortableBinding(clientKey, repoPathArg);
}

function assumedBindingDetail(
  clientKey: GlobalBindingClientKey,
  repoPathArg: string,
): string {
  if (clientKey === "vscode") {
    return `binding global usa '${repoPathArg}' en vez de '\${workspaceFolder}'; valida manualmente el repo abierto o normaliza con repair --global`;
  }
  if (clientKey === "claude_desktop") {
    return `binding global usa '${repoPathArg}' y Claude Desktop no ofrece una forma portable verificable; valida manualmente \`repo_path\` antes de mutar estado`;
  }
  if (clientKey === "claude_code") {
    return `binding global usa '${repoPathArg}' y depende del cwd real de Claude Code; valida manualmente \`repo_path\` o prefiere binding repo-scoped`;
  }
  return `binding global usa '${repoPathArg}' y depende del cwd real del cliente; valida manualmente \`repo_path\` o prefiere binding repo-scoped`;
}

function readCodexHarnessSection(text: string): string | null {
  const match = text.match(
    /\[mcp_servers\.arufheim-harness\]([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/,
  );
  return match ? match[1] : null;
}

function readCodexCommand(sectionText: string): string | null {
  const match = sectionText.match(/^\s*command\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function readCodexArgs(sectionText: string): string[] {
  const match = sectionText.match(/^\s*args\s*=\s*\[([\s\S]*?)\]/m);
  if (!match) {
    return [];
  }
  return Array.from(match[1].matchAll(/"([^"]*)"/g)).map(
    (entry) => entry[1] ?? "",
  );
}

function readCodexFlagArg(sectionText: string, flagName: string): string | null {
  const escapedFlag = flagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const separateArgMatch = sectionText.match(
    new RegExp(`"${escapedFlag}"\\s*,\\s*"([^"]+)"`),
  );
  if (separateArgMatch) {
    return separateArgMatch[1];
  }

  const inlineArgMatch = sectionText.match(
    new RegExp(`"${escapedFlag}=([^"]+)"`),
  );
  return inlineArgMatch ? inlineArgMatch[1] : null;
}

function readCodexRepoPathArg(sectionText: string): string | null {
  return readCodexFlagArg(sectionText, "--repo-path");
}

function readCodexClientArg(sectionText: string): HarnessClientId | null {
  const value = readCodexFlagArg(sectionText, "--client");
  if (
    value === "vscode" ||
    value === "claude-desktop" ||
    value === "claude-code" ||
    value === "codex" ||
    value === "opencode"
  ) {
    return value;
  }
  return null;
}

function classifyCodexRepoLauncherContract(sectionText: string): BindingContractState {
  const command = readCodexCommand(sectionText);
  const args = readCodexArgs(sectionText);
  if (command === "node" && args[0] === REPO_RUNTIME_LAUNCHER_PATH) {
    return "managed";
  }
  if (
    command === "npx" ||
    command === "arufheim-harness" ||
    args.includes("arufheim-harness")
  ) {
    return "legacy";
  }
  return "invalid";
}

function classifyManagedGlobalShimContract(command: unknown): BindingContractState {
  const commandString = readCommandString(command);
  if (!commandString) {
    return "invalid";
  }
  if (path.resolve(commandString) === path.resolve(getManagedGlobalRuntimeShimPath())) {
    return "managed";
  }
  if (commandString === "npx" || commandString === "arufheim-harness") {
    return "legacy";
  }
  return "invalid";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readExpectedLocalScaffoldState(
  repoPath: string,
): Promise<{
  clients: Set<LocalScaffoldClient> | null;
  layout: ScaffoldLayout;
}> {
  const configPath = path.join(repoPath, "harness.config.json");
  if (!(await fileExists(configPath))) {
    return {
      clients: null,
      layout: await inferScaffoldLayout(repoPath),
    };
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = parseHarnessConfigDocument(JSON.parse(raw));
    return {
      clients: new Set(
        parsed.scaffold?.localClients ?? DEFAULT_LOCAL_SCAFFOLD_CLIENTS,
      ),
      layout: await inferScaffoldLayout(repoPath, parsed),
    };
  } catch {
    return {
      clients: null,
      layout: await inferScaffoldLayout(repoPath),
    };
  }
}

function filterManagedFileChecks(
  checks: ManagedFileCheck[],
  expectedClients: Set<LocalScaffoldClient> | null,
): ManagedFileCheck[] {
  if (expectedClients === null) {
    return checks;
  }

  return checks.filter((check) => {
    if (check.repairAction.clients.includes("all")) {
      return true;
    }

    return check.repairAction.clients.some(
      (client) =>
        client !== "all" &&
        expectedClients.has(client as LocalScaffoldClient),
    );
  });
}

function deriveExpectedHealthClients(
  expectedClients: Set<LocalScaffoldClient> | null,
): Set<HealthClientKey> | null {
  if (expectedClients === null) {
    return null;
  }

  const expectedHealthClients = new Set<HealthClientKey>();
  for (const client of expectedClients) {
    for (const key of LOCAL_SCAFFOLD_TO_HEALTH_CLIENTS[client]) {
      expectedHealthClients.add(key);
    }
  }
  return expectedHealthClients;
}

function shouldInspectHealthClient(
  key: HealthClientKey,
  expectedClients: Set<HealthClientKey> | null,
): boolean {
  return expectedClients === null || expectedClients.has(key);
}

function globalStatusForAbsent(): BindingClientStatus {
  return { state: "absent" };
}

function defaultClientVerificationStatus(): ClientVerificationStatus {
  return {
    state: "missing",
    detail: "sin binding detectado",
    verified_at: null,
  };
}

function emptyClientVerificationSnapshot(): ClientVerificationSnapshot {
  return {
    vscode: defaultClientVerificationStatus(),
    claude_desktop: defaultClientVerificationStatus(),
    claude_code: defaultClientVerificationStatus(),
    codex: defaultClientVerificationStatus(),
    opencode: defaultClientVerificationStatus(),
  };
}

function toHealthClientKey(client: HarnessClientId): HealthClientKey {
  if (client === "claude-desktop") {
    return "claude_desktop";
  }
  if (client === "claude-code") {
    return "claude_code";
  }
  return client;
}

function fromHealthClientKey(key: HealthClientKey): HarnessClientId {
  if (key === "claude_desktop") {
    return "claude-desktop";
  }
  if (key === "claude_code") {
    return "claude-code";
  }
  return key;
}

function isStoredVerificationCurrent(
  repoPath: string,
  binding: DetectedClientBinding,
  record: StoredClientVerificationRecord | undefined,
): boolean {
  const storedRepoPath = record
    ? normalizeStoredRepoPath(repoPath, record.repo_path)
    : null;
  return (
    record?.client === binding.client &&
    storedRepoPath === binding.repo_path &&
    record.config_scope === binding.config_scope &&
    record.binding_scope === binding.source &&
    record.binding_signature === binding.signature
  );
}

function normalizeRepoPath(repoPath: string): string {
  return path.resolve(repoPath);
}

function normalizeStoredRepoPath(
  repoPath: string,
  storedRepoPath: string,
): string {
  if (path.isAbsolute(storedRepoPath)) {
    return path.resolve(storedRepoPath);
  }
  return path.resolve(repoPath, storedRepoPath);
}

function buildBindingSignature(value: unknown): string {
  return JSON.stringify(value);
}

async function clientVerificationRecordPathFor(repoPath: string): Promise<string> {
  repoPath = normalizeRepoPath(repoPath);
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  return path.join(
    repoPath,
    path.dirname(workflowPaths.metricsPath),
    "client-verifications.json",
  );
}

async function readStoredClientVerifications(
  repoPath: string,
): Promise<Partial<Record<HarnessClientId, StoredClientVerificationRecord>>> {
  repoPath = normalizeRepoPath(repoPath);
  try {
    const filePath = await clientVerificationRecordPathFor(repoPath);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoredClientVerificationIndex;
    return parsed.verifications ?? {};
  } catch {
    return {};
  }
}

async function writeStoredClientVerification(
  repoPath: string,
  record: StoredClientVerificationRecord,
): Promise<void> {
  repoPath = normalizeRepoPath(repoPath);
  const filePath = await clientVerificationRecordPathFor(repoPath);
  const existing = await readStoredClientVerifications(repoPath);
  existing[record.client] = record;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        version: CLIENT_VERIFICATION_VERSION,
        verifications: existing,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

function buildClientVerificationSnapshot(
  repoPath: string,
  bindings: Partial<Record<HealthClientKey, DetectedClientBinding>>,
  records: Partial<Record<HarnessClientId, StoredClientVerificationRecord>>,
  expectedClients: Set<HealthClientKey> | null,
): ClientVerificationSnapshot {
  const snapshot = emptyClientVerificationSnapshot();

  for (const key of Object.keys(snapshot) as HealthClientKey[]) {
    const client = fromHealthClientKey(key);
    const binding = bindings[key];
    const record = records[client];
    if (!shouldInspectHealthClient(key, expectedClients) && !binding && !record) {
      snapshot[key] = defaultClientVerificationStatus();
      continue;
    }

    if (!binding) {
      snapshot[key] = record
        ? {
            state: "stale",
            detail: "hay verificación previa pero ya no existe un binding actual",
            verified_at: record.verified_at,
            config_scope: record.config_scope,
            binding_scope: record.binding_scope,
          }
        : defaultClientVerificationStatus();
      continue;
    }

    if (!record) {
      snapshot[key] = {
        state:
          binding.verification_mode === "config_sufficient"
            ? "verified"
            : "configured",
        detail:
          binding.verification_mode === "config_sufficient"
            ? `${binding.source} verificado por config determinística`
            : `${binding.source} configurado; falta arranque verificado`,
        verified_at: null,
        config_scope: binding.config_scope,
        binding_scope: binding.source,
      };
      continue;
    }

    if (isStoredVerificationCurrent(repoPath, binding, record)) {
      snapshot[key] = {
        state: "verified",
        detail: `${binding.source} verificado con la config actual`,
        verified_at: record.verified_at,
        config_scope: record.config_scope,
        binding_scope: record.binding_scope,
      };
      continue;
    }

    snapshot[key] = {
      state: "stale",
      detail: "la verificación previa no coincide con la config actual",
      verified_at: record.verified_at,
      config_scope: record.config_scope,
      binding_scope: record.binding_scope,
    };
  }

  return snapshot;
}

function defaultClientReadinessStatus(): ClientReadinessStatus {
  return {
    state: "missing",
    detail: "sin binding detectado",
  };
}

function emptyClientReadinessSnapshot(): ClientReadinessSnapshot {
  return {
    vscode: defaultClientReadinessStatus(),
    claude_desktop: defaultClientReadinessStatus(),
    claude_code: defaultClientReadinessStatus(),
    codex: defaultClientReadinessStatus(),
    opencode: defaultClientReadinessStatus(),
  };
}

function findClientAlert(
  key: HealthClientKey,
  alerts: HealthAlert[],
): HealthAlert | null {
  const prefixes = CLIENT_ALERT_PREFIXES[key];
  return (
    alerts.find((alert) => prefixes.some((prefix) => alert.code.startsWith(prefix))) ??
    null
  );
}

function activationNextStepForClient(key: HealthClientKey): string {
  const label = HEALTH_CLIENT_LABELS[key];
  if (key === "claude_desktop") {
    return `${label}: reinicia la app, llama \`harness_status(mode: "brief_minimal")\` y confirma \`repo_path\` antes de mutar estado.`;
  }
  if (key === "claude_code") {
    return `${label}: reabre la sesión o el repo si acabas de cambiar bindings, luego llama \`harness_status(mode: "brief_minimal")\` y confirma \`repo_path\`.`;
  }
  if (key === "codex") {
    return `${label}: reabre el repo o la sesión si acabas de cambiar bindings, luego llama \`harness_status(mode: "brief_minimal")\` y confirma \`repo_path\`.`;
  }
  return `${label}: llama \`harness_status(mode: "brief_minimal")\` y confirma \`repo_path\` antes de mutar estado.`;
}

function staleNextStepForClient(key: HealthClientKey): string {
  return `${activationNextStepForClient(key)} Si la configuración cambió, corre \`arufheim-harness repair\` o \`setup --update\` antes de reintentar.`;
}

function missingNextStepForClient(key: HealthClientKey): string {
  if (key === "claude_desktop") {
    return "Configura el binding global con `arufheim-harness setup --global --clients claude` y luego valida `repo_path` en el frontend.";
  }
  if (key === "vscode") {
    return "Configura el cliente con `arufheim-harness setup --clients copilot` o `setup --global --clients copilot`.";
  }
  if (key === "claude_code") {
    return "Configura el cliente con `arufheim-harness setup --clients claude` o `setup --global --repo-path <repo> --clients claude-code`.";
  }
  if (key === "codex") {
    return "Configura el cliente con `arufheim-harness setup --clients codex` o `setup --global --repo-path <repo> --clients codex`.";
  }
  return "Configura el cliente con `arufheim-harness setup --clients opencode`.";
}

function buildClientReadinessSnapshot(input: {
  alerts: HealthAlert[];
  clientVerification: ClientVerificationSnapshot;
  expectedClients: Set<HealthClientKey> | null;
}): ClientReadinessSnapshot {
  const snapshot = emptyClientReadinessSnapshot();

  for (const key of HEALTH_CLIENT_ORDER) {
    const verification = input.clientVerification[key];
    const alert = findClientAlert(key, input.alerts);
    if (
      !shouldInspectHealthClient(key, input.expectedClients) &&
      verification.state === "missing" &&
      !alert
    ) {
      snapshot[key] = defaultClientReadinessStatus();
      continue;
    }
    const hasRepairableAlert = Boolean(
      alert && (alert.fix_available || alert.fix_command || alert.fix_hint),
    );
    const hasBlockingIssue = Boolean(
      alert && (alert.blocking || alert.severity === "error"),
    );

    if (hasBlockingIssue) {
      snapshot[key] = {
        state: "invalid_manual_fix_required",
        detail: alert?.detail ?? alert?.message ?? "configuración inválida",
        next_step:
          alert?.fix_command ??
          alert?.fix_hint ??
          "Corrige la configuración manualmente y vuelve a correr doctor.",
        fix_command: alert?.fix_command,
        verified_at: verification.verified_at ?? null,
        config_scope: verification.config_scope,
        binding_scope: verification.binding_scope,
      };
      continue;
    }

    if (verification.state === "configured") {
      snapshot[key] = {
        state: "configured_needs_activation",
        detail: verification.detail ?? "binding configurado; falta activación real",
        next_step: activationNextStepForClient(key),
        verified_at: verification.verified_at ?? null,
        config_scope: verification.config_scope,
        binding_scope: verification.binding_scope,
      };
      continue;
    }

    if (verification.state === "stale") {
      snapshot[key] = {
        state: "stale_reverification_required",
        detail:
          verification.detail ??
          "la verificación previa ya no coincide con la configuración actual",
        next_step: staleNextStepForClient(key),
        verified_at: verification.verified_at ?? null,
        config_scope: verification.config_scope,
        binding_scope: verification.binding_scope,
      };
      continue;
    }

    if (verification.state === "verified" && hasRepairableAlert) {
      snapshot[key] = {
        state: "invalid_manual_fix_required",
        detail: alert?.detail ?? alert?.message ?? verification.detail ?? "binding desalineado",
        next_step:
          alert?.fix_command ??
          alert?.fix_hint ??
          "Repara la configuración gestionada y vuelve a verificar.",
        fix_command: alert?.fix_command,
        verified_at: verification.verified_at ?? null,
        config_scope: verification.config_scope,
        binding_scope: verification.binding_scope,
      };
      continue;
    }

    if (verification.state === "verified") {
      snapshot[key] = {
        state: "verified",
        detail: verification.detail ?? "cliente listo",
        verified_at: verification.verified_at ?? null,
        config_scope: verification.config_scope,
        binding_scope: verification.binding_scope,
      };
      continue;
    }

    if (hasRepairableAlert) {
      snapshot[key] = {
        state: "invalid_manual_fix_required",
        detail: alert?.detail ?? alert?.message ?? "falta o sobra configuración gestionada",
        next_step:
          alert?.fix_command ??
          alert?.fix_hint ??
          "Repara la configuración gestionada y vuelve a correr doctor.",
        fix_command: alert?.fix_command,
        verified_at: verification.verified_at ?? null,
        config_scope: verification.config_scope,
        binding_scope: verification.binding_scope,
      };
      continue;
    }

    snapshot[key] = {
      state: "missing",
      detail: verification.detail ?? "sin binding detectado",
      next_step: missingNextStepForClient(key),
      verified_at: verification.verified_at ?? null,
      config_scope: verification.config_scope,
      binding_scope: verification.binding_scope,
    };
  }

  return snapshot;
}

function computeBindingStatus(input: {
  repoScoped: BindingStatus["repo_scoped"];
  global: BindingStatus["global"];
}): BindingStatus {
  const repoScopedValues = Object.values(input.repoScoped);
  const hasAmbiguousGlobal = Object.values(input.global).some(
    (client) => client.state === "ambiguous" || client.state === "invalid",
  );
  const hasPortableGlobal = Object.values(input.global).some(
    (client) =>
      client.state === "portable" ||
      client.state === "ok" ||
      client.state === "verified",
  );
  const hasAssumedGlobal = Object.values(input.global).some(
    (client) => client.state === "assumed",
  );
  const repoScopedCount = repoScopedValues.filter(Boolean).length;

  let state: BindingStatus["state"] = "missing";
  if (hasAmbiguousGlobal) {
    state = "ambiguous";
  } else if (repoScopedValues.every(Boolean)) {
    state = "repo_scoped";
  } else if (repoScopedCount > 0) {
    state = "repo_scoped_partial";
  } else if (hasPortableGlobal) {
    state = "global_fallback";
  } else if (hasAssumedGlobal) {
    state = "global_assumed";
  }

  return {
    state,
    repo_scoped: input.repoScoped,
    global: input.global,
  };
}

async function healthRecordPathFor(repoPath: string): Promise<string> {
  repoPath = normalizeRepoPath(repoPath);
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  return path.join(
    repoPath,
    path.dirname(workflowPaths.metricsPath),
    "health.json",
  );
}

async function readStoredHealthSnapshot(
  repoPath: string,
): Promise<StoredHealthSnapshot | null> {
  repoPath = normalizeRepoPath(repoPath);
  try {
    const filePath = await healthRecordPathFor(repoPath);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as StoredHealthSnapshot;
  } catch {
    return null;
  }
}

async function writeStoredHealthSnapshot(
  repoPath: string,
  snapshot: HarnessHealthSnapshot,
  verifiedBy: HealthRecordSource,
  verifiedAt: string,
): Promise<void> {
  repoPath = normalizeRepoPath(repoPath);
  const filePath = await healthRecordPathFor(repoPath);
  const inputSignature = await collectHealthInputSignature(repoPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        last_verified_at: verifiedAt,
        runtime_status: snapshot.runtime_status,
        binding_status: snapshot.binding_status,
        client_verification: snapshot.client_verification,
        client_readiness: snapshot.client_readiness,
        doctor_summary: snapshot.doctor_summary,
        alerts: snapshot.alerts,
        workflow_layout: snapshot.workflow_layout,
        scaffold_layout: snapshot.scaffold_layout,
        archived_count: snapshot.archived_count,
        verified_by: verifiedBy,
        input_signature: inputSignature,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

function buildScaffoldChecks(
  workflowLayout: WorkflowPaths["layout"],
  scaffoldLayout: ScaffoldLayout,
  expectedLocalClients: Set<LocalScaffoldClient> | null,
): ManagedFileCheck[] {
  return workflowLayout === "hidden"
    ? [
        ...(scaffoldLayout === "thin" ? THIN_CORE_FILES : FULL_CORE_FILES),
        ...filterManagedFileChecks(
          scaffoldLayout === "thin" ? THIN_CLIENT_FILES : FULL_CLIENT_FILES,
          expectedLocalClients,
        ),
      ]
    : [
        ...LEGACY_CORE_FILES,
        ...filterManagedFileChecks(LEGACY_CLIENT_FILES, expectedLocalClients),
      ];
}

function buildWorkflowFileChecks(
  workflowPaths: WorkflowPaths,
): Array<{
  code: string;
  label: string;
  path: string;
  repairAction: RepairAction;
}> {
  return [
    {
      code: "workflow.feature_list",
      label: workflowPaths.featureListPath,
      path: workflowPaths.featureListPath,
      repairAction: repoUpdateAction(["all"]),
    },
    ...(workflowPaths.layout === "hidden"
      ? [
          {
            code: "workflow.feature_history",
            label: workflowPaths.featureHistoryPath,
            path: workflowPaths.featureHistoryPath,
            repairAction: repoUpdateAction(["all"]),
          },
        ]
      : []),
    {
      code: "workflow.progress_readme",
      label: path.posix.join(
        path.posix.dirname(workflowPaths.currentPath),
        "README.md",
      ),
      path: path.posix.join(
        path.posix.dirname(workflowPaths.currentPath),
        "README.md",
      ),
      repairAction: repoUpdateAction(["all"]),
    },
    {
      code: "workflow.current",
      label: workflowPaths.currentPath,
      path: workflowPaths.currentPath,
      repairAction: repoUpdateAction(["all"]),
    },
    {
      code: "workflow.history",
      label: workflowPaths.historyPath,
      path: workflowPaths.historyPath,
      repairAction: repoUpdateAction(["all"]),
    },
  ];
}

function pushObservedFile(
  files: Map<string, { mode: "exists" | "mtime" }>,
  filePath: string,
  mode: "exists" | "mtime",
): void {
  const current = files.get(filePath);
  if (!current || (current.mode === "exists" && mode === "mtime")) {
    files.set(filePath, { mode });
  }
}

async function snapshotObservedFile(
  filePath: string,
  mode: "exists" | "mtime",
): Promise<StoredHealthInputFile> {
  try {
    const fileStat = await stat(filePath);
    return {
      path: filePath,
      mode,
      exists: true,
      mtime_ms: mode === "mtime" ? fileStat.mtimeMs : null,
    };
  } catch {
    return {
      path: filePath,
      mode,
      exists: false,
      mtime_ms: null,
    };
  }
}

async function collectHealthInputSignature(
  repoPath: string,
): Promise<StoredHealthInputSignature> {
  repoPath = normalizeRepoPath(repoPath);
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const scaffoldState = await readExpectedLocalScaffoldState(repoPath);
  const files = new Map<string, { mode: "exists" | "mtime" }>();

  for (const check of buildScaffoldChecks(
    workflowPaths.layout,
    scaffoldState.layout,
    scaffoldState.clients,
  )) {
    const absolutePath = path.join(repoPath, check.path);
    const mode =
      check.path === "AGENTS.md" ||
      check.path === "harness.config.json" ||
      check.path === ".harness/runtime/launch-global-runtime.mjs" ||
      check.path === ".mcp.json" ||
      check.path === ".codex/config.toml" ||
      check.path === ".opencode/opencode.json" ||
      check.path === ".vscode/mcp.json"
        ? "mtime"
        : "exists";
    pushObservedFile(files, absolutePath, mode);
  }

  for (const file of buildWorkflowFileChecks(workflowPaths)) {
    const absolutePath = path.join(repoPath, file.path);
    const mode =
      file.code === "workflow.feature_list" ||
      file.code === "workflow.feature_history"
        ? "mtime"
        : "exists";
    pushObservedFile(files, absolutePath, mode);
  }

  for (const globalConfigPath of [
    getVSCodeGlobalMcpPath(),
    getClaudeDesktopConfigPath(),
    getClaudeCodeConfigPath(),
    getCodexConfigPath(),
    getManagedGlobalRuntimeArtifactPath(),
    getManagedGlobalRuntimeMetadataPath(),
    getManagedGlobalRuntimeShimPath(),
  ]) {
    pushObservedFile(files, globalConfigPath, "mtime");
  }

  const captured = await Promise.all(
    Array.from(files.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([filePath, state]) => snapshotObservedFile(filePath, state.mode)),
  );

  return {
    version: HEALTH_INPUT_SIGNATURE_VERSION,
    files: captured,
  };
}

async function isStoredHealthSnapshotFresh(
  repoPath: string,
  stored: StoredHealthSnapshot,
): Promise<boolean> {
  if (stored.runtime_status?.version && stored.runtime_status.version !== HARNESS_VERSION) {
    return false;
  }
  if (
    stored.runtime_status &&
    typeof (stored.runtime_status as { runtime_source?: unknown }).runtime_source !==
      "object"
  ) {
    return false;
  }
  if (
    stored.runtime_status &&
    typeof (stored.runtime_status as { runtime_artifact?: unknown })
      .runtime_artifact !== "object"
  ) {
    return false;
  }
  if (
    !stored.input_signature ||
    stored.input_signature.version !== HEALTH_INPUT_SIGNATURE_VERSION
  ) {
    return false;
  }

  const current = await collectHealthInputSignature(repoPath);
  if (current.files.length !== stored.input_signature.files.length) {
    return false;
  }

  const storedByPath = new Map(
    stored.input_signature.files.map((entry) => [entry.path, entry]),
  );
  for (const entry of current.files) {
    const previous = storedByPath.get(entry.path);
    if (!previous) {
      return false;
    }
    if (previous.mode !== entry.mode || previous.exists !== entry.exists) {
      return false;
    }
    if (entry.mode === "mtime" && previous.mtime_ms !== entry.mtime_ms) {
      return false;
    }
  }

  return true;
}

function pushFileChecks(
  diagnostics: HealthDiagnostic[],
  repoPath: string,
  checks: ManagedFileCheck[],
  detectedAt: string,
): Promise<void[]> {
  return Promise.all(
    checks.map(async (check) => {
      const exists = await fileExists(path.join(repoPath, check.path));
      diagnostics.push(
        createDiagnostic({
          code: check.code,
          ok: exists,
          severity: check.severity,
          blocking: check.blocking,
          message: check.path,
          detail: exists ? undefined : "archivo no encontrado",
          detectedAt,
          fixCommand: exists
            ? undefined
            : formatLocalRepairCommand(
                repoPath,
                check.repairAction.clients as InitTarget[],
              ),
          repairAction: exists ? undefined : check.repairAction,
        }),
      );
    }),
  );
}

async function detectRuntimeBinding(
  repoPath: string,
  clientId: HarnessClientId,
  configScope: ConfigScope,
): Promise<DetectedClientBinding | null> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);

  if (workflowPaths.layout === "hidden") {
    if (clientId === "vscode") {
      const filePath = path.join(repoPath, ".vscode/mcp.json");
      if (await fileExists(filePath)) {
        const raw = await readFile(filePath, "utf8");
        const parsed = parseJsonc(raw) as {
          servers?: Record<string, { command?: unknown; args?: unknown }>;
        };
        const server = parsed.servers?.["arufheim-harness"];
        if (
          server &&
          classifyRepoLauncherContract(server.command, server.args) === "managed" &&
          extractRepoPathArg(server.args) !== null
        ) {
          return {
            client: "vscode",
            key: "vscode",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(server),
            config_scope: configScope,
            detail: extractRepoPathArg(server.args) ?? undefined,
          };
        }
      }
    }

    if (clientId === "claude-code") {
      const filePath = path.join(repoPath, ".mcp.json");
      if (await fileExists(filePath)) {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as {
          mcpServers?: Record<string, { command?: unknown; args?: unknown }>;
        };
        const server = parsed.mcpServers?.["arufheim-harness"];
        if (
          server &&
          classifyRepoLauncherContract(server.command, server.args) === "managed" &&
          extractRepoPathArg(server.args) !== null
        ) {
          return {
            client: "claude-code",
            key: "claude_code",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(server),
            config_scope: configScope,
            detail: extractRepoPathArg(server.args) ?? undefined,
          };
        }
      }
    }

    if (clientId === "codex") {
      const filePath = path.join(repoPath, ".codex/config.toml");
      if (await fileExists(filePath)) {
        const raw = await readFile(filePath, "utf8");
        const section = readCodexHarnessSection(raw);
        if (
          section &&
          classifyCodexRepoLauncherContract(section) === "managed" &&
          readCodexRepoPathArg(section) !== null
        ) {
          return {
            client: "codex",
            key: "codex",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(section.trim()),
            config_scope: configScope,
            detail: readCodexRepoPathArg(section) ?? undefined,
          };
        }
      }
    }

    if (clientId === "opencode") {
      const filePath = path.join(repoPath, ".opencode/opencode.json");
      if (await fileExists(filePath)) {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as {
          mcp?: Record<string, { command?: unknown }>;
        };
        const server = parsed.mcp?.["arufheim-harness"];
        const command =
          server && Array.isArray(server.command) ? server.command : null;
        if (
          server &&
          classifyOpenCodeLauncherContract(command) === "managed" &&
          extractRepoPathArg(command) !== null
        ) {
          return {
            client: "opencode",
            key: "opencode",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(server),
            config_scope: configScope,
            detail: extractRepoPathArg(command) ?? undefined,
          };
        }
      }
    }
  }

  if (clientId === "vscode") {
    const filePath = getVSCodeGlobalMcpPath();
    if (await fileExists(filePath)) {
      const raw = await readFile(filePath, "utf8");
      const parsed = parseJsonc(raw) as {
        servers?: Record<string, { command?: unknown; args?: unknown }>;
      };
      const server = parsed.servers?.["arufheim-harness"];
      const repoPathArg = server ? extractRepoPathArg(server.args) : null;
      if (
        server &&
        classifyManagedGlobalShimContract(server.command) === "managed" &&
        repoPathArg !== null
      ) {
        const bindingClass = classifyRepoBinding("vscode", repoPathArg, repoPath);
        return {
          client: "vscode",
          key: "vscode",
          repo_path: repoPath,
          source: "global",
          verification_mode:
            bindingClass === "assumed" ? "runtime_required" : "config_sufficient",
          signature: buildBindingSignature(server),
          config_scope: configScope,
          detail: repoPathArg ?? undefined,
        };
      }
    }
  }

  if (clientId === "claude-desktop") {
    const filePath = getClaudeDesktopConfigPath();
    if (await fileExists(filePath)) {
      const raw = await readFile(filePath, "utf8");
      const parsed = parseJsonc(raw) as {
        mcpServers?: Record<string, { command?: unknown; args?: unknown }>;
      };
      const server = parsed.mcpServers?.["arufheim-harness"];
      const repoPathArg = server ? extractRepoPathArg(server.args) : null;
      if (
        server &&
        classifyManagedGlobalShimContract(server.command) === "managed" &&
        repoPathArg !== null
      ) {
        const bindingClass = classifyRepoBinding(
          "claude_desktop",
          repoPathArg,
          repoPath,
        );
        return {
          client: "claude-desktop",
          key: "claude_desktop",
          repo_path: repoPath,
          source: "global",
          verification_mode:
            bindingClass === "assumed" ? "runtime_required" : "config_sufficient",
          signature: buildBindingSignature(server),
          config_scope: configScope,
          detail: repoPathArg ?? undefined,
        };
      }
    }
  }

  if (clientId === "claude-code") {
    const filePath = getClaudeCodeConfigPath();
    if (await fileExists(filePath)) {
      const raw = await readFile(filePath, "utf8");
      const parsed = parseJsonc(raw) as {
        mcpServers?: Record<string, { command?: unknown; args?: unknown }>;
      };
      const server = parsed.mcpServers?.["arufheim-harness"];
      const repoPathArg = server ? extractRepoPathArg(server.args) : null;
      if (
        server &&
        classifyManagedGlobalShimContract(server.command) === "managed" &&
        repoPathArg !== null
      ) {
        const bindingClass = classifyRepoBinding(
          "claude_code",
          repoPathArg,
          repoPath,
        );
        return {
          client: "claude-code",
          key: "claude_code",
          repo_path: repoPath,
          source: "global",
          verification_mode:
            bindingClass === "assumed" ? "runtime_required" : "config_sufficient",
          signature: buildBindingSignature(server),
          config_scope: configScope,
          detail: repoPathArg ?? undefined,
        };
      }
    }
  }

  if (clientId === "codex") {
    const filePath = getCodexConfigPath();
    if (await fileExists(filePath)) {
      const raw = await readFile(filePath, "utf8");
      const section = readCodexHarnessSection(raw);
      const repoPathArg = section ? readCodexRepoPathArg(section) : null;
      if (
        section &&
        classifyManagedGlobalShimContract(readCodexCommand(section)) ===
          "managed" &&
        repoPathArg !== null
      ) {
        const bindingClass = classifyRepoBinding("codex", repoPathArg, repoPath);
        return {
          client: "codex",
          key: "codex",
          repo_path: repoPath,
          source: "global",
          verification_mode:
            bindingClass === "assumed" ? "runtime_required" : "config_sufficient",
          signature: buildBindingSignature(section.trim()),
          config_scope: configScope,
          detail: repoPathArg ?? undefined,
        };
      }
    }
  }

  return null;
}

export async function evaluateHarnessHealth(
  repoPath: string,
  options: EvaluateHarnessHealthOptions = {},
): Promise<HarnessHealthSnapshot> {
  repoPath = normalizeRepoPath(repoPath);
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const scaffoldState = await readExpectedLocalScaffoldState(repoPath);
  const scaffoldLayout = scaffoldState.layout;
  const detectedAt = new Date().toISOString();
  const diagnostics: HealthDiagnostic[] = [];
  const stored = await readStoredHealthSnapshot(repoPath);
  const storedVerifications = await readStoredClientVerifications(repoPath);
  let archivedCount = stored?.archived_count ?? 0;
  const clientBindings: Partial<Record<HealthClientKey, DetectedClientBinding>> =
    {};
  const currentConfigScope: ConfigScope = "repo";
  const expectedLocalClients = scaffoldState.clients;
  const expectedHealthClients = deriveExpectedHealthClients(expectedLocalClients);
  let parsedFeatures: WorkflowFeature[] = [];
  let archivedFeatures: WorkflowFeature[] = [];
  let loopPolicy: LoopPolicyConfig = {
    kind: DEFAULT_LOOP_POLICY.kind,
    maxAttemptsTotal: DEFAULT_LOOP_POLICY.maxAttemptsTotal,
    maxReviewRouteBacks: DEFAULT_LOOP_POLICY.maxReviewRouteBacks,
    maxNoProgressRounds: DEFAULT_LOOP_POLICY.maxNoProgressRounds,
    requireStrategyDelta: DEFAULT_LOOP_POLICY.requireStrategyDelta,
    autoRouteBack: DEFAULT_LOOP_POLICY.autoRouteBack,
  };

  const repoScoped = {
    vscode: false,
    claude: false,
    codex: false,
    opencode: false,
  };
  const globalBindings: BindingStatus["global"] = {
    vscode: globalStatusForAbsent(),
    claude_desktop: globalStatusForAbsent(),
    claude_code: globalStatusForAbsent(),
    codex: globalStatusForAbsent(),
  };
  const runtimeStatus = await evaluateManagedGlobalRuntimeStatus({
    verifiedAt: detectedAt,
  });

  diagnostics.push(
    createDiagnostic({
      code: "runtime.managed_global",
      ok: runtimeStatus.state === "ok",
      severity: "error",
      blocking: true,
      message: "runtime global gestionado disponible",
      detail:
        runtimeStatus.state === "ok"
          ? runtimeStatus.detail ?? runtimeStatus.path
          : runtimeStatus.detail ?? runtimeStatus.state,
      detectedAt,
      fixCommand:
        runtimeStatus.state === "ok"
          ? undefined
          : runtimeStatus.fix_command,
    }),
  );

  if (
    runtimeStatus.state === "ok" &&
    runtimeStatus.runtime_source.kind !== "package_install"
  ) {
    const sourceKind = runtimeStatus.runtime_source.kind;
    const sourcePath =
      runtimeStatus.runtime_source.package_root ??
      runtimeStatus.runtime_source.entrypoint;
    diagnostics.push(
      createDiagnostic({
        code: "runtime.managed_global.source",
        ok: false,
        severity: "warn",
        blocking: false,
        message:
          sourceKind === "linked_dev"
            ? "runtime global gestionado sembrado desde un link de desarrollo"
            : sourceKind === "workspace_dev"
              ? "runtime global gestionado sembrado desde un workspace local"
              : "runtime global gestionado con procedencia no ideal para distribución",
        detail: `${formatRuntimeSourceKind(sourceKind)} -> ${sourcePath}`,
        detectedAt,
        fixHint:
          "Para distribución o validación de release, reinstala el runtime desde una instalación publicada del paquete y vuelve a correr `arufheim-harness setup --global-runtime`.",
      }),
    );
  }

  const scaffoldChecks = buildScaffoldChecks(
    workflowPaths.layout,
    scaffoldLayout,
    expectedLocalClients,
  );
  await pushFileChecks(diagnostics, repoPath, scaffoldChecks, detectedAt);

  const workflowFiles = buildWorkflowFileChecks(workflowPaths);

  for (const file of workflowFiles) {
    const exists = await fileExists(path.join(repoPath, file.path));
    diagnostics.push(
      createDiagnostic({
        code: file.code,
        ok: exists,
        severity: "error",
        blocking: true,
        message: file.label,
        detail: exists ? undefined : "archivo no encontrado",
        detectedAt,
        fixCommand: exists
          ? undefined
          : formatLocalRepairCommand(repoPath, ["all"]),
        repairAction: exists ? undefined : file.repairAction,
      }),
    );
  }

  diagnostics.push(
    createDiagnostic({
      code: "scaffold.layout",
      ok: true,
      message: "scaffold layout detectado",
      detail: scaffoldLayout,
      detectedAt,
    }),
  );

  diagnostics.push(
    createDiagnostic({
      code: "workflow.layout",
      ok: true,
      message: "workflow layout detectado",
      detail: workflowPaths.layout,
      detectedAt,
    }),
  );

  if (workflowPaths.layout === "root-legacy") {
    diagnostics.push(
      createDiagnostic({
        code: "workflow.layout.legacy",
        ok: false,
        severity: "warn",
        blocking: false,
        message: "repo compatible pero desactualizado",
        detail:
          "layout root-legacy detectado; recomendado correr repair o setup --update",
        detectedAt,
        fixCommand: formatLocalRepairCommand(repoPath, ["all"]),
        repairAction: repoUpdateAction(["all"]),
      }),
    );
  }

  const agentsPath = path.join(repoPath, "AGENTS.md");
  if (await fileExists(agentsPath)) {
    const content = await readFile(agentsPath, "utf8");
    const hasManagedBlock = hasManagedAgentsBlock(content);
    const hasVersionMarker = content.includes(AGENTS_VERSION_MARKER);
    const referencesCanonicalPaths =
      content.includes(workflowPaths.currentPath) &&
      content.includes(workflowPaths.featureListPath);
    const agentsOk =
      hasManagedBlock && hasVersionMarker && referencesCanonicalPaths;
    const agentsDetail = agentsOk
      ? undefined
      : !hasManagedBlock
        ? "falta bloque gestionado; recomendado correr repair o setup --update"
        : !hasVersionMarker
          ? "bloque gestionado sin marker de versión"
          : "bloque gestionado con rutas canónicas desactualizadas";
    diagnostics.push(
      createDiagnostic({
        code: "scaffold.agents.managed",
        ok: agentsOk,
        severity: "warn",
        blocking: false,
        message: "AGENTS.md tiene bloque gestionado del harness",
        detail: agentsDetail,
        detectedAt,
        fixCommand: agentsOk
          ? undefined
          : formatLocalRepairCommand(repoPath, ["all"]),
        repairAction: agentsOk ? undefined : repoUpdateAction(["all"]),
      }),
    );
  }

  const configPath = path.join(repoPath, "harness.config.json");
  if (await fileExists(configPath)) {
    try {
      const raw = await readFile(configPath, "utf8");
      const parsed = parseHarnessConfigDocument(JSON.parse(raw));
      loopPolicy = parsed.loopPolicy ?? loopPolicy;
      if (parsed.version === undefined) {
        diagnostics.push(
          createDiagnostic({
            code: "config.version",
            ok: false,
            severity: "warn",
            blocking: false,
            message: "harness.config.json tiene version",
            detail:
              workflowPaths.layout === "root-legacy"
                ? "schema legacy compatible; recomendado correr repair o setup --update"
                : "campo version ausente (schema desactualizado)",
            detectedAt,
            fixCommand: formatLocalRepairCommand(repoPath, ["all"]),
            repairAction: repoUpdateAction(["all"]),
          }),
        );
      } else if (parsed.version < HARNESS_CONFIG_VERSION) {
        diagnostics.push(
          createDiagnostic({
            code: "config.version",
            ok: false,
            severity: "warn",
            blocking: false,
            message: "harness.config.json version",
            detail: `v${parsed.version} → esperada v${HARNESS_CONFIG_VERSION}`,
            detectedAt,
            fixCommand: formatLocalRepairCommand(repoPath, ["all"]),
            repairAction: repoUpdateAction(["all"]),
          }),
        );
      } else {
        diagnostics.push(
          createDiagnostic({
            code: "config.version",
            ok: true,
            message: "harness.config.json version",
            detail: `v${parsed.version}`,
            detectedAt,
          }),
        );
      }
    } catch {
      diagnostics.push(
        createDiagnostic({
          code: "config.json.valid",
          ok: false,
          severity: "error",
          blocking: true,
          message: "harness.config.json es JSON válido",
          detail: "JSON inválido",
          detectedAt,
          fixHint:
            "Corrige harness.config.json manualmente; repair no sobrescribe config inválida del usuario.",
        }),
      );
    }
  }

  const featureListPath = path.join(repoPath, workflowPaths.featureListPath);
  if (await fileExists(featureListPath)) {
    try {
      const raw = await readFile(featureListPath, "utf8");
      const features = parseFeatureListText(raw).features;
      parsedFeatures = features;
      diagnostics.push(
        createDiagnostic({
          code: "workflow.feature_list.valid",
          ok: true,
          message: "feature_list.json es JSON válido",
          detectedAt,
        }),
      );

      const inProgress = (
        features as Array<{ status?: string; name?: string }>
      ).filter((feature) => feature.status === "in_progress");
      if (inProgress.length > 1) {
        diagnostics.push(
          createDiagnostic({
            code: "workflow.single_in_progress",
            ok: false,
            severity: "error",
            blocking: true,
            message: "Solo una feature in_progress",
            detail: `${inProgress.length} features en in_progress: ${inProgress.map((feature) => feature.name).join(", ")}`,
            detectedAt,
            fixHint:
              'Cierra las extras con harness_update({ status: "done" }) o cambia su estado manualmente.',
          }),
        );
      } else {
        diagnostics.push(
          createDiagnostic({
            code: "workflow.single_in_progress",
            ok: true,
            message: "Solo una feature in_progress",
            detail:
              inProgress.length === 1
                ? `activa: ${inProgress[0].name}`
                : "ninguna activa",
            detectedAt,
          }),
        );
      }
    } catch {
      diagnostics.push(
        createDiagnostic({
          code: "workflow.feature_list.valid",
          ok: false,
          severity: "error",
          blocking: true,
          message: "feature_list.json es JSON válido",
          detail: "JSON inválido",
          detectedAt,
          fixHint:
            "Corrige el JSON manualmente; repair no reescribe backlog o estado humano.",
        }),
      );
    }
  }

  const featureHistoryPath = path.join(repoPath, workflowPaths.featureHistoryPath);
  if (await fileExists(featureHistoryPath)) {
    try {
      const raw = await readFile(featureHistoryPath, "utf8");
      archivedFeatures = parseFeatureHistoryText(raw);
      archivedCount = archivedFeatures.length;
      diagnostics.push(
        createDiagnostic({
          code: "workflow.feature_history.valid",
          ok: true,
          message: "feature_history.json es JSON válido",
          detectedAt,
        }),
      );
    } catch {
      diagnostics.push(
        createDiagnostic({
          code: "workflow.feature_history.valid",
          ok: false,
          severity: "error",
          blocking: false,
          message: "feature_history.json es JSON válido",
          detail: "JSON inválido",
          detectedAt,
          fixHint:
            "Corrige el JSON manualmente; repair no reescribe historia humana.",
        }),
      );
    }
  }

  if (parsedFeatures.length > 0 || archivedFeatures.length > 0) {
    const loopDiagnostics = await collectLoopDiagnostics(repoPath, {
      activeFeatures: parsedFeatures,
      archivedFeatures,
      policy: loopPolicy,
      repairCommand: formatLocalRepairCommand(repoPath, ["all"]),
    });

    for (const diagnostic of loopDiagnostics) {
      diagnostics.push(
        createDiagnostic({
          code: diagnostic.code,
          ok: false,
          severity: diagnostic.severity,
          blocking: diagnostic.blocking,
          message: diagnostic.message,
          detail: diagnostic.detail,
          detectedAt,
          fixCommand: diagnostic.fix_command,
          fixHint: diagnostic.fix_hint,
        }),
      );
    }
  }

  if (workflowPaths.layout === "hidden") {
    const opencodeConfigPath = path.join(repoPath, ".opencode/opencode.json");
    if (
      shouldInspectHealthClient("opencode", expectedHealthClients) &&
      await fileExists(opencodeConfigPath)
    ) {
      try {
        const raw = await readFile(opencodeConfigPath, "utf8");
        const parsed = JSON.parse(raw) as {
          $schema?: string;
          mcp?: Record<string, { command?: unknown }>;
        };
        const server = parsed.mcp?.["arufheim-harness"];
        const command =
          server && Array.isArray(server.command)
            ? server.command
            : null;
        const contractState = classifyOpenCodeLauncherContract(command);
        const ok =
          parsed.$schema === "https://opencode.ai/config.json" &&
          typeof server === "object" &&
          extractRepoPathArg(command) !== null;
        repoScoped.opencode = ok && contractState === "managed";
        if (repoScoped.opencode && server) {
          clientBindings.opencode = {
            client: "opencode",
            key: "opencode",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(server),
            config_scope: currentConfigScope,
            detail: extractRepoPathArg(command) ?? undefined,
          };
        }
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.opencode.explicit",
            ok,
            severity: "error",
            blocking: true,
            message: "opencode.json válido para harness",
            detail: ok
              ? undefined
              : "falta schema, MCP arufheim-harness o --repo-path explícito",
            detectedAt,
            fixCommand: ok
              ? undefined
              : formatLocalRepairCommand(repoPath, ["opencode"]),
            repairAction: ok
              ? undefined
              : repoUpdateAction(["opencode"]),
          }),
        );
        if (server && ok && contractState !== "managed") {
          diagnostics.push(
            createDiagnostic({
              code: "bindings.repo.opencode.runtime_contract",
              ok: false,
              severity: "warn",
              blocking: false,
              message: "opencode.json usa el launcher repo-scoped gestionado",
              detail:
                contractState === "legacy"
                  ? "binding legacy detectado; usa npx/PATH en vez del launcher portable"
                  : "falta `command: [\"node\", \".harness/runtime/launch-global-runtime.mjs\", ...]`",
              detectedAt,
              fixCommand: formatLocalRepairCommand(repoPath, ["opencode"]),
              repairAction: repoUpdateAction(["opencode"]),
            }),
          );
        }
        if (server) {
          pushClientIdentityDiagnostic(diagnostics, {
            code: "bindings.repo.opencode.identity",
            detectedAt,
            expectedClient: "opencode",
            actualClient: extractClientArg(command),
            message: "opencode.json declara --client opencode",
            fixCommand: formatLocalRepairCommand(repoPath, ["opencode"]),
            repairAction: repoUpdateAction(["opencode"]),
          });
        }
      } catch {
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.opencode.explicit",
            ok: false,
            severity: "error",
            blocking: true,
            message: "opencode.json válido para harness",
            detail: "JSON inválido",
            detectedAt,
            fixHint:
              "Corrige .opencode/opencode.json manualmente o vuelve a correr repair para regenerar el scaffold si prefieres eliminarlo primero.",
          }),
        );
      }
    }

    const vscodeConfigPath = path.join(repoPath, ".vscode/mcp.json");
    if (
      shouldInspectHealthClient("vscode", expectedHealthClients) &&
      await fileExists(vscodeConfigPath)
    ) {
      try {
        const raw = await readFile(vscodeConfigPath, "utf8");
        const parsed = parseJsonc(raw) as {
          servers?: Record<string, { command?: unknown; args?: unknown }>;
        };
        const server = parsed.servers?.["arufheim-harness"];
        const repoPathArg = extractRepoPathArg(server?.args);
        const contractState = classifyRepoLauncherContract(
          server?.command,
          server?.args,
        );
        const ok = repoPathArg !== null;
        repoScoped.vscode = ok && contractState === "managed";
        if (repoScoped.vscode && server) {
          clientBindings.vscode = {
            client: "vscode",
            key: "vscode",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(server),
            config_scope: currentConfigScope,
            detail: repoPathArg ?? undefined,
          };
        }
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.vscode.explicit",
            ok,
            severity: "error",
            blocking: true,
            message: "vscode mcp usa --repo-path explícito",
            detail: ok
              ? repoPathArg ?? undefined
              : "falta --repo-path en arufheim-harness",
            detectedAt,
            fixCommand: ok
              ? undefined
              : formatLocalRepairCommand(repoPath, ["copilot"]),
            repairAction: ok
              ? undefined
              : repoUpdateAction(["copilot"]),
          }),
        );
        if (server && ok && contractState !== "managed") {
          diagnostics.push(
            createDiagnostic({
              code: "bindings.repo.vscode.runtime_contract",
              ok: false,
              severity: "warn",
              blocking: false,
              message: "vscode mcp usa el launcher repo-scoped gestionado",
              detail:
                contractState === "legacy"
                  ? "binding legacy detectado; usa npx/PATH en vez del launcher portable"
                  : "falta `command: \"node\"` con `.harness/runtime/launch-global-runtime.mjs` como primer argumento",
              detectedAt,
              fixCommand: formatLocalRepairCommand(repoPath, ["copilot"]),
              repairAction: repoUpdateAction(["copilot"]),
            }),
          );
        }
        if (server) {
          pushClientIdentityDiagnostic(diagnostics, {
            code: "bindings.repo.vscode.identity",
            detectedAt,
            expectedClient: "vscode",
            actualClient: extractClientArg(server.args),
            message: "vscode mcp declara --client vscode",
            fixCommand: formatLocalRepairCommand(repoPath, ["copilot"]),
            repairAction: repoUpdateAction(["copilot"]),
          });
        }
      } catch {
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.vscode.explicit",
            ok: false,
            severity: "error",
            blocking: true,
            message: "vscode mcp usa --repo-path explícito",
            detail: "JSON/JSONC inválido",
            detectedAt,
            fixHint:
              "Corrige .vscode/mcp.json manualmente; repair no sobrescribe un archivo JSONC inválido del usuario.",
          }),
        );
      }
    }

    const claudeProjectMcpPath = path.join(repoPath, ".mcp.json");
    if (
      shouldInspectHealthClient("claude_code", expectedHealthClients) &&
      await fileExists(claudeProjectMcpPath)
    ) {
      try {
        const raw = await readFile(claudeProjectMcpPath, "utf8");
        const parsed = JSON.parse(raw) as {
          mcpServers?: Record<string, { command?: unknown; args?: unknown }>;
        };
        const server = parsed.mcpServers?.["arufheim-harness"];
        const repoPathArg = extractRepoPathArg(server?.args);
        const contractState = classifyRepoLauncherContract(
          server?.command,
          server?.args,
        );
        const ok = repoPathArg !== null;
        repoScoped.claude = ok && contractState === "managed";
        if (repoScoped.claude && server) {
          clientBindings.claude_code = {
            client: "claude-code",
            key: "claude_code",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(server),
            config_scope: currentConfigScope,
            detail: repoPathArg ?? undefined,
          };
        }
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.claude.explicit",
            ok,
            severity: "error",
            blocking: true,
            message: "claude project mcp usa --repo-path explícito",
            detail: ok
              ? repoPathArg ?? undefined
              : "falta --repo-path en arufheim-harness",
            detectedAt,
            fixCommand: ok
              ? undefined
              : formatLocalRepairCommand(repoPath, ["claude"]),
            repairAction: ok
              ? undefined
              : repoUpdateAction(["claude"]),
          }),
        );
        if (server && ok && contractState !== "managed") {
          diagnostics.push(
            createDiagnostic({
              code: "bindings.repo.claude.runtime_contract",
              ok: false,
              severity: "warn",
              blocking: false,
              message: "claude project mcp usa el launcher repo-scoped gestionado",
              detail:
                contractState === "legacy"
                  ? "binding legacy detectado; usa npx/PATH en vez del launcher portable"
                  : "falta `command: \"node\"` con `.harness/runtime/launch-global-runtime.mjs` como primer argumento",
              detectedAt,
              fixCommand: formatLocalRepairCommand(repoPath, ["claude"]),
              repairAction: repoUpdateAction(["claude"]),
            }),
          );
        }
        if (server) {
          pushClientIdentityDiagnostic(diagnostics, {
            code: "bindings.repo.claude.identity",
            detectedAt,
            expectedClient: "claude-code",
            actualClient: extractClientArg(server.args),
            message: "claude project mcp declara --client claude-code",
            fixCommand: formatLocalRepairCommand(repoPath, ["claude"]),
            repairAction: repoUpdateAction(["claude"]),
          });
        }
      } catch {
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.claude.explicit",
            ok: false,
            severity: "error",
            blocking: true,
            message: "claude project mcp usa --repo-path explícito",
            detail: "JSON inválido",
            detectedAt,
            fixHint:
              "Corrige .mcp.json manualmente; repair no sobrescribe un archivo JSON inválido del usuario.",
          }),
        );
      }
    }

    const codexProjectConfigPath = path.join(repoPath, ".codex/config.toml");
    if (
      shouldInspectHealthClient("codex", expectedHealthClients) &&
      await fileExists(codexProjectConfigPath)
    ) {
      try {
        const raw = await readFile(codexProjectConfigPath, "utf8");
        const section = readCodexHarnessSection(raw);
        const repoPathArg = section ? readCodexRepoPathArg(section) : null;
        const contractState = section
          ? classifyCodexRepoLauncherContract(section)
          : "invalid";
        const ok = repoPathArg !== null;
        repoScoped.codex = ok && contractState === "managed";
        if (repoScoped.codex && section) {
          clientBindings.codex = {
            client: "codex",
            key: "codex",
            repo_path: repoPath,
            source: "repo_scoped",
            verification_mode: "config_sufficient",
            signature: buildBindingSignature(section.trim()),
            config_scope: currentConfigScope,
            detail: repoPathArg ?? undefined,
          };
        }
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.codex.explicit",
            ok,
            severity: "error",
            blocking: true,
            message: "codex project config usa --repo-path explícito",
            detail: ok
              ? repoPathArg ?? undefined
              : "falta --repo-path en mcp_servers.arufheim-harness",
            detectedAt,
            fixCommand: ok
              ? undefined
              : formatLocalRepairCommand(repoPath, ["codex"]),
            repairAction: ok
              ? undefined
              : repoUpdateAction(["codex"]),
          }),
        );
        if (section && ok && contractState !== "managed") {
          diagnostics.push(
            createDiagnostic({
              code: "bindings.repo.codex.runtime_contract",
              ok: false,
              severity: "warn",
              blocking: false,
              message: "codex project config usa el launcher repo-scoped gestionado",
              detail:
                contractState === "legacy"
                  ? "binding legacy detectado; usa npx/PATH en vez del launcher portable"
                  : "falta `command = \"node\"` con `.harness/runtime/launch-global-runtime.mjs` como primer argumento",
              detectedAt,
              fixCommand: formatLocalRepairCommand(repoPath, ["codex"]),
              repairAction: repoUpdateAction(["codex"]),
            }),
          );
        }
        if (section) {
          pushClientIdentityDiagnostic(diagnostics, {
            code: "bindings.repo.codex.identity",
            detectedAt,
            expectedClient: "codex",
            actualClient: readCodexClientArg(section),
            message: "codex project config declara --client codex",
            fixCommand: formatLocalRepairCommand(repoPath, ["codex"]),
            repairAction: repoUpdateAction(["codex"]),
          });
        }
      } catch {
        diagnostics.push(
          createDiagnostic({
            code: "bindings.repo.codex.explicit",
            ok: false,
            severity: "error",
            blocking: true,
            message: "codex project config usa --repo-path explícito",
            detail: "TOML inválido o no legible",
            detectedAt,
            fixHint:
              "Corrige .codex/config.toml manualmente; repair no sobrescribe un archivo TOML inválido del usuario.",
          }),
        );
      }
    }

    const globalJsonChecks = [
      {
        code: "bindings.global.vscode.unambiguous",
        message: "VS Code global harness resuelve el repo actual",
        filePath: getVSCodeGlobalMcpPath(),
        rootKey: "servers",
        key: "vscode" as const,
        repoOverride: () => repoScoped.vscode,
        repairClients: ["vscode"] as GlobalClientId[],
      },
      {
        code: "bindings.global.claude_desktop.unambiguous",
        message: "Claude Desktop global harness resuelve el repo actual",
        filePath: getClaudeDesktopConfigPath(),
        rootKey: "mcpServers",
        key: "claude_desktop" as const,
        repoOverride: () => repoScoped.claude,
        repairClients: ["claude-desktop"] as GlobalClientId[],
      },
      {
        code: "bindings.global.claude_code.unambiguous",
        message: "Claude Code global harness resuelve el repo actual",
        filePath: getClaudeCodeConfigPath(),
        rootKey: "mcpServers",
        key: "claude_code" as const,
        repoOverride: () => repoScoped.claude,
        repairClients: ["claude-code"] as GlobalClientId[],
      },
    ];

    for (const check of globalJsonChecks) {
      const expectedForRepo = shouldInspectHealthClient(
        check.key,
        expectedHealthClients,
      );
      if (!expectedForRepo) {
        continue;
      }
      if (check.repoOverride()) {
        if (await fileExists(check.filePath)) {
          globalBindings[check.key] = {
            state: "shadowed",
            detail: "override repo-scoped presente; el binding global no bloquea este repo",
          };
          diagnostics.push(
            createDiagnostic({
              code: check.code,
              ok: true,
              message: check.message,
              detail:
                "override repo-scoped presente; el binding global no bloquea este repo",
              detectedAt,
            }),
          );
        }
        continue;
      }
      if (!(await fileExists(check.filePath))) {
        continue;
      }

      try {
        const raw = await readFile(check.filePath, "utf8");
        const parsed = parseJsonc(raw) as Record<string, unknown>;
        const rootObject = parsed[check.rootKey] as
          | Record<string, { command?: unknown; args?: unknown }>
          | undefined;
        const server = rootObject?.["arufheim-harness"];

        if (!server) {
          globalBindings[check.key] = { state: "absent" };
          continue;
        }

        const repoPathArg = extractRepoPathArg(server.args);
        const expectedClient = fromHealthClientKey(check.key);
        const contractState = classifyManagedGlobalShimContract(server.command);
        if (contractState === "legacy") {
          globalBindings[check.key] = {
            state: "legacy",
            detail: "binding legacy detectado; usa npx/PATH en vez del shim gestionado",
          };
          diagnostics.push(
            createDiagnostic({
              code: check.code,
              ok: false,
              severity: "warn",
              blocking: false,
              message: check.message,
              detail: globalBindings[check.key].detail,
              detectedAt,
              fixCommand: formatGlobalRepairCommand(check.repairClients),
              repairAction: globalClientAction(check.repairClients),
            }),
          );
          pushClientIdentityDiagnostic(diagnostics, {
            code: `${check.code}.identity`,
            detectedAt,
            expectedClient,
            actualClient: extractClientArg(server.args),
            message: `${check.message} declara --client ${expectedClient}`,
            fixCommand: formatGlobalRepairCommand(check.repairClients),
            repairAction: globalClientAction(check.repairClients),
          });
          continue;
        }
        const bindingClass = classifyRepoBinding(check.key, repoPathArg, repoPath);
        const detectedBinding: DetectedClientBinding = {
          client: expectedClient,
          key: check.key,
          repo_path: repoPath,
          source: "global",
          verification_mode:
            bindingClass === "assumed" ? "runtime_required" : "config_sufficient",
          signature: buildBindingSignature(server),
          config_scope: currentConfigScope,
          detail: repoPathArg ?? undefined,
        };
        const storedVerification = storedVerifications[expectedClient];
        if (bindingClass === "explicit" || bindingClass === "portable") {
          clientBindings[check.key] = detectedBinding;
          globalBindings[check.key] = {
            state: bindingClass === "portable" ? "portable" : "ok",
            detail: repoPathArg ?? undefined,
          };
          diagnostics.push(
            createDiagnostic({
              code: check.code,
              ok: true,
              message: check.message,
              detail: repoPathArg ?? undefined,
              detectedAt,
            }),
          );
          pushClientIdentityDiagnostic(diagnostics, {
            code: `${check.code}.identity`,
            detectedAt,
            expectedClient,
            actualClient: extractClientArg(server.args),
            message: `${check.message} declara --client ${expectedClient}`,
            fixCommand: formatGlobalRepairCommand(check.repairClients),
            repairAction: globalClientAction(check.repairClients),
          });
        } else if (bindingClass === "assumed" && repoPathArg !== null) {
          clientBindings[check.key] = detectedBinding;
          const verificationCurrent = isStoredVerificationCurrent(
            repoPath,
            detectedBinding,
            storedVerification,
          );
          globalBindings[check.key] = verificationCurrent
            ? {
                state: "verified",
                detail: `binding asumido validado por arranque real (${storedVerification?.verified_at ?? "sin timestamp"})`,
              }
            : {
                state: "assumed",
                detail: assumedBindingDetail(check.key, repoPathArg),
              };
          diagnostics.push(
            createDiagnostic({
              code: check.code,
              ok: verificationCurrent,
              severity: "warn",
              blocking: false,
              message: check.message,
              detail: verificationCurrent
                ? globalBindings[check.key].detail
                : globalBindings[check.key].detail,
              detectedAt,
              fixCommand:
                verificationCurrent || check.key !== "vscode"
                  ? undefined
                  : formatGlobalRepairCommand(check.repairClients),
              fixHint:
                verificationCurrent
                  ? undefined
                  : check.key === "vscode"
                    ? undefined
                    : "Valida manualmente `repo_path` en el cliente o prefiere un binding repo-scoped para este repo.",
              repairAction:
                verificationCurrent || check.key !== "vscode"
                  ? undefined
                  : globalClientAction(check.repairClients),
            }),
          );
          pushClientIdentityDiagnostic(diagnostics, {
            code: `${check.code}.identity`,
            detectedAt,
            expectedClient,
            actualClient: extractClientArg(server.args),
            message: `${check.message} declara --client ${expectedClient}`,
            fixCommand: formatGlobalRepairCommand(check.repairClients),
            repairAction: globalClientAction(check.repairClients),
          });
        } else {
          if (!expectedForRepo) {
            continue;
          }
          globalBindings[check.key] = {
            state: "ambiguous",
            detail:
              contractState !== "managed"
                ? "server global no usa el shim absoluto gestionado"
                : repoPathArg === null
                ? "server global sin --repo-path explícito"
                : `server global apunta a '${repoPathArg}' en vez de '${repoPath}' o un binding portable verificable`,
          };
          diagnostics.push(
            createDiagnostic({
              code: check.code,
              ok: false,
              severity: "error",
              blocking: true,
              message: check.message,
              detail: globalBindings[check.key].detail,
              detectedAt,
              fixCommand: formatGlobalRepairCommand(check.repairClients),
              repairAction: globalClientAction(check.repairClients),
            }),
          );
          pushClientIdentityDiagnostic(diagnostics, {
            code: `${check.code}.identity`,
            detectedAt,
            expectedClient,
            actualClient: extractClientArg(server.args),
            message: `${check.message} declara --client ${expectedClient}`,
            fixCommand: formatGlobalRepairCommand(check.repairClients),
            repairAction: globalClientAction(check.repairClients),
          });
        }
      } catch {
        if (!expectedForRepo) {
          continue;
        }
        globalBindings[check.key] = {
          state: "invalid",
          detail: "JSON/JSONC inválido",
        };
        diagnostics.push(
          createDiagnostic({
            code: check.code,
            ok: false,
            severity: "error",
            blocking: true,
            message: check.message,
            detail: "JSON/JSONC inválido",
            detectedAt,
            fixCommand: formatForcedGlobalRepairCommand(check.repairClients),
            fixHint:
              "Si quieres preservar el archivo roto y regenerar solo la entrada gestionada, usa --force-managed-global; si no, corrígelo manualmente.",
            repairAction: globalClientAction(check.repairClients),
          }),
        );
      }
    }

    const codexUserConfigPath = getCodexConfigPath();
    if (
      await fileExists(codexUserConfigPath)
    ) {
      const expectedForRepo = shouldInspectHealthClient(
        "codex",
        expectedHealthClients,
      );
      if (!expectedForRepo) {
        // El repo no espera Codex; ignoramos el binding global para no contaminar health/readiness.
      } else if (repoScoped.codex) {
        globalBindings.codex = {
          state: "shadowed",
          detail: "override repo-scoped presente; el binding global no bloquea este repo",
        };
        diagnostics.push(
          createDiagnostic({
            code: "bindings.global.codex.unambiguous",
            ok: true,
            message: "Codex global harness resuelve el repo actual",
            detail:
              "override repo-scoped presente; el binding global no bloquea este repo",
            detectedAt,
          }),
        );
      } else {
        try {
          const raw = await readFile(codexUserConfigPath, "utf8");
          const section = readCodexHarnessSection(raw);
          if (section) {
            const repoPathArg = readCodexRepoPathArg(section);
            const contractState = classifyManagedGlobalShimContract(
              readCodexCommand(section),
            );
            if (contractState === "legacy") {
              globalBindings.codex = {
                state: "legacy",
                detail: "binding legacy detectado; usa npx/PATH en vez del shim gestionado",
              };
              diagnostics.push(
                createDiagnostic({
                  code: "bindings.global.codex.unambiguous",
                  ok: false,
                  severity: "warn",
                  blocking: false,
                  message: "Codex global harness resuelve el repo actual",
                  detail: globalBindings.codex.detail,
                  detectedAt,
                  fixCommand: formatGlobalRepairCommand(["codex"]),
                  repairAction: globalClientAction(["codex"]),
                }),
              );
              pushClientIdentityDiagnostic(diagnostics, {
                code: "bindings.global.codex.unambiguous.identity",
                detectedAt,
                expectedClient: "codex",
                actualClient: readCodexClientArg(section),
                message: "Codex global harness declara --client codex",
                fixCommand: formatGlobalRepairCommand(["codex"]),
                repairAction: globalClientAction(["codex"]),
              });
            } else {
              const bindingClass = classifyRepoBinding("codex", repoPathArg, repoPath);
              const detectedBinding: DetectedClientBinding = {
                client: "codex",
                key: "codex",
                repo_path: repoPath,
                source: "global",
                verification_mode:
                  bindingClass === "assumed"
                    ? "runtime_required"
                    : "config_sufficient",
                signature: buildBindingSignature(section.trim()),
                config_scope: currentConfigScope,
                detail: repoPathArg ?? undefined,
              };
              if (bindingClass === "explicit" || bindingClass === "portable") {
                clientBindings.codex = detectedBinding;
                globalBindings.codex = {
                  state: bindingClass === "portable" ? "portable" : "ok",
                  detail: repoPathArg ?? undefined,
                };
                diagnostics.push(
                  createDiagnostic({
                    code: "bindings.global.codex.unambiguous",
                    ok: true,
                    message: "Codex global harness resuelve el repo actual",
                    detail: repoPathArg ?? undefined,
                    detectedAt,
                  }),
                );
                pushClientIdentityDiagnostic(diagnostics, {
                  code: "bindings.global.codex.unambiguous.identity",
                  detectedAt,
                  expectedClient: "codex",
                  actualClient: readCodexClientArg(section),
                  message: "Codex global harness declara --client codex",
                  fixCommand: formatGlobalRepairCommand(["codex"]),
                  repairAction: globalClientAction(["codex"]),
                });
              } else if (bindingClass === "assumed" && repoPathArg !== null) {
                clientBindings.codex = detectedBinding;
                const verificationCurrent = isStoredVerificationCurrent(
                  repoPath,
                  detectedBinding,
                  storedVerifications.codex,
                );
                globalBindings.codex = verificationCurrent
                  ? {
                      state: "verified",
                      detail: `binding asumido validado por arranque real (${storedVerifications.codex?.verified_at ?? "sin timestamp"})`,
                    }
                  : {
                      state: "assumed",
                      detail: assumedBindingDetail("codex", repoPathArg),
                    };
                diagnostics.push(
                  createDiagnostic({
                    code: "bindings.global.codex.unambiguous",
                    ok: verificationCurrent,
                    severity: "warn",
                    blocking: false,
                    message: "Codex global harness resuelve el repo actual",
                    detail: globalBindings.codex.detail,
                    detectedAt,
                    fixHint: verificationCurrent
                      ? undefined
                      :
                      "Valida manualmente `repo_path` en Codex o prefiere la config repo-scoped `.codex/config.toml`.",
                  }),
                );
                pushClientIdentityDiagnostic(diagnostics, {
                  code: "bindings.global.codex.unambiguous.identity",
                  detectedAt,
                  expectedClient: "codex",
                  actualClient: readCodexClientArg(section),
                  message: "Codex global harness declara --client codex",
                  fixCommand: formatGlobalRepairCommand(["codex"]),
                  repairAction: globalClientAction(["codex"]),
                });
              } else {
                globalBindings.codex = {
                  state: "ambiguous",
                  detail:
                    contractState !== "managed"
                      ? "server global no usa el shim absoluto gestionado"
                      : repoPathArg === null
                      ? "server global sin --repo-path explícito"
                      : `server global apunta a '${repoPathArg}' en vez de '${repoPath}' o un binding portable verificable`,
                };
                diagnostics.push(
                  createDiagnostic({
                    code: "bindings.global.codex.unambiguous",
                    ok: false,
                    severity: "error",
                    blocking: true,
                    message: "Codex global harness no es ambiguo",
                    detail: globalBindings.codex.detail,
                    detectedAt,
                    fixCommand: formatGlobalRepairCommand(["codex"]),
                    repairAction: globalClientAction(["codex"]),
                  }),
                );
                pushClientIdentityDiagnostic(diagnostics, {
                  code: "bindings.global.codex.unambiguous.identity",
                  detectedAt,
                  expectedClient: "codex",
                  actualClient: readCodexClientArg(section),
                  message: "Codex global harness declara --client codex",
                  fixCommand: formatGlobalRepairCommand(["codex"]),
                  repairAction: globalClientAction(["codex"]),
                });
              }
            }
          }
        } catch {
          globalBindings.codex = {
            state: "invalid",
            detail: "TOML inválido o no legible",
          };
          diagnostics.push(
            createDiagnostic({
              code: "bindings.global.codex.unambiguous",
              ok: false,
              severity: "error",
              blocking: true,
              message: "Codex global harness resuelve el repo actual",
              detail: "TOML inválido o no legible",
              detectedAt,
              fixCommand: formatForcedGlobalRepairCommand(["codex"]),
              fixHint:
                "Si quieres preservar el archivo roto y regenerar solo la entrada gestionada, usa --force-managed-global; si no, corrígelo manualmente.",
              repairAction: globalClientAction(["codex"]),
            }),
          );
        }
      }
    }
  }

  const copilotPath = path.join(repoPath, ".github/copilot-instructions.md");
  if (await fileExists(copilotPath)) {
    const content = await readFile(copilotPath, "utf8");
    const hasSection = content.includes("## Comunicación");
    diagnostics.push(
      createDiagnostic({
        code: "docs.copilot.communication",
        ok: hasSection,
        severity: "warn",
        blocking: false,
        message: "copilot-instructions tiene ## Comunicación",
        detail: hasSection ? undefined : "sección faltante",
        detectedAt,
        fixCommand: hasSection
          ? undefined
          : formatLocalRepairCommand(repoPath, ["copilot"]),
        repairAction: hasSection
          ? undefined
          : repoUpdateAction(["copilot"]),
      }),
    );
  }

  const claudePath = path.join(repoPath, "CLAUDE.md");
  if (await fileExists(claudePath)) {
    const content = await readFile(claudePath, "utf8");
    const hasSection = content.includes("## Comunicación");
    diagnostics.push(
      createDiagnostic({
        code: "docs.claude.communication",
        ok: hasSection,
        severity: "warn",
        blocking: false,
        message: "CLAUDE.md tiene ## Comunicación",
        detail: hasSection ? undefined : "sección faltante",
        detectedAt,
        fixCommand: hasSection
          ? undefined
          : formatLocalRepairCommand(repoPath, ["claude"]),
        repairAction: hasSection
          ? undefined
          : repoUpdateAction(["claude"]),
      }),
    );
  }

  const opencodeCommandPath = path.join(repoPath, ".opencode/commands/harness.md");
  if (await fileExists(opencodeCommandPath)) {
    const content = await readFile(opencodeCommandPath, "utf8");
    const hasStartup =
      content.includes("harness_status") && content.includes("startup_brief");
    diagnostics.push(
      createDiagnostic({
        code: "docs.opencode.startup_compact",
        ok: hasStartup,
        severity: "warn",
        blocking: false,
        message: "OpenCode command usa startup compacto",
        detail: hasStartup
          ? undefined
          : "faltan harness_status o startup_brief",
        detectedAt,
        fixCommand: hasStartup
          ? undefined
          : formatLocalRepairCommand(repoPath, ["opencode"]),
        repairAction: hasStartup
          ? undefined
          : repoUpdateAction(["opencode"]),
      }),
    );
  }

  return finalizeHealthSnapshot();

  async function finalizeHealthSnapshot(): Promise<HarnessHealthSnapshot> {
    const bindingStatus = computeBindingStatus({
      repoScoped,
      global: globalBindings,
    });
    const clientVerification = buildClientVerificationSnapshot(
      repoPath,
      clientBindings,
      storedVerifications,
      expectedHealthClients,
    );
    const alerts = diagnostics
      .map((diagnostic) => toAlert(diagnostic))
      .filter((alert): alert is HealthAlert => alert !== null);
    const clientReadiness = buildClientReadinessSnapshot({
      alerts,
      clientVerification,
      expectedClients: expectedHealthClients,
    });
    const doctorSummary = summarizeDiagnostics(diagnostics);
    const lastVerifiedAt = options.persist
      ? detectedAt
      : stored?.last_verified_at ?? null;
    const loopSummary = await readActiveLoopSummary(repoPath);
    const snapshot: HarnessHealthSnapshot = {
      repo_path: repoPath,
      workflow_layout: workflowPaths.layout,
      scaffold_layout: scaffoldLayout,
      archived_count: archivedCount,
      diagnostics,
      alerts,
      runtime_status: runtimeStatus,
      binding_status: bindingStatus,
      client_verification: clientVerification,
      client_readiness: clientReadiness,
      doctor_summary: doctorSummary,
      degraded_mode:
        alerts.length > 0 && alerts.every((alert) => !alert.blocking),
      last_verified_at: lastVerifiedAt,
      loop_summary: loopSummary,
    };

    if (options.persist) {
      await writeStoredHealthSnapshot(
        repoPath,
        snapshot,
        options.verifiedBy ?? "doctor",
        detectedAt,
      );
    }

    return snapshot;
  }
}

export async function readPersistedHarnessHealth(
  repoPath: string,
): Promise<
  Pick<
    HarnessHealthSnapshot,
    | "repo_path"
    | "workflow_layout"
    | "scaffold_layout"
    | "alerts"
    | "runtime_status"
    | "binding_status"
    | "client_verification"
    | "client_readiness"
    | "doctor_summary"
    | "degraded_mode"
    | "last_verified_at"
    | "archived_count"
  >
  | null
> {
  repoPath = normalizeRepoPath(repoPath);
  const stored = await readStoredHealthSnapshot(repoPath);
  if (!stored || !(await isStoredHealthSnapshotFresh(repoPath, stored))) {
    return null;
  }
  const scaffoldState = await readExpectedLocalScaffoldState(repoPath);
  const expectedHealthClients = deriveExpectedHealthClients(
    scaffoldState.clients,
  );
  const runtimeStatus =
    stored.runtime_status &&
    typeof (stored.runtime_status as { runtime_artifact?: unknown }).runtime_artifact ===
      "object" &&
    typeof (stored.runtime_status as { runtime_source?: unknown }).runtime_source ===
      "object"
      ? stored.runtime_status
      : await evaluateManagedGlobalRuntimeStatus({
          verifiedAt: stored.last_verified_at,
        });

  return {
    repo_path: repoPath,
    workflow_layout: stored.workflow_layout,
    scaffold_layout: stored.scaffold_layout ?? scaffoldState.layout,
    archived_count: stored.archived_count ?? 0,
    alerts: stored.alerts,
    runtime_status: runtimeStatus,
    binding_status: stored.binding_status,
    client_verification: stored.client_verification,
    client_readiness:
      stored.client_readiness ??
      buildClientReadinessSnapshot({
        alerts: stored.alerts,
        clientVerification: stored.client_verification,
        expectedClients: expectedHealthClients,
      }),
    doctor_summary: stored.doctor_summary,
    degraded_mode:
      stored.alerts.length > 0 && stored.alerts.every((alert) => !alert.blocking),
    last_verified_at: stored.last_verified_at,
  };
}

export async function recordRuntimeClientVerification(input: {
  repoPath: string;
  clientId: HarnessClientId;
  configScope: ConfigScope;
}): Promise<void> {
  const repoPath = normalizeRepoPath(input.repoPath);
  const binding = await detectRuntimeBinding(
    repoPath,
    input.clientId,
    input.configScope,
  );
  if (!binding) {
    return;
  }

  await writeStoredClientVerification(repoPath, {
    client: input.clientId,
    repo_path: binding.repo_path,
    config_scope: input.configScope,
    verified_at: new Date().toISOString(),
    binding_scope: binding.source,
    binding_signature: binding.signature,
  });
}

export async function recordDeterministicClientVerification(input: {
  repoPath: string;
  clientId: HarnessClientId;
  configScope: ConfigScope;
}): Promise<boolean> {
  const repoPath = normalizeRepoPath(input.repoPath);
  const binding = await detectRuntimeBinding(
    repoPath,
    input.clientId,
    input.configScope,
  );
  if (!binding || binding.verification_mode !== "config_sufficient") {
    return false;
  }

  await writeStoredClientVerification(repoPath, {
    client: input.clientId,
    repo_path: binding.repo_path,
    config_scope: input.configScope,
    verified_at: new Date().toISOString(),
    binding_scope: binding.source,
    binding_signature: binding.signature,
  });
  return true;
}

export function formatHealthBrief(snapshot: HarnessHealthSnapshot): string {
  const summary = snapshot.doctor_summary;
  if (summary.status === "ok") {
    return "ok";
  }
  if (summary.status === "degraded") {
    return `degraded (${summary.warn} warn)`;
  }
  return `error (${summary.error} error, ${summary.blocking} blocking)`;
}

export function getHealthClientLabel(key: keyof ClientReadinessSnapshot): string {
  return HEALTH_CLIENT_LABELS[key];
}

export function listClientReadinessEntries(
  snapshot: ClientReadinessSnapshot,
): Array<{
  client: keyof ClientReadinessSnapshot;
  label: string;
  status: ClientReadinessStatus;
}> {
  return HEALTH_CLIENT_ORDER.map((client) => ({
    client,
    label: HEALTH_CLIENT_LABELS[client],
    status: snapshot[client],
  }));
}

export function formatClientReadinessBrief(
  snapshot: ClientReadinessSnapshot,
): string {
  return HEALTH_CLIENT_ORDER.map((client) => `${client}=${snapshot[client].state}`).join(" ");
}

export function collectRepairActions(
  snapshot: HarnessHealthSnapshot,
  mode: "local" | "global",
): RepairAction[] {
  const actions = new Map<string, RepairAction>();

  for (const diagnostic of snapshot.diagnostics) {
    const action = diagnostic.repair_action;
    if (!action) {
      continue;
    }
    if (mode === "local" && action.kind !== "repo_update") {
      continue;
    }
    if (mode === "global" && action.kind !== "global_clients") {
      continue;
    }

    const key = action.kind;
    const existing = actions.get(key);
    if (!existing) {
      actions.set(key, {
        kind: action.kind,
        clients: [...action.clients],
      });
      continue;
    }

    const merged = Array.from(
      new Set([
        ...existing.clients,
        ...action.clients,
      ]),
    ) as Array<InitTarget | GlobalClientId>;
    actions.set(key, {
      kind: existing.kind,
      clients: merged,
    });
  }

  return Array.from(actions.values());
}
