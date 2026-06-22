import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import type { HarnessClientId } from "./config.js";
import { recordDeterministicClientVerification } from "./health.js";
import {
  readExplicitInitRepoPath,
  runInit,
  type GlobalClientId,
  type InitTarget,
} from "./init.js";

export interface GlobalRepoContext {
  repoPath: string;
  source: "explicit" | "detected";
}

const HIDDEN_HARNESS_MARKERS = [
  "harness.config.json",
  ".harness/feature_list.json",
  ".harness/feature_history.json",
  ".harness/progress/current.md",
  ".harness/progress/history.md",
  ".harness/progress/README.md",
  ".harness-docs/specs.md",
  ".harness-docs/verification.md",
  "AGENTS.md",
] as const;

const ROOT_LEGACY_REQUIRED_MARKERS = ["feature_list.json"] as const;
const ROOT_LEGACY_COMPANION_MARKERS = [
  "harness.config.json",
  "feature_history.json",
  "progress/current.md",
  "progress/history.md",
  "progress/README.md",
  "docs/specs.md",
  "docs/verification.md",
  "AGENTS.md",
] as const;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDetectableHarnessRepo(repoPath: string): Promise<boolean> {
  for (const marker of HIDDEN_HARNESS_MARKERS) {
    if (await pathExists(path.join(repoPath, marker))) {
      return true;
    }
  }

  for (const marker of ROOT_LEGACY_REQUIRED_MARKERS) {
    if (!(await pathExists(path.join(repoPath, marker)))) {
      return false;
    }
  }

  for (const marker of ROOT_LEGACY_COMPANION_MARKERS) {
    if (await pathExists(path.join(repoPath, marker))) {
      return true;
    }
  }

  return false;
}

export async function resolveGlobalRepoContext(
  argv: string[],
): Promise<GlobalRepoContext | null> {
  const explicitRepoPath = readExplicitInitRepoPath(argv);
  if (explicitRepoPath) {
    return {
      repoPath: path.resolve(process.cwd(), explicitRepoPath),
      source: "explicit",
    };
  }

  const cwd = process.cwd();
  if (await isDetectableHarnessRepo(cwd)) {
    return {
      repoPath: cwd,
      source: "detected",
    };
  }

  return null;
}

export function derivePreferredRepoScopedGlobalClients(
  clientIds: GlobalClientId[],
): Array<Extract<GlobalClientId, "claude-code" | "codex">> {
  const selected = new Set<Extract<GlobalClientId, "claude-code" | "codex">>();
  for (const clientId of clientIds) {
    if (clientId === "claude-code" || clientId === "codex") {
      selected.add(clientId);
    }
  }
  return Array.from(selected);
}

function normalizeLocalTargets(targets: InitTarget[]): InitTarget[] {
  if (targets.includes("all")) {
    return ["all"];
  }

  const unique = new Set(targets);
  const order: InitTarget[] = ["codex", "copilot", "claude", "opencode"];
  return order.filter((target) => unique.has(target));
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

function mapGlobalClientToHarnessClient(clientId: GlobalClientId): HarnessClientId {
  if (
    clientId === "vscode" ||
    clientId === "claude-desktop" ||
    clientId === "claude-code" ||
    clientId === "codex"
  ) {
    return clientId;
  }

  throw new Error(`Unsupported global client '${clientId}'.`);
}

export function derivePreferredRepoScopedTargets(
  clientIds: GlobalClientId[],
): InitTarget[] {
  const targets = new Set<InitTarget>();
  for (const clientId of clientIds) {
    if (clientId === "claude-code") {
      targets.add("claude");
    }
    if (clientId === "codex") {
      targets.add("codex");
    }
  }

  return normalizeLocalTargets(Array.from(targets));
}

export async function primeDeterministicRepoVerifications(
  repoPath: string,
  clients: HarnessClientId[],
): Promise<void> {
  for (const client of clients) {
    await recordDeterministicClientVerification({
      repoPath,
      clientId: client,
      configScope: "repo",
    });
  }
}

export async function scaffoldPreferredRepoScopedBindings(
  repoPath: string,
  clientIds: GlobalClientId[],
  update: boolean,
): Promise<{
  preferredClients: Array<Extract<GlobalClientId, "claude-code" | "codex">>;
  targets: InitTarget[];
}> {
  const preferredClients = derivePreferredRepoScopedGlobalClients(clientIds);
  const targets = derivePreferredRepoScopedTargets(clientIds);

  for (const target of targets) {
    await runInit({
      repoPath,
      update,
      target,
    });
  }

  if (targets.length > 0) {
    await primeDeterministicRepoVerifications(
      repoPath,
      expandLocalHarnessClients(targets),
    );
  }

  return {
    preferredClients,
    targets,
  };
}

export async function primeDeterministicGlobalBindingsForRepo(
  repoPath: string,
  clientIds: GlobalClientId[],
): Promise<void> {
  const mapped = clientIds.map(mapGlobalClientToHarnessClient);
  await primeDeterministicRepoVerifications(repoPath, mapped);
}
