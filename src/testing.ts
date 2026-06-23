import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { HarnessTestingConfig } from "./config.js";

export type TestingCommandSource =
  | "config"
  | "script"
  | "tool"
  | "fallback"
  | "none";

export type HarnessTestLayer = "unit" | "contract" | "smoke";
export type HarnessPackageManager = "pnpm" | "npm" | "yarn";

export interface RepoTestingGuidance {
  fastCommand: string | null;
  integrationCommand: string | null;
  fastSource: TestingCommandSource;
  integrationSource: TestingCommandSource;
  jsTsProject: boolean;
  packageManager: HarnessPackageManager;
  fastRecommendation: string | null;
}

interface PackageJsonShape {
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface RepoTestingSignals {
  packageJson: PackageJsonShape | null;
  packageManager: HarnessPackageManager;
  scripts: Record<string, string>;
  jsTsProject: boolean;
  hasVitestConfig: boolean;
  hasJestConfig: boolean;
  hasVitestDependency: boolean;
  hasJestDependency: boolean;
}

const FAST_SCRIPT_CANDIDATES = [
  "test:unit",
  "unit",
  "test:fast",
  "vitest",
  "jest",
] as const;

const INTEGRATION_SCRIPT_CANDIDATES = [
  "verify",
  "smoke",
  "test:integration",
  "test:e2e",
  "e2e",
  "integration",
] as const;

const JS_TS_SIGNAL_FILES = [
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.js",
  "vitest.config.mjs",
  "jest.config.ts",
  "jest.config.js",
  "jest.config.mjs",
  "jest.config.cjs",
];

export async function resolveRepoTestingGuidance(
  repoPath: string,
  explicit: HarnessTestingConfig | undefined,
): Promise<RepoTestingGuidance> {
  const signals = await readRepoTestingSignals(repoPath);
  if (explicit?.fastCommand || explicit?.integrationCommand) {
    return {
      fastCommand: explicit.fastCommand?.trim() || null,
      integrationCommand: explicit.integrationCommand?.trim() || null,
      fastSource: explicit.fastCommand ? "config" : "none",
      integrationSource: explicit.integrationCommand ? "config" : "none",
      jsTsProject: signals.jsTsProject,
      packageManager: signals.packageManager,
      fastRecommendation:
        explicit.fastCommand || !signals.jsTsProject
          ? null
          : "Si este repo necesita suite rápida y es JS/TS, considera Vitest o fija testing.fastCommand.",
    };
  }

  const fastScript = selectFastScriptName(signals.scripts);
  const integrationScript = selectIntegrationScriptName(signals.scripts);

  if (fastScript || integrationScript) {
    return {
      fastCommand: fastScript
        ? buildScriptCommand(signals.packageManager, fastScript)
        : null,
      integrationCommand: integrationScript
        ? buildScriptCommand(signals.packageManager, integrationScript)
        : null,
      fastSource: fastScript ? "script" : "none",
      integrationSource: integrationScript ? "script" : "none",
      jsTsProject: signals.jsTsProject,
      packageManager: signals.packageManager,
      fastRecommendation:
        fastScript || !signals.jsTsProject
          ? null
          : "Si este repo necesita suite rápida y es JS/TS, considera Vitest o fija testing.fastCommand.",
    };
  }

  if (signals.hasVitestConfig || signals.hasVitestDependency) {
    return {
      fastCommand: buildBinaryCommand(signals.packageManager, "vitest", ["run"]),
      integrationCommand: null,
      fastSource: "tool",
      integrationSource: "none",
      jsTsProject: signals.jsTsProject,
      packageManager: signals.packageManager,
      fastRecommendation: null,
    };
  }

  if (signals.hasJestConfig || signals.hasJestDependency) {
    return {
      fastCommand: buildBinaryCommand(signals.packageManager, "jest", [
        "--runInBand",
      ]),
      integrationCommand: null,
      fastSource: "tool",
      integrationSource: "none",
      jsTsProject: signals.jsTsProject,
      packageManager: signals.packageManager,
      fastRecommendation: null,
    };
  }

  return {
    fastCommand: null,
    integrationCommand: null,
    fastSource: signals.jsTsProject ? "fallback" : "none",
    integrationSource: "none",
    jsTsProject: signals.jsTsProject,
    packageManager: signals.packageManager,
    fastRecommendation: signals.jsTsProject
      ? "Sin suite rápida detectable. Si el cambio necesita feedback rápido y este repo es JS/TS, considera Vitest."
      : "Sin suite rápida detectable. Usa la suite rápida nativa del stack solo si el cambio realmente la necesita.",
  };
}

export function mergeAllowedCommands(
  current: string[],
  guidance: RepoTestingGuidance,
): string[] {
  const next = new Set(current.map((command) => command.trim()).filter(Boolean));
  if (guidance.fastCommand) {
    next.add(guidance.fastCommand);
  }
  return Array.from(next);
}

export function buildTestingTemplateContext(guidance: RepoTestingGuidance): {
  fastCommand: string;
  integrationCommand: string;
  fastLine: string;
  integrationLine: string;
  fallbackLine: string;
} {
  const fastCommand = guidance.fastCommand ?? "no detectado";
  const integrationCommand =
    guidance.integrationCommand ?? "usa la verificación estándar del repo";
  return {
    fastCommand,
    integrationCommand,
    fastLine: guidance.fastCommand
      ? `Si el cambio necesita feedback rápido y este repo ya lo declara, usa \`${guidance.fastCommand}\`. No hace falta validar binarios o versiones antes; corre el primer comando real cuando aplique.`
      : guidance.fastRecommendation ??
        "No se detectó comando rápido; no inventes preflight y usa la suite rápida nativa del stack solo si el cambio la necesita.",
    integrationLine: guidance.integrationCommand
      ? `Si necesitas cierre de integración, usa \`${guidance.integrationCommand}\` después del cambio real; no como chequeo previo universal.`
      : "Si necesitas cierre de integración, usa `verify` si existe o la verificación estándar relevante del repo.",
    fallbackLine: guidance.fastRecommendation
      ? guidance.fastRecommendation
      : "La suite rápida ya está resuelta para este repo; úsala cuando el cambio lo amerite.",
  };
}

export function recommendTestLayer(text: string): HarnessTestLayer {
  const normalized = text.toLowerCase();
  if (
    /(setup|repair|release|binding|frontend|cliente|client|bootstrap|upgrade|migraci|scaffold|init|stdio)/.test(
      normalized,
    )
  ) {
    return "smoke";
  }
  if (
    /(doctor|status|simulate|json|contract|resource|tool|cli|output|surface)/.test(
      normalized,
    )
  ) {
    return "contract";
  }
  return "unit";
}

export function looksLikeHeavyTestCommand(command: string): boolean {
  return /\b(playwright|cypress|webdriver|puppeteer|e2e|smoke|integration)\b/i.test(
    command,
  );
}

export function buildScriptCommand(
  packageManager: HarnessPackageManager,
  scriptName: string,
): string {
  if (scriptName === "test") {
    return `${packageManager} test`;
  }
  if (packageManager === "npm") {
    return `npm run ${scriptName}`;
  }
  return `${packageManager} ${scriptName}`;
}

function buildBinaryCommand(
  packageManager: HarnessPackageManager,
  binary: string,
  args: string[],
): string {
  const suffix = args.length > 0 ? ` ${args.join(" ")}` : "";
  if (packageManager === "npm") {
    return `npm exec -- ${binary}${suffix}`;
  }
  return `${packageManager} exec ${binary}${suffix}`;
}

function selectFastScriptName(
  scripts: Record<string, string>,
): string | null {
  for (const candidate of FAST_SCRIPT_CANDIDATES) {
    if (scripts[candidate]) {
      return candidate;
    }
  }

  if (scripts["test"] && !looksLikeHeavyTestCommand(scripts["test"])) {
    return "test";
  }

  return null;
}

function selectIntegrationScriptName(
  scripts: Record<string, string>,
): string | null {
  for (const candidate of INTEGRATION_SCRIPT_CANDIDATES) {
    if (scripts[candidate]) {
      return candidate;
    }
  }

  if (scripts["test"] && looksLikeHeavyTestCommand(scripts["test"])) {
    return "test";
  }

  return null;
}

async function readRepoTestingSignals(
  repoPath: string,
): Promise<RepoTestingSignals> {
  const packageJsonPath = path.join(repoPath, "package.json");
  const packageJson = await readPackageJson(packageJsonPath);
  const scripts = normalizeScripts(packageJson?.scripts);
  const packageManager = await detectPackageManager(repoPath, packageJson);

  const [hasVitestConfig, hasJestConfig, jsSignalFromFiles] = await Promise.all([
    anyPathExists(repoPath, [
      "vitest.config.ts",
      "vitest.config.mts",
      "vitest.config.js",
      "vitest.config.mjs",
    ]),
    anyPathExists(repoPath, [
      "jest.config.ts",
      "jest.config.js",
      "jest.config.mjs",
      "jest.config.cjs",
    ]),
    anyPathExists(repoPath, JS_TS_SIGNAL_FILES),
  ]);

  const dependencies = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);
  const jsTsProject =
    jsSignalFromFiles ||
    dependencies.has("typescript") ||
    dependencies.has("vitest") ||
    dependencies.has("jest");

