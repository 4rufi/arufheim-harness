import { realpathSync } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import type { HarnessClientId } from "./config.js";
import { GLOBAL_CONFIG_DIRNAME, getGlobalHarnessRoot } from "./config.js";
import { HARNESS_VERSION } from "./version.js";

export const REPO_RUNTIME_LAUNCHER_PATH = ".harness/runtime/launch-global-runtime.mjs";

const MANAGED_RUNTIME_METADATA_VERSION = 2;
const MANAGED_RUNTIME_FIX_COMMAND = "arufheim-harness repair --global-runtime";

export type ManagedRuntimeSourceKind =
  | "package_install"
  | "workspace_dev"
  | "linked_dev"
  | "unknown";

export type ManagedRuntimeArtifactKind =
  | "global_bundle"
  | "legacy_entrypoint"
  | "unknown";

export interface ManagedRuntimeSource {
  kind: ManagedRuntimeSourceKind;
  entrypoint: string;
  entrypoint_realpath: string | null;
  package_root: string | null;
  package_root_realpath: string | null;
  package_name: string | null;
}

export interface ManagedRuntimeArtifact {
  kind: ManagedRuntimeArtifactKind;
  path: string;
}

interface ManagedGlobalRuntimeMetadataV1 {
  version: 1;
  package_version: string;
  process_exec_path: string;
  entrypoint: string;
  installed_at: string;
  global_root: string;
  shim_path: string;
  source_kind?: ManagedRuntimeSourceKind;
  source_entrypoint_realpath?: string | null;
  source_package_root?: string | null;
  source_package_root_realpath?: string | null;
  source_package_name?: string | null;
}

export interface ManagedGlobalRuntimeMetadataV2 {
  version: 2;
  seed_package_version: string;
  node_path: string;
  artifact_kind: "global_bundle";
  artifact_path: string;
  installed_at: string;
  global_root: string;
  shim_path: string;
  seed_process_exec_path: string;
  seed_source_kind?: ManagedRuntimeSourceKind;
  seed_source_entrypoint?: string;
  seed_source_entrypoint_realpath?: string | null;
  seed_source_package_root?: string | null;
  seed_source_package_root_realpath?: string | null;
  seed_source_package_name?: string | null;
}

export type ManagedGlobalRuntimeMetadata =
  | ManagedGlobalRuntimeMetadataV1
  | ManagedGlobalRuntimeMetadataV2;

export type ManagedRuntimeState = "ok" | "missing" | "stale" | "invalid";

export interface ManagedRuntimeStatus {
  mode: "managed_global";
  path: string;
  state: ManagedRuntimeState;
  version: string | null;
  runtime_artifact: ManagedRuntimeArtifact;
  runtime_source: ManagedRuntimeSource;
  last_verified_at: string | null;
  fix_available: boolean;
  fix_command: string;
  detail?: string;
}

export interface EnsureManagedGlobalRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  sourceDistDir?: string;
  sourceBundlePath?: string;
  sourceModuleUrl?: string;
  installedAt?: string;
}

export interface ManagedRuntimeInstallResult {
  globalRoot: string;
  runtimeRoot: string;
  shimPath: string;
  metadataPath: string;
  artifactPath: string;
  seedEntrypointPath: string;
  runtimeArtifact: ManagedRuntimeArtifact;
  runtimeSource: ManagedRuntimeSource;
  version: string;
  installedAt: string;
}

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function renderGlobalRootResolverSource(): string {
  return `
function resolveGlobalRoot() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (typeof appData === "string" && appData.trim().length > 0) {
      return path.join(path.resolve(appData), ${JSON.stringify(GLOBAL_CONFIG_DIRNAME)});
    }
  }

  if (typeof process.env.XDG_CONFIG_HOME === "string" && process.env.XDG_CONFIG_HOME.trim().length > 0) {
    return path.join(path.resolve(process.env.XDG_CONFIG_HOME), ${JSON.stringify(GLOBAL_CONFIG_DIRNAME)});
  }

  return path.join(os.homedir(), ".config", ${JSON.stringify(GLOBAL_CONFIG_DIRNAME)});
}
`.trim();
}

