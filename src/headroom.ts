import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseHarnessConfigDocument,
  type HarnessTestingConfig,
} from "./config.js";
import { readLoopStatus, type LoopPhase } from "./loop.js";
import {
  buildTestingTemplateContext,
  recommendTestLayer,
  resolveRepoTestingGuidance,
  type RepoTestingGuidance,
} from "./testing.js";
import {
  parseFeatureListText,
  resolveWorkflowPaths,
  type WorkflowFeature,
} from "./workflow.js";

export interface HeadSummaryRefreshResult {
  path: string;
  content: string;
}

export async function refreshActiveHeadSummary(
  repoPath: string,
): Promise<HeadSummaryRefreshResult | null> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const featureListPath = path.join(repoPath, workflowPaths.featureListPath);
  const raw = await readFile(featureListPath, "utf8").catch(() => "");
  if (!raw) {
    return null;
  }

  const activeFeature =
    parseFeatureListText(raw).features.find(
      (feature) => feature.status === "in_progress",
    ) ?? null;
  if (!activeFeature) {
    return null;
  }

  const guidance = await resolveRepoTestingGuidance(
    repoPath,
    await readRepoTestingConfig(repoPath),
  );
  const loopStatus = await readLoopStatus(repoPath, activeFeature.id);
  const content = await renderHeadSummary(repoPath, activeFeature, guidance, {
    phase: loopStatus.loop_summary?.phase ?? "plan",
    attemptIndex: loopStatus.loop_summary?.attempt_index ?? 1,
    reviewRound: loopStatus.loop_summary?.review_round ?? 0,
    nextActor: loopStatus.loop_summary?.next_actor ?? "leader",
    lastError: loopStatus.loop?.last_error_signature ?? null,
    lastStrategyDelta: loopStatus.loop?.last_strategy_delta ?? null,
  });
  const relativePath = path.posix.join(
    path.posix.dirname(workflowPaths.currentPath),
    `head_${activeFeature.name}.md`,
  );
  const absolutePath = path.join(repoPath, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  return {
    path: relativePath,
    content,
  };
}

async function renderHeadSummary(
  repoPath: string,
  feature: WorkflowFeature,
  guidance: RepoTestingGuidance,
  loop: {
    phase: LoopPhase;
    attemptIndex: number;
    reviewRound: number;
    nextActor: string;
    lastError: string | null;
    lastStrategyDelta: string | null;
  },
): Promise<string> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  const progressDir = path.dirname(workflowPaths.currentPath);
  const specDir = path.join(repoPath, "specs", feature.name);
  const [specSummary, requirements, tasks, impl, review] = await Promise.all([
    readOptionalFile(path.join(specDir, "spec_summary.md")),
    readOptionalFile(path.join(specDir, "requirements.md")),
    readOptionalFile(path.join(specDir, "tasks.md")),
    readOptionalFile(path.join(repoPath, progressDir, `impl_${feature.name}.md`)),
    readOptionalFile(path.join(repoPath, progressDir, `review_${feature.name}.md`)),
  ]);
  const focusRequirements = selectFocusRequirements(requirements, tasks);
  const layer = recommendTestLayer(
    [feature.name, feature.description, specSummary].filter(Boolean).join(" "),
  );
  const testingContext = buildTestingTemplateContext(guidance);
  const filesToOpen = [
    "AGENTS.md",
    path.posix.join("specs", feature.name, "spec_summary.md"),
    path.posix.join("specs", feature.name, "tasks.md"),
    ".harness-docs/verification.md",
    impl
      ? path.posix.join(progressDir, `impl_${feature.name}.md`)
      : null,
    review
      ? path.posix.join(progressDir, `review_${feature.name}.md`)
      : null,
  ].filter((value): value is string => Boolean(value));

  const lines = [
    `# Head — ${feature.name}`,
    "",
    `- feature: ${feature.id}:${feature.name}`,
    `- goal: ${feature.description ?? feature.name}`,
    `- loop: phase=${loop.phase} attempt=${loop.attemptIndex} review=${loop.reviewRound} next=${loop.nextActor}`,
    `- requirements_focus: ${focusRequirements.length > 0 ? focusRequirements.join(", ") : "sin foco explícito"}`,
    `- test_layer: ${layer}`,
    `- fast_command: ${testingContext.fastCommand}`,
    `- integration_command: ${testingContext.integrationCommand}`,
    `- last_error: ${loop.lastError ?? "none"}`,
    `- last_strategy_delta: ${loop.lastStrategyDelta ?? "none"}`,
    `- next_action: ${nextActionForPhase(loop.phase, guidance)}`,
    "",
    "## Minimal Files",
    "",
    ...filesToOpen.map((file) => `- ${file}`),
    "",
    "## Testing Guidance",
    "",
    `- ${testingContext.fastLine}`,
    `- ${testingContext.integrationLine}`,
    `- ${testingContext.fallbackLine}`,
  ];

  return lines.join("\n").trimEnd() + "\n";
}

function selectFocusRequirements(
  requirementsText: string | null,
  tasksText: string | null,
): string[] {
  const fromUncheckedTasks = Array.from(
    new Set(
      (tasksText ?? "")
        .split(/\r?\n/)
        .filter((line) => /^\s*-\s*\[\s\]/.test(line))
        .flatMap((line) => line.match(/R\d+/g) ?? []),
    ),
  );
  if (fromUncheckedTasks.length > 0) {
    return fromUncheckedTasks;
  }

  return Array.from(
    new Set((requirementsText ?? "").match(/R\d+/g) ?? []),
  ).slice(0, 5);
}

function nextActionForPhase(
  phase: LoopPhase,
  guidance: RepoTestingGuidance,
): string {
  if (phase === "plan") {
    return "Aterriza el cambio en tasks discretas y fija la capa de test sin convertir el tooling en un preflight universal.";
  }
  if (phase === "execute") {
    return guidance.fastCommand
      ? `Si el cambio necesita feedback rápido y el repo ya lo declara, usa \`${guidance.fastCommand}\` directamente. No hagas chequeos de versiones/binarios salvo fallo real del primer comando.`
      : "Ejecuta el siguiente cambio y usa la suite rápida nativa del stack solo si realmente hace falta; si no, documenta la excepción.";
  }
  if (phase === "verify") {
    if (guidance.integrationCommand) {
      return `Corre la verificación rápida solo si aplica al cambio y luego ${guidance.integrationCommand} antes de pedir review.`;
    }
    return "Corre la verificación relevante del repo y captura evidencia ejecutable.";
  }
  if (phase === "review") {
    return "Revisa trazabilidad R<n> -> tests/verificación y confirma docs/CHANGELOG si aplica.";
  }
  if (phase === "analyze") {
    return "Analiza el fallo anterior, extrae strategy_delta y prepara el route-back.";
  }
  if (phase === "route_back") {
    return "Registra strategy_delta explícito y arranca el siguiente intento.";
  }
  if (phase === "blocked") {
    return "Escala el bloqueo real al humano con evidencia concreta.";
  }
  return "Cierra la feature y conserva la evidencia del intento.";
}

async function readRepoTestingConfig(
  repoPath: string,
): Promise<HarnessTestingConfig | undefined> {
  try {
    const raw = await readFile(path.join(repoPath, "harness.config.json"), "utf8");
    return parseHarnessConfigDocument(JSON.parse(raw)).testing;
  } catch {
    return undefined;
  }
}

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
