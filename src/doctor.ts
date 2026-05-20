import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseFeatureListText, resolveWorkflowPaths } from "./workflow.js";

const HARNESS_CONFIG_VERSION = 1;

interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
  fix?: string;
}

const FILES = [
  {
    label: "AGENTS.md",
    path: "AGENTS.md",
    fix: "arufheim-harness init",
  },
  {
    label: "CHECKPOINTS.md",
    path: "CHECKPOINTS.md",
    fix: "arufheim-harness init",
  },
  {
    label: "harness.config.json",
    path: "harness.config.json",
    fix: "arufheim-harness init",
  },
  {
    label: ".harness-docs/architecture.md",
    path: ".harness-docs/architecture.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".harness-docs/conventions.md",
    path: ".harness-docs/conventions.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".harness-docs/specs.md",
    path: ".harness-docs/specs.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".harness-docs/specs_policy.md",
    path: ".harness-docs/specs_policy.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".harness-docs/verification.md",
    path: ".harness-docs/verification.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".github/copilot-instructions.md",
    path: ".github/copilot-instructions.md",
    fix: "arufheim-harness init",
  },
  {
    label: "CLAUDE.md",
    path: "CLAUDE.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".claude/commands/harness.md",
    path: ".claude/commands/harness.md",
    fix: "arufheim-harness init",
  },
  {
    label: ".vscode/mcp.json",
    path: ".vscode/mcp.json",
    fix: "arufheim-harness init",
  },
];

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