export function getManagedGlobalRuntimeRoot(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(getGlobalHarnessRoot(env, platform), "runtime");
}

export function getManagedGlobalRuntimeArtifactPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(getManagedGlobalRuntimeRoot(env, platform), "arufheim-harness.cjs");
}

export function getManagedGlobalRuntimeLegacyDistPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(getManagedGlobalRuntimeRoot(env, platform), "dist");
}

export function getManagedGlobalRuntimeLegacyEntrypointPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(getManagedGlobalRuntimeLegacyDistPath(env, platform), "index.js");
}

export function getManagedGlobalRuntimeBinDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(getGlobalHarnessRoot(env, platform), "bin");
}

export function getManagedGlobalRuntimeShimPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(
    getManagedGlobalRuntimeBinDir(env, platform),
    platform === "win32" ? "arufheim-harness.cmd" : "arufheim-harness",
  );
}

export function getManagedGlobalRuntimeMetadataPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(getGlobalHarnessRoot(env, platform), "runtime.json");
}

export function buildRepoLauncherArgs(
  repoPathArg: string,
  clientId: HarnessClientId,
): string[] {
  return [REPO_RUNTIME_LAUNCHER_PATH, "--repo-path", repoPathArg, "--client", clientId];
}

function renderRepoRuntimeLauncherSource(): string {
  return `#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

${renderGlobalRootResolverSource()}

const globalRoot = resolveGlobalRoot();
const metadataPath = path.join(globalRoot, "runtime.json");
let artifactPath = path.join(globalRoot, "runtime", "arufheim-harness.cjs");

try {
  const raw = await readFile(metadataPath, "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed?.artifact_path === "string" && parsed.artifact_path.trim().length > 0) {
    artifactPath = parsed.artifact_path;
  } else if (typeof parsed?.entrypoint === "string" && parsed.entrypoint.trim().length > 0) {
    artifactPath = parsed.entrypoint;
  }
} catch {
  // fallback to default artifact path
}

try {
  await access(artifactPath);
} catch {
  console.error("[FAIL] arufheim-harness managed runtime no está disponible.");
  console.error("Corre \`${MANAGED_RUNTIME_FIX_COMMAND}\` y vuelve a intentar.");
  process.exit(1);
}

const child = spawn(process.execPath, [artifactPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
`;
}

export function getRepoRuntimeLauncherSource(): string {
  return renderRepoRuntimeLauncherSource();
}

function resolveBundledDistDir(sourceModuleUrl?: string): string {
  const invokedPath =
    typeof process.argv[1] === "string" && process.argv[1].trim().length > 0
      ? path.resolve(process.argv[1])
      : null;
  if (invokedPath) {
    let resolvedInvokedPath = invokedPath;
    try {
      resolvedInvokedPath = realpathSync(invokedPath);
    } catch {
      resolvedInvokedPath = invokedPath;
    }
    if (path.basename(resolvedInvokedPath) === "index.js") {
      return path.dirname(resolvedInvokedPath);
    }
    return path.dirname(resolvedInvokedPath);
  }

  if (sourceModuleUrl) {
    const modulePath = fileURLToPath(sourceModuleUrl);
    const moduleDir = path.dirname(modulePath);
    if (path.basename(moduleDir) === "dist") {
      return moduleDir;
    }
    return path.resolve(moduleDir, "..", "dist");
  }

  return path.resolve(process.cwd(), "dist");
}

function resolveBundledRuntimeBundlePath(sourceDistDir: string): string {
  return path.resolve(path.join(sourceDistDir, "runtime-bundle.cjs"));
}

function isRuntimeBundlePath(filePath: string): boolean {
  const basename = path.basename(filePath);
  return basename === "runtime-bundle.cjs" || basename === "arufheim-harness.cjs";
}

