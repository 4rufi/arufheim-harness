import type { GlobalClientId, InitTarget } from "./init.js";

const DEFAULT_LOCAL_TARGETS: InitTarget[] = ["all"];
const DEFAULT_GLOBAL_CLIENTS: GlobalClientId[] = [
  "vscode",
  "claude-desktop",
  "claude-code",
  "codex",
];

export function readClientsArg(argv: string[]): string[] | null {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--clients") {
      return splitClientList(argv[index + 1] ?? "");
    }
    if (value.startsWith("--clients=")) {
      return splitClientList(value.slice("--clients=".length));
    }
  }

  return null;
}

export function parseLocalClientSelection(argv: string[]): InitTarget[] {
  const raw = readClientsArg(argv);
  if (!raw || raw.length === 0) {
    return DEFAULT_LOCAL_TARGETS;
  }

  const selected = new Set<InitTarget>();
  for (const token of raw) {
    const normalized = token.toLowerCase();
    if (normalized === "all") {
      return ["all"];
    }
    if (
      normalized === "claude" ||
      normalized === "copilot" ||
      normalized === "opencode" ||
      normalized === "codex"
    ) {
      selected.add(normalized);
      continue;
    }
    throw new Error(
      `Unsupported local client '${token}'. Use claude, codex, copilot, opencode or all.`,
    );
  }

  return selected.size > 0 ? Array.from(selected) : DEFAULT_LOCAL_TARGETS;
}

export function parseGlobalClientSelection(argv: string[]): GlobalClientId[] {
  const raw = readClientsArg(argv);
  if (!raw || raw.length === 0) {
    return DEFAULT_GLOBAL_CLIENTS;
  }

  const selected = new Set<GlobalClientId>();
  for (const token of raw) {
    const normalized = token.toLowerCase();
    if (normalized === "all") {
      return DEFAULT_GLOBAL_CLIENTS;
    }
    if (normalized === "copilot" || normalized === "vscode") {
      selected.add("vscode");
      continue;
    }
    if (normalized === "claude") {
      selected.add("claude-desktop");
      selected.add("claude-code");
      continue;
    }
    if (normalized === "claude-desktop" || normalized === "claude-code") {
      selected.add(normalized);
      continue;
    }
    if (normalized === "codex") {
      selected.add("codex");
      continue;
    }
    if (normalized === "opencode") {
      throw new Error(
        "OpenCode is repo-scoped only. Use setup/repair without --global for that client.",
      );
    }
    throw new Error(
      `Unsupported global client '${token}'. Use copilot|vscode, claude, claude-desktop, claude-code, codex or all.`,
    );
  }

  return selected.size > 0 ? Array.from(selected) : DEFAULT_GLOBAL_CLIENTS;
}

function splitClientList(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}