  return {
    packageJson,
    packageManager,
    scripts,
    jsTsProject,
    hasVitestConfig,
    hasJestConfig,
    hasVitestDependency: dependencies.has("vitest"),
    hasJestDependency: dependencies.has("jest"),
  };
}

async function detectPackageManager(
  repoPath: string,
  packageJson: PackageJsonShape | null,
): Promise<HarnessPackageManager> {
  const fromField = packageJson?.packageManager?.split("@")[0]?.trim();
  if (fromField === "pnpm" || fromField === "npm" || fromField === "yarn") {
    return fromField;
  }

  if (await pathExists(path.join(repoPath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (await pathExists(path.join(repoPath, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

async function readPackageJson(
  packageJsonPath: string,
): Promise<PackageJsonShape | null> {
  try {
    const raw = await readFile(packageJsonPath, "utf8");
    return JSON.parse(raw) as PackageJsonShape;
  } catch {
    return null;
  }
}

function normalizeScripts(
  scripts: Record<string, string> | undefined,
): Record<string, string> {
  if (!scripts) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(scripts)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value.trim()]),
  );
}

async function anyPathExists(repoPath: string, candidates: string[]): Promise<boolean> {
  for (const candidate of candidates) {
    if (await pathExists(path.join(repoPath, candidate))) {
      return true;
    }
  }
  return false;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