async function buildBundleFromEntrypoint(
  entrypointPath: string,
  outfile: string,
): Promise<void> {
  const { build } = await import("esbuild");
  await build({
    entryPoints: [entrypointPath],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: ["node24"],
    sourcemap: false,
    logLevel: "silent",
  });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isWithinPath(candidatePath: string, basePath: string): boolean {
  const relative = path.relative(
    path.resolve(basePath),
    path.resolve(candidatePath),
  );
  return (
    relative.length === 0 ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function createUnknownRuntimeSource(entrypoint: string): ManagedRuntimeSource {
  return {
    kind: "unknown",
    entrypoint: path.resolve(entrypoint),
    entrypoint_realpath: null,
    package_root: null,
    package_root_realpath: null,
    package_name: null,
  };
}

function createUnknownRuntimeArtifact(
  artifactPath: string,
): ManagedRuntimeArtifact {
  return {
    kind: "unknown",
    path: path.resolve(artifactPath),
  };
}

async function findNearestPackageRoot(
  entrypointPath: string,
): Promise<string | null> {
  let currentDir = path.dirname(path.resolve(entrypointPath));

  while (true) {
    if (await pathExists(path.join(currentDir, "package.json"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

async function readPackageName(packageRoot: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}

function isNodeModulesHarnessRoot(candidatePath: string | null): boolean {
  if (!candidatePath) {
    return false;
  }

  return (
    path.basename(candidatePath) === "arufheim-harness" &&
    candidatePath.split(path.sep).includes("node_modules")
  );
}

export async function deriveManagedRuntimeSource(
  entrypointPath: string,
): Promise<ManagedRuntimeSource> {
  const resolvedEntrypoint = path.resolve(entrypointPath);
  const entrypointRealpath = await realpath(resolvedEntrypoint).catch(
    () => null,
  );
  const packageRoot = await findNearestPackageRoot(resolvedEntrypoint);
  const packageRootRealpath = packageRoot
    ? await realpath(packageRoot).catch(() => null)
    : null;
  const packageName = packageRoot ? await readPackageName(packageRoot) : null;

  if (packageName !== "arufheim-harness" || !packageRoot) {
    return {
      ...createUnknownRuntimeSource(resolvedEntrypoint),
      entrypoint_realpath: entrypointRealpath,
      package_root: packageRoot,
      package_root_realpath: packageRootRealpath,
      package_name: packageName,
    };
  }

  const apparentInstall = isNodeModulesHarnessRoot(packageRoot);
  const realInstall = isNodeModulesHarnessRoot(packageRootRealpath);

  let kind: ManagedRuntimeSourceKind;
  if (apparentInstall) {
    kind =
      packageRootRealpath &&
      path.resolve(packageRootRealpath) !== path.resolve(packageRoot) &&
      !realInstall
        ? "linked_dev"
        : "package_install";
  } else {
    kind = "workspace_dev";
  }

  return {
    kind,
    entrypoint: resolvedEntrypoint,
    entrypoint_realpath: entrypointRealpath,
    package_root: packageRoot,
    package_root_realpath: packageRootRealpath,
    package_name: packageName,
  };
}

function readStoredRuntimeSource(
  metadata: ManagedGlobalRuntimeMetadataV1 | ManagedGlobalRuntimeMetadataV2,
): ManagedRuntimeSource | null {
  const sourceKind =
    metadata.version === 2 ? metadata.seed_source_kind : metadata.source_kind;
  if (!sourceKind) {
    return null;
  }

  return {
    kind: sourceKind,
    entrypoint: path.resolve(
      metadata.version === 2
        ? metadata.seed_source_entrypoint ?? metadata.artifact_path
        : metadata.entrypoint,
    ),
    entrypoint_realpath:
      metadata.version === 2
        ? metadata.seed_source_entrypoint_realpath ?? null
        : metadata.source_entrypoint_realpath ?? null,
    package_root:
      metadata.version === 2
        ? metadata.seed_source_package_root ?? null
        : metadata.source_package_root ?? null,
    package_root_realpath:
      metadata.version === 2
        ? metadata.seed_source_package_root_realpath ?? null
        : metadata.source_package_root_realpath ?? null,
    package_name:
      metadata.version === 2
        ? metadata.seed_source_package_name ?? null
        : metadata.source_package_name ?? null,
  };
}

function readStoredRuntimeArtifact(
  metadata: ManagedGlobalRuntimeMetadata,
): ManagedRuntimeArtifact {
  if (metadata.version === 2) {
    return {
      kind: metadata.artifact_kind,
      path: path.resolve(metadata.artifact_path),
    };
  }

  return {
    kind: "legacy_entrypoint",
    path: path.resolve(metadata.entrypoint),
  };
}

function readMetadataNodePath(metadata: ManagedGlobalRuntimeMetadata): string {
  return metadata.version === 2
    ? metadata.node_path
    : metadata.process_exec_path;
}

function readMetadataPackageVersion(
  metadata: ManagedGlobalRuntimeMetadata,
): string {
  return metadata.version === 2
    ? metadata.seed_package_version
    : metadata.package_version;
}

function renderManagedRuntimeShim(metadata: ManagedGlobalRuntimeMetadata): string {
  const nodePath = readMetadataNodePath(metadata);
  const artifactPath = readStoredRuntimeArtifact(metadata).path;
  if (process.platform === "win32") {
    return [
      "@echo off",
      "setlocal",
      `set "NODE_BIN=${nodePath}"`,
      `set "ARTIFACT=${artifactPath}"`,
      'if not exist "%NODE_BIN%" (',
      "  echo [FAIL] Managed harness runtime is stale: node no existe. 1>&2",
      `  echo Corre "${MANAGED_RUNTIME_FIX_COMMAND}" para regenerarlo. 1>&2`,
      "  exit /b 1",
      ")",
      'if not exist "%ARTIFACT%" (',
      "  echo [FAIL] Managed harness runtime is stale: falta el artefacto bundle. 1>&2",
      `  echo Corre "${MANAGED_RUNTIME_FIX_COMMAND}" para regenerarlo. 1>&2`,
      "  exit /b 1",
      ")",
      '"%NODE_BIN%" "%ARTIFACT%" %*',
      "",
    ].join("\r\n");
  }

  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `NODE_BIN=${quoteShell(nodePath)}`,
    `ARTIFACT=${quoteShell(artifactPath)}`,
    'if [[ ! -x "$NODE_BIN" ]]; then',
    '  echo "[FAIL] Managed harness runtime is stale: node no existe." >&2',
    `  echo "Corre \`${MANAGED_RUNTIME_FIX_COMMAND}\` para regenerarlo." >&2`,
    "  exit 1",
    "fi",
    'if [[ ! -f "$ARTIFACT" ]]; then',
    '  echo "[FAIL] Managed harness runtime is stale: falta el artefacto bundle." >&2',
    `  echo "Corre \`${MANAGED_RUNTIME_FIX_COMMAND}\` para regenerarlo." >&2`,
    "  exit 1",
    "fi",
    'exec "$NODE_BIN" "$ARTIFACT" "$@"',
    "",
  ].join("\n");
}

export async function ensureManagedGlobalRuntime(
  options: EnsureManagedGlobalRuntimeOptions = {},
): Promise<ManagedRuntimeInstallResult> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const globalRoot = getGlobalHarnessRoot(env, platform);
  const runtimeRoot = getManagedGlobalRuntimeRoot(env, platform);
  const shimPath = getManagedGlobalRuntimeShimPath(env, platform);
  const metadataPath = getManagedGlobalRuntimeMetadataPath(env, platform);
  const sourceDistDir =
    options.sourceDistDir ?? resolveBundledDistDir(options.sourceModuleUrl);
  const invokedPath =
    typeof process.argv[1] === "string" && process.argv[1].trim().length > 0
      ? path.resolve(process.argv[1])
      : null;
  let sourceEntrypoint = path.resolve(path.join(sourceDistDir, "index.js"));
  const sourceBundlePath = path.resolve(
    options.sourceBundlePath ??
      (invokedPath && isRuntimeBundlePath(invokedPath)
        ? invokedPath
        : resolveBundledRuntimeBundlePath(sourceDistDir)),
  );
  const artifactPath = getManagedGlobalRuntimeArtifactPath(env, platform);

  let runtimeSource: ManagedRuntimeSource | null = null;
  if (!(await pathExists(sourceEntrypoint))) {
    if (isRuntimeBundlePath(sourceBundlePath)) {
      const existingMetadata = await readManagedGlobalRuntimeMetadata(env, platform);
      const storedSource = existingMetadata
        ? readStoredRuntimeSource(existingMetadata)
        : null;
      if (storedSource) {
        sourceEntrypoint = storedSource.entrypoint;
        runtimeSource = storedSource;
      }
    }
    if (!runtimeSource) {
      throw new Error(
        `No se pudo preparar el runtime global: falta ${sourceEntrypoint}. Corre build primero o usa una distribución empaquetada del harness.`,
      );
    }
  }
  const seedEntrypointPath = sourceEntrypoint;
  runtimeSource ??= await deriveManagedRuntimeSource(seedEntrypointPath);

  await mkdir(globalRoot, { recursive: true });
  await mkdir(path.dirname(shimPath), { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });

  if (await pathExists(sourceBundlePath)) {
    const bundleBytes = await readFile(sourceBundlePath);
    if (platform === "win32") {
      await writeFile(artifactPath, bundleBytes);
    } else {
      await writeFile(artifactPath, bundleBytes, { mode: 0o755 });
      await chmod(artifactPath, 0o755);
    }
  } else {
    if (runtimeSource.kind === "package_install") {
      throw new Error(
        `No se pudo preparar el runtime global: falta ${sourceBundlePath}. La instalación publicada debe incluir runtime-bundle.cjs; vuelve a empaquetar o reinstalar el harness.`,
      );
    }
    try {
      await buildBundleFromEntrypoint(sourceEntrypoint, artifactPath);
      if (platform !== "win32") {
        await chmod(artifactPath, 0o755);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No se pudo preparar el runtime global: falta ${sourceBundlePath} y el fallback de bundle para workspace dev falló (${message}). Corre build primero o usa una distribución empaquetada del harness.`,
      );
    }
  }

  const runtimeArtifact: ManagedRuntimeArtifact = {
    kind: "global_bundle",
    path: artifactPath,
  };
  const installedAt = options.installedAt ?? new Date().toISOString();
  const metadata: ManagedGlobalRuntimeMetadataV2 = {
    version: MANAGED_RUNTIME_METADATA_VERSION,
    seed_package_version: HARNESS_VERSION,
    node_path: process.execPath,
    artifact_kind: "global_bundle",
    artifact_path: artifactPath,
    installed_at: installedAt,
    global_root: globalRoot,
    shim_path: shimPath,
    seed_process_exec_path: process.execPath,
    seed_source_kind: runtimeSource.kind,
    seed_source_entrypoint: runtimeSource.entrypoint,
    seed_source_entrypoint_realpath: runtimeSource.entrypoint_realpath,
    seed_source_package_root: runtimeSource.package_root,
    seed_source_package_root_realpath: runtimeSource.package_root_realpath,
    seed_source_package_name: runtimeSource.package_name,
  };

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  if (platform === "win32") {
    await writeFile(shimPath, renderManagedRuntimeShim(metadata), "utf8");
  } else {
    await writeFile(shimPath, renderManagedRuntimeShim(metadata), {
      encoding: "utf8",
      mode: 0o755,
    });
    await chmod(shimPath, 0o755);
  }

  return {
    globalRoot,
    runtimeRoot,
    shimPath,
    metadataPath,
    artifactPath,
    seedEntrypointPath,
    runtimeArtifact,
    runtimeSource,
    version: HARNESS_VERSION,
    installedAt,
  };
}

function isManagedRuntimeMetadataV1(
  value: unknown,
): value is ManagedGlobalRuntimeMetadataV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ManagedGlobalRuntimeMetadataV1).version === 1 &&
    typeof (value as ManagedGlobalRuntimeMetadataV1).package_version === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV1).process_exec_path === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV1).entrypoint === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV1).installed_at === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV1).global_root === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV1).shim_path === "string" &&
    ((value as ManagedGlobalRuntimeMetadataV1).source_kind === undefined ||
      (value as ManagedGlobalRuntimeMetadataV1).source_kind === "package_install" ||
      (value as ManagedGlobalRuntimeMetadataV1).source_kind === "workspace_dev" ||
      (value as ManagedGlobalRuntimeMetadataV1).source_kind === "linked_dev" ||
      (value as ManagedGlobalRuntimeMetadataV1).source_kind === "unknown")
  );
}

function isManagedRuntimeMetadataV2(
  value: unknown,
): value is ManagedGlobalRuntimeMetadataV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ManagedGlobalRuntimeMetadataV2).version ===
      MANAGED_RUNTIME_METADATA_VERSION &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).seed_package_version ===
      "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).node_path === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).artifact_kind === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).artifact_path === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).installed_at === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).global_root === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).shim_path === "string" &&
    typeof (value as ManagedGlobalRuntimeMetadataV2).seed_process_exec_path ===
      "string" &&
    (value as ManagedGlobalRuntimeMetadataV2).artifact_kind === "global_bundle" &&
    ((value as ManagedGlobalRuntimeMetadataV2).seed_source_kind === undefined ||
      (value as ManagedGlobalRuntimeMetadataV2).seed_source_kind ===
        "package_install" ||
      (value as ManagedGlobalRuntimeMetadataV2).seed_source_kind ===
        "workspace_dev" ||
      (value as ManagedGlobalRuntimeMetadataV2).seed_source_kind ===
        "linked_dev" ||
      (value as ManagedGlobalRuntimeMetadataV2).seed_source_kind === "unknown")
  );
}

function isManagedRuntimeMetadata(
  value: unknown,
): value is ManagedGlobalRuntimeMetadata {
  return isManagedRuntimeMetadataV1(value) || isManagedRuntimeMetadataV2(value);
}

export async function readManagedGlobalRuntimeMetadata(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<ManagedGlobalRuntimeMetadata | null> {
  try {
    const raw = await readFile(
      getManagedGlobalRuntimeMetadataPath(env, platform),
      "utf8",
    );
    const parsed = JSON.parse(raw);
    return isManagedRuntimeMetadata(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function evaluateManagedGlobalRuntimeStatus(
  options: {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    verifiedAt?: string;
  } = {},
): Promise<ManagedRuntimeStatus> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const shimPath = getManagedGlobalRuntimeShimPath(env, platform);
  const metadataPath = getManagedGlobalRuntimeMetadataPath(env, platform);
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();

  const shimExists = await pathExists(shimPath);
  const metadataExists = await pathExists(metadataPath);
  const unknownSource = createUnknownRuntimeSource(
    getManagedGlobalRuntimeArtifactPath(env, platform),
  );
  const unknownArtifact = createUnknownRuntimeArtifact(
    getManagedGlobalRuntimeArtifactPath(env, platform),
  );

  if (!shimExists && !metadataExists) {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "missing",
      version: null,
      runtime_artifact: unknownArtifact,
      runtime_source: unknownSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: "runtime global no instalado",
    };
  }

  let rawMetadata: unknown;
  try {
    rawMetadata = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "invalid",
      version: null,
      runtime_artifact: unknownArtifact,
      runtime_source: unknownSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: "runtime.json inválido o no legible",
    };
  }

  if (!isManagedRuntimeMetadata(rawMetadata)) {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "invalid",
      version: null,
      runtime_artifact: unknownArtifact,
      runtime_source: unknownSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: "runtime.json no coincide con el schema esperado",
    };
  }

  const metadata = rawMetadata;
  const runtimeArtifact = readStoredRuntimeArtifact(metadata);
  const runtimeSource =
    readStoredRuntimeSource(metadata) ??
    (metadata.version === 1
      ? await deriveManagedRuntimeSource(metadata.entrypoint)
      : createUnknownRuntimeSource(runtimeArtifact.path));
  const expectedRoot = getGlobalHarnessRoot(env, platform);
  if (
    path.resolve(metadata.global_root) !== path.resolve(expectedRoot) ||
    path.resolve(metadata.shim_path) !== path.resolve(shimPath)
  ) {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "invalid",
      version: readMetadataPackageVersion(metadata),
      runtime_artifact: runtimeArtifact,
      runtime_source: runtimeSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: "runtime metadata apunta a otra raíz global",
    };
  }

  if (metadata.version === 1) {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "stale",
      version: readMetadataPackageVersion(metadata),
      runtime_artifact: runtimeArtifact,
      runtime_source: runtimeSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: isWithinPath(
        metadata.entrypoint,
        getManagedGlobalRuntimeRoot(env, platform),
      )
        ? "runtime metadata apunta a un dist copiado legacy; regenera el runtime gestionado"
        : "runtime metadata legacy todavía depende del package entrypoint; regenera el runtime global autocontenido",
    };
  }

  if (
    !shimExists ||
    !(await pathExists(runtimeArtifact.path)) ||
    !(await pathExists(readMetadataNodePath(metadata)))
  ) {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "stale",
      version: readMetadataPackageVersion(metadata),
      runtime_artifact: runtimeArtifact,
      runtime_source: runtimeSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: "falta el shim, el bundle global o el node guardado en el runtime",
    };
  }

  if (readMetadataPackageVersion(metadata) !== HARNESS_VERSION) {
    return {
      mode: "managed_global",
      path: shimPath,
      state: "stale",
      version: readMetadataPackageVersion(metadata),
      runtime_artifact: runtimeArtifact,
      runtime_source: runtimeSource,
      last_verified_at: verifiedAt,
      fix_available: true,
      fix_command: MANAGED_RUNTIME_FIX_COMMAND,
      detail: `runtime global en ${readMetadataPackageVersion(metadata)}; harness actual ${HARNESS_VERSION}`,
    };
  }

  return {
    mode: "managed_global",
    path: shimPath,
    state: "ok",
    version: readMetadataPackageVersion(metadata),
    runtime_artifact: runtimeArtifact,
    runtime_source: runtimeSource,
    last_verified_at: verifiedAt,
    fix_available: false,
    fix_command: MANAGED_RUNTIME_FIX_COMMAND,
    detail: runtimeArtifact.path,
  };
}

export async function isRepoScopedLauncherCurrent(
  repoPath: string,
): Promise<boolean> {
  try {
    const launcherPath = path.join(repoPath, REPO_RUNTIME_LAUNCHER_PATH);
    const [current, expected] = await Promise.all([
      readFile(launcherPath, "utf8"),
      Promise.resolve(getRepoRuntimeLauncherSource()),
    ]);
    return current.replace(/\r\n/g, "\n").trim() === expected.trim();
  } catch {
    return false;
  }
}

export async function spawnManagedRuntimeViaLauncher(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<number> {
  const status = await evaluateManagedGlobalRuntimeStatus({
    env: options.env,
    platform: process.platform,
  });
  if (status.state !== "ok") {
    throw new Error(status.detail ?? "managed runtime no disponible");
  }

  const child = spawn(process.execPath, [status.runtime_artifact.path, ...args], {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    stdio: "inherit",
  });

  return await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`managed runtime terminó por señal ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

export async function managedRuntimeFilesMtime(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<{
  metadataMtimeMs: number | null;
  shimMtimeMs: number | null;
  artifactMtimeMs: number | null;
}> {
  const [metadata, shim, artifact] = await Promise.all([
    stat(getManagedGlobalRuntimeMetadataPath(env, platform)).catch(() => null),
    stat(getManagedGlobalRuntimeShimPath(env, platform)).catch(() => null),
    stat(getManagedGlobalRuntimeArtifactPath(env, platform)).catch(() => null),
  ]);
  return {
    metadataMtimeMs: metadata?.mtimeMs ?? null,
    shimMtimeMs: shim?.mtimeMs ?? null,
    artifactMtimeMs: artifact?.mtimeMs ?? null,
  };
}
