import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  ensureConfigFile,
  getGlobalConfigPath,
  parseHarnessConfigDocument,
} from "./config.js";
import { RISK_CLASSES } from "./policy.js";

type Scope = "global" | "repo";

const SETTABLE_KEYS = new Set([
  "repoPath",
  "allowedCommands",
  "ignored",
  "permissionPolicy.mode",
  "permissionPolicy.allowedTools",
  "permissionPolicy.allowedRisk",
  "agentRouting.defaultProvider",
  "agentRouting.effort",
  "agentRouting.complexityThreshold",
  "agentRouting.costStrategy",
  "agentRouting.showRouting",
  "agentRouting.autoProviderRouting",
  "agentRouting.taskRouting.architecture",
  "agentRouting.taskRouting.reasoning",
  "agentRouting.taskRouting.refactor",
  "agentRouting.taskRouting.review",
  "agentRouting.taskRouting.tooling",
  "agentRouting.taskRouting.frontend",
  "agentRouting.taskRouting.debug",
  "agentRouting.taskRouting.pr",
  "agentRouting.taskRouting.execution",
  "agentRouting.taskRouting.long_context",
  "agentRouting.taskRouting.general",
  "agentRouting.models.anthropic.fast",
  "agentRouting.models.anthropic.deep",
  "agentRouting.models.openai.fast",
  "agentRouting.models.openai.deep",
  "agentRouting.models.openai-codex.fast",
  "agentRouting.models.openai-codex.deep",
  "agentRouting.models.claude-code.fast",
  "agentRouting.models.claude-code.deep",
  "agentRouting.models.copilot-cli.fast",
  "agentRouting.models.copilot-cli.deep",
  "agentRouting.models.gemini-cli.fast",
  "agentRouting.models.gemini-cli.deep",
  "agentRouting.models.gemini-code-assist.fast",
  "agentRouting.models.gemini-code-assist.deep",
]);

const ARRAY_KEYS = new Set([
  "allowedCommands",
  "ignored",
  "permissionPolicy.allowedTools",
  "permissionPolicy.allowedRisk",
]);

export async function runConfigCommand(argv: string[]): Promise<void> {
  const sub = argv[0] ?? "help";
  const scope = readScope(argv.slice(1));
  const targetPath = getConfigPathForScope(scope);

  if (sub === "path") {
    process.stdout.write(`${targetPath}\n`);
    return;
  }

  if (sub === "init") {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await ensureConfigFile(targetPath);
    process.stdout.write(`Config ready at ${targetPath}\n`);
    return;
  }

  if (sub === "show") {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await ensureConfigFile(targetPath);
    const raw = await readFile(targetPath, "utf8");
    process.stdout.write(raw);
    return;
  }

  if (sub === "set") {
    const key = argv[1];
    const value = argv[2];
    if (!key || value === undefined) {
      throw new Error("Usage: arufheim-harness config set <key> <value> [--global|--repo]");
    }

    if (!SETTABLE_KEYS.has(key)) {
      throw new Error(`Unsupported key '${key}'. Run 'arufheim-harness config help' to see allowed keys.`);
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await ensureConfigFile(targetPath);

    const raw = await readFile(targetPath, "utf8");
    const parsed = parseHarnessConfigDocument(JSON.parse(raw));
    const next = structuredClone(parsed) as Record<string, unknown>;

    setByPath(next, key, parseValueForKey(key, value));

    const validated = parseHarnessConfigDocument(next);
    await writeFile(
      targetPath,
      JSON.stringify(validated, null, 2) + "\n",
      "utf8",
    );
    process.stdout.write(`Updated ${key} in ${targetPath}\n`);
    return;
  }

  if (sub === "help") {
    printConfigHelp();
    return;
  }

  throw new Error(`Unknown config subcommand '${sub}'. Use: path | init | show | set | help`);
}

function readScope(argv: string[]): Scope {
  if (argv.includes("--repo")) return "repo";
  return "global";
}

function getConfigPathForScope(scope: Scope): string {
  if (scope === "repo") {
    return path.resolve(process.cwd(), "harness.config.json");
  }
  return getGlobalConfigPath(process.env);
}

function setByPath(root: Record<string, unknown>, dottedPath: string, value: unknown): void {
  const parts = dottedPath.split(".");
  let current: Record<string, unknown> = root;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const segment = parts[index];
    const next = current[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

function coerceValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
  return raw;
}

function parseValueForKey(key: string, raw: string): unknown {
  if (!ARRAY_KEYS.has(key)) {
    return coerceValue(raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Key '${key}' expects a JSON array string. Example: ["value-a", "value-b"].`,
    );
  }

  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error(`Key '${key}' expects an array of strings.`);
  }

  if (
    key === "permissionPolicy.allowedRisk" &&
    parsed.some((entry) => !RISK_CLASSES.includes(entry as (typeof RISK_CLASSES)[number]))
  ) {
    throw new Error(
      `Key '${key}' only accepts risk classes ${RISK_CLASSES.join(", ")}.`,
    );
  }

  return parsed;
}

function printConfigHelp(): void {
  const lines = [
    "Usage:",
    "  arufheim-harness config path [--global|--repo]",
    "  arufheim-harness config init [--global|--repo]",
    "  arufheim-harness config show [--global|--repo]",
    "  arufheim-harness config set <key> <value> [--global|--repo]",
    "",
    "Defaults:",
    "  - Scope default is --global",
    "",
    "Examples:",
    "  arufheim-harness config init --global",
    "  arufheim-harness config set agentRouting.defaultProvider claude-code",
    "  arufheim-harness config set agentRouting.costStrategy quality_first",
    "  arufheim-harness config set agentRouting.taskRouting.frontend deep",
    '  arufheim-harness config set permissionPolicy.mode always_ask --repo',
    '  arufheim-harness config set allowedCommands \'["pnpm test","npm test"]\' --repo',
    '  arufheim-harness config set permissionPolicy.allowedRisk \'["R1","R2"]\' --repo',
  ];

  process.stdout.write(lines.join("\n") + "\n");
}
