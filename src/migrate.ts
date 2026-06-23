import { access, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseHarnessConfigDocument } from "./config.js";
import { evaluateHarnessHealth, formatHealthBrief } from "./health.js";
import {
  readInitRepoPath,
  renderFullSharedAssetFiles,
  renderThinLocalWrapperFiles,
  resolveTemplateTestingContext,
  runInit,
  type InitTarget,
} from "./init.js";
import { inferScaffoldLayout } from "./scaffold-layout.js";
import { resolveWorkflowPaths } from "./workflow.js";

type MigrationAction =
  | "prune"
  | "preserved_override"
  | "replace_wrapper"
  | "create_wrapper";

interface MigrationEntry {
  path: string;
  action: MigrationAction;
  detail: string;
}

export async function runMigrate(argv: string[] = []): Promise<void> {
  const to = readToArg(argv);
  if (to !== "thin") {
    throw new Error("Usage: arufheim-harness migrate --to thin [--repo-path <ruta>] [--dry-run] [--json]");
  }

  const repoPath = readInitRepoPath(argv);
  const dryRun = argv.includes("--dry-run");
  const json = argv.includes("--json");
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const testingContext = await resolveTemplateTestingContext(repoPath);
  const fromLayout = await inferScaffoldLayout(repoPath);
  const fullAssets = renderFullSharedAssetFiles(workflowPaths, testingContext);
  const thinWrappers = renderThinLocalWrapperFiles(workflowPaths, testingContext);
  const entries = await buildMigrationEntries(repoPath, fullAssets, thinWrappers);
  const targets = await detectInitTargets(repoPath);

  if (!dryRun) {
    for (const target of targets) {
      await runInit({
        repoPath,
        update: true,
        target,
        layout: "thin",
      });
    }

    for (const entry of entries) {
      if (entry.action !== "prune") {
        continue;
      }
      await rm(path.join(repoPath, entry.path), { force: true });
    }

    await removeEmptyManagedDirs(repoPath);
  }

  const health = dryRun
    ? null
    : await evaluateHarnessHealth(repoPath, {
        persist: true,
        verifiedBy: "repair",
      });

  const result = {
    repo_path: repoPath,
    from_layout: fromLayout,
    to_layout: "thin",
    dry_run: dryRun,
    targets,
    entries,
    summary: {
      prune: entries.filter((entry) => entry.action === "prune").length,
      preserved_override: entries.filter(
        (entry) => entry.action === "preserved_override",
      ).length,
      replace_wrapper: entries.filter(
        (entry) => entry.action === "replace_wrapper",
      ).length,
      create_wrapper: entries.filter((entry) => entry.action === "create_wrapper")
        .length,
    },
    health:
      health === null
        ? null
        : {
            status: health.doctor_summary.status,
            brief: formatHealthBrief(health),
            scaffold_layout: health.scaffold_layout,
          },
  };

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  const lines = [
    "",
    "migrate summary",
    "",
    `  repo: ${result.repo_path}`,
    `  from: ${result.from_layout}`,
    `  to: ${result.to_layout}`,
    `  dry_run: ${dryRun ? "yes" : "no"}`,
    `  targets: ${targets.join(", ")}`,
    `  prune: ${result.summary.prune}`,
    `  preserved_override: ${result.summary.preserved_override}`,
    `  replace_wrapper: ${result.summary.replace_wrapper}`,
    `  create_wrapper: ${result.summary.create_wrapper}`,
  ];

  if (health) {
    lines.push(`  health: ${result.health?.brief}`);
  }

  if (entries.length > 0) {
    lines.push("", "changes");
    for (const entry of entries) {
      lines.push(`  - ${entry.action}: ${entry.path}`);
      lines.push(`      detail: ${entry.detail}`);
    }
  }

  lines.push("");
  process.stdout.write(lines.join("\n") + "\n");
}

async function buildMigrationEntries(
  repoPath: string,
  fullAssets: Record<string, string>,
  thinWrappers: Record<string, string>,
): Promise<MigrationEntry[]> {
  const entries: MigrationEntry[] = [];

  for (const [relativePath, expected] of Object.entries(fullAssets)) {
    const absolutePath = path.join(repoPath, relativePath);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    const current = await readFile(absolutePath, "utf8");
    if (normalizeManagedContent(current) === normalizeManagedContent(expected)) {
      entries.push({
        path: relativePath,
        action: "prune",
        detail: "asset full gestionado; seguro de podar al migrar a thin",
      });
      continue;
    }

    entries.push({
      path: relativePath,
      action: "preserved_override",
      detail: "contenido local difiere del scaffold gestionado; se preserva",
    });
  }

  for (const [relativePath, expected] of Object.entries(thinWrappers)) {
    const absolutePath = path.join(repoPath, relativePath);
    if (!(await fileExists(absolutePath))) {
      entries.push({
        path: relativePath,
        action: "create_wrapper",
        detail: "wrapper thin faltante; se materializa durante la migración",
      });
      continue;
    }

    const current = await readFile(absolutePath, "utf8");
    if (normalizeManagedContent(current) !== normalizeManagedContent(expected)) {
      entries.push({
        path: relativePath,
        action: "replace_wrapper",
        detail: "se reconcilia al wrapper thin gestionado",
      });
    }
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function detectInitTargets(repoPath: string): Promise<InitTarget[]> {
  const configPath = path.join(repoPath, "harness.config.json");
  if (await fileExists(configPath)) {
    try {
      const raw = await readFile(configPath, "utf8");
      const parsed = parseHarnessConfigDocument(JSON.parse(raw));
      const clients = parsed.scaffold?.localClients ?? [];
      return normalizeTargets(
        clients.map((client) => {
          if (client === "claude") return "claude";
          if (client === "copilot") return "copilot";
          if (client === "opencode") return "opencode";
          return "codex";
        }),
      );
    } catch {
      // fall through to file detection
    }
  }

  const detected: InitTarget[] = [];
  if (await fileExists(path.join(repoPath, ".codex/config.toml"))) {
    detected.push("codex");
  }
  if (await fileExists(path.join(repoPath, ".mcp.json"))) {
    detected.push("claude");
  }
  if (await fileExists(path.join(repoPath, ".vscode/mcp.json"))) {
    detected.push("copilot");
  }
  if (await fileExists(path.join(repoPath, ".opencode/opencode.json"))) {
    detected.push("opencode");
  }

  return normalizeTargets(detected.length > 0 ? detected : ["all"]);
}

function normalizeTargets(targets: InitTarget[]): InitTarget[] {
  if (targets.includes("all")) {
    return ["all"];
  }

  const unique = new Set(targets);
  const order: InitTarget[] = ["codex", "copilot", "claude", "opencode"];
  return order.filter((target) => unique.has(target));
}

async function removeEmptyManagedDirs(repoPath: string): Promise<void> {
  const candidates = [
    ".harness-docs",
    ".github/prompts",
    ".claude/agents",
    ".claude/commands",
    ".opencode/commands",
  ];

    for (const relativeDir of candidates) {
      const absoluteDir = path.join(repoPath, relativeDir);
      if (!(await fileExists(absoluteDir))) {
        continue;
      }
      const entries = await readdir(absoluteDir);
      if (entries.length === 0) {
        await rm(absoluteDir, { recursive: true, force: true });
      }
    }
}

function normalizeManagedContent(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

function readToArg(argv: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--to") {
      const next = argv[index + 1];
      return typeof next === "string" ? next : null;
    }
    if (value.startsWith("--to=")) {
      return value.slice("--to=".length);
    }
  }
  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
