import { access } from "node:fs/promises";
import path from "node:path";

export type ScaffoldLayout = "thin" | "full";

export const SHARED_DOC_TOPICS = [
  ["architecture", ".harness-docs/architecture.md"],
  ["conventions", ".harness-docs/conventions.md"],
  ["specs", ".harness-docs/specs.md"],
  ["specs_policy", ".harness-docs/specs_policy.md"],
  ["verification", ".harness-docs/verification.md"],
  ["model_interface", ".harness-docs/model_interface.md"],
  ["context_manager", ".harness-docs/context_manager.md"],
  ["execution_engine", ".harness-docs/execution_engine.md"],
  ["memory_system", ".harness-docs/memory_system.md"],
  ["orchestration", ".harness-docs/orchestration.md"],
  ["tool_catalog", ".harness-docs/tool_catalog.md"],
  ["observation_policy", ".harness-docs/observation_policy.md"],
  ["planning_model", ".harness-docs/planning_model.md"],
  ["budgets", ".harness-docs/budgets.md"],
  ["contract_versions", ".harness-docs/contract_versions.md"],
  ["frontend_adapters", ".harness-docs/frontend_adapters.md"],
  ["loop_contract", ".harness-docs/loop_contract.md"],
  ["checkpoints", "CHECKPOINTS.md"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

export const FULL_ONLY_RELATIVE_PATHS = [
  "CHECKPOINTS.md",
  "init.sh",
  ".harness-docs/architecture.md",
  ".harness-docs/conventions.md",
  ".harness-docs/specs.md",
  ".harness-docs/specs_policy.md",
  ".harness-docs/verification.md",
  ".harness-docs/model_interface.md",
  ".harness-docs/context_manager.md",
  ".harness-docs/execution_engine.md",
  ".harness-docs/memory_system.md",
  ".harness-docs/orchestration.md",
  ".harness-docs/tool_catalog.md",
  ".harness-docs/observation_policy.md",
  ".harness-docs/planning_model.md",
  ".harness-docs/budgets.md",
  ".harness-docs/contract_versions.md",
  ".harness-docs/frontend_adapters.md",
  ".harness-docs/loop_contract.md",
  ".github/prompts/leader.prompt.md",
  ".github/prompts/implementer.prompt.md",
  ".github/prompts/reviewer.prompt.md",
  ".github/prompts/spec_author.prompt.md",
  ".github/prompts/inbox_reader.prompt.md",
  ".github/prompts/scoper.prompt.md",
  ".claude/commands/harness.md",
  ".claude/agents/leader.md",
  ".claude/agents/implementer.md",
  ".claude/agents/reviewer.md",
  ".claude/agents/spec_author.md",
  ".claude/agents/inbox_reader.md",
  ".claude/agents/scoper.md",
  ".opencode/commands/harness.md",
] as const;

export const DETECTABLE_HARNESS_MARKERS = [
  "harness.config.json",
  ".harness/feature_list.json",
  ".harness/feature_history.json",
  ".harness/progress/current.md",
  ".harness/progress/history.md",
  ".harness/progress/README.md",
  ".codex/config.toml",
  ".mcp.json",
  ".vscode/mcp.json",
  ".opencode/opencode.json",
  "AGENTS.md",
] as const;

export function extractConfiguredScaffoldLayout(
  config:
    | {
        scaffold?: {
          layout?: unknown;
        };
      }
    | null
    | undefined,
): ScaffoldLayout | null {
  const value = config?.scaffold?.layout;
  return value === "thin" || value === "full" ? value : null;
}

export async function inferScaffoldLayout(
  repoPath: string,
  config?:
    | {
        scaffold?: {
          layout?: unknown;
        };
      }
    | null,
): Promise<ScaffoldLayout> {
  const configured = extractConfiguredScaffoldLayout(config);
  if (configured) {
    return configured;
  }

  for (const relativePath of FULL_ONLY_RELATIVE_PATHS) {
    if (await fileExists(path.join(repoPath, relativePath))) {
      return "full";
    }
  }

  return "thin";
}

export async function isDetectableHarnessRepo(repoPath: string): Promise<boolean> {
  for (const marker of DETECTABLE_HARNESS_MARKERS) {
    if (await fileExists(path.join(repoPath, marker))) {
      return true;
    }
  }

  return false;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