export async function runDoctor(repoPath?: string): Promise<void> {
  const root = repoPath ?? process.cwd();
  const checks: CheckResult[] = [];
  const workflowPaths = await resolveWorkflowPaths(root);

  // 1. File presence checks
  for (const file of FILES) {
    const abs = path.join(root, file.path);
    const ok = await fileExists(abs);
    checks.push({
      label: file.path,
      ok,
      detail: ok ? undefined : "archivo no encontrado",
      fix: ok ? undefined : file.fix,
    });
  }

  for (const file of [
    {
      label: workflowPaths.featureListPath,
      path: workflowPaths.featureListPath,
      fix: "arufheim-harness init",
    },
    {
      label: workflowPaths.featureHistoryPath,
      path: workflowPaths.featureHistoryPath,
      fix: "arufheim-harness init",
    },
    {
      label: path.posix.join(
        path.posix.dirname(workflowPaths.currentPath),
        "README.md",
      ),
      path: path.posix.join(
        path.posix.dirname(workflowPaths.currentPath),
        "README.md",
      ),
      fix: "arufheim-harness init",
    },
    {
      label: workflowPaths.currentPath,
      path: workflowPaths.currentPath,
      fix: "arufheim-harness init",
    },
    {
      label: workflowPaths.historyPath,
      path: workflowPaths.historyPath,
      fix: "arufheim-harness init",
    },
  ]) {
    const abs = path.join(root, file.path);
    const ok = await fileExists(abs);
    checks.push({
      label: file.path,
      ok,
      detail: ok ? undefined : "archivo no encontrado",
      fix: ok ? undefined : file.fix,
    });
  }

  checks.push({
    label: "workflow layout detectado",
    ok: true,
    detail: workflowPaths.layout,
  });

  // 1b. harness.config.json version check
  const configPath = path.join(root, "harness.config.json");
  if (await fileExists(configPath)) {
    try {
      const raw = await readFile(configPath, "utf8");
      const cfg = JSON.parse(raw) as { version?: number };
      if (cfg.version === undefined) {
        checks.push({
          label: "harness.config.json tiene version",
          ok: false,
          detail: "campo version ausente (schema desactualizado)",
          fix: 'arufheim-harness init --update o agrega manualmente "version": 1',
        });
      } else if (cfg.version < HARNESS_CONFIG_VERSION) {
        checks.push({
          label: "harness.config.json version",
          ok: false,
          detail: `v${cfg.version} → esperada v${HARNESS_CONFIG_VERSION}`,
          fix: "arufheim-harness init --update",
        });
      } else {
        checks.push({
          label: "harness.config.json version",
          ok: true,
          detail: `v${cfg.version}`,
        });
      }
    } catch {
      // JSON parse error already caught by feature_list check; skip here
    }
  }

  // 2. feature_list.json is valid JSON
  const featureListPath = path.join(root, workflowPaths.featureListPath);
  if (await fileExists(featureListPath)) {
    try {
      const raw = await readFile(featureListPath, "utf8");
      const features = parseFeatureListText(raw).features;

      checks.push({ label: "feature_list.json es JSON válido", ok: true });

      // 3. No more than one in_progress
      const inProgress = (
        features as Array<{ status?: string; name?: string }>
      ).filter((f) => f.status === "in_progress");

      if (inProgress.length > 1) {
        checks.push({
          label: "Solo una feature in_progress",
          ok: false,
          detail: `${inProgress.length} features en in_progress: ${inProgress.map((f) => f.name).join(", ")}`,
          fix: 'Cierra las extras con harness_update({ status: "done" }) o cambia su estado manualmente',
        });
      } else {
        checks.push({
          label: "Solo una feature in_progress",
          ok: true,
          detail:
            inProgress.length === 1
              ? `activa: ${inProgress[0].name}`
              : "ninguna activa",
        });
      }
    } catch {
      checks.push({
        label: "feature_list.json es JSON válido",
        ok: false,
        detail: "JSON inválido",
        fix: "Corrige el JSON manualmente o borra el archivo y corre arufheim-harness init",
      });
    }
  }

  const featureHistoryPath = path.join(root, workflowPaths.featureHistoryPath);
  if (await fileExists(featureHistoryPath)) {
    try {
      const raw = await readFile(featureHistoryPath, "utf8");
      JSON.parse(raw);
      checks.push({ label: "feature_history.json es JSON válido", ok: true });
    } catch {
      checks.push({
        label: "feature_history.json es JSON válido",
        ok: false,
        detail: "JSON inválido",
        fix: "Corrige el JSON manualmente o corre arufheim-harness init --update",
      });
    }
  }

  // 4. copilot-instructions has ## Comunicación section
  const copilotPath = path.join(root, ".github/copilot-instructions.md");
  if (await fileExists(copilotPath)) {
    const content = await readFile(copilotPath, "utf8");
    const hasCom = content.includes("## Comunicación");
    checks.push({
      label: "copilot-instructions tiene ## Comunicación",
      ok: hasCom,
      detail: hasCom ? undefined : "sección faltante",
      fix: hasCom ? undefined : "arufheim-harness init --update",
    });
  }

  // 5. CLAUDE.md has ## Comunicación section
  const claudePath = path.join(root, "CLAUDE.md");
  if (await fileExists(claudePath)) {
    const content = await readFile(claudePath, "utf8");
    const hasCom = content.includes("## Comunicación");
    checks.push({
      label: "CLAUDE.md tiene ## Comunicación",
      ok: hasCom,
      detail: hasCom ? undefined : "sección faltante",
      fix: hasCom ? undefined : "arufheim-harness init --update",
    });
  }

  // Print results
  console.log("\nharness doctor\n");
  let allOk = true;
  for (const c of checks) {
    const icon = c.ok ? "✓" : "✗";
    const detail = c.detail ? `  → ${c.detail}` : "";
    console.log(`  ${icon} ${c.label}${detail}`);
    if (!c.ok) {
      allOk = false;
      if (c.fix) console.log(`      fix: ${c.fix}`);
    }
  }

  if (allOk) {
    console.log("\n✓ Todo en orden.\n");
  } else {
    console.log("\n✗ Hay problemas que resolver. Ver fixes arriba.\n");
    process.exitCode = 1;
  }
}
