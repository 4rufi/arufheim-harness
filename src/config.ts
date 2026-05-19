import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { z } from "zod";

import { DEFAULT_IGNORED } from "./safety.js";

const harnessConfigSchema = z.object({
  repoPath: z.string().default("."),
  allowedCommands: z.array(z.string()).default([]),
  ignored: z.array(z.string()).default(DEFAULT_IGNORED),
});

export interface ResolvedharnessConfig {
  configPath: string;
  repoPath: string;
  allowedCommands: string[];
  ignored: string[];
  logFilePath?: string;
}

interface LoadConfigOptions {
  argv?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<ResolvedharnessConfig> {
  const cwd = options.cwd ?? process.cwd();
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;

  // --repo-path / harness_REPO_PATH: apunta harness a cualquier repo sin necesitar
  // un harness.config.json en ese repo. Si existe uno, se usa para allowedCommands
  // e ignored, pero repoPath siempre viene del argumento.
  const explicitRepoPath = readRepoPathFromArgs(argv) ?? env.harness_REPO_PATH;
  if (explicitRepoPath) {
    const repoPath = path.resolve(cwd, explicitRepoPath);
    const configPath = path.resolve(repoPath, "harness.config.json");
    let parsed: z.infer<typeof harnessConfigSchema>;
    try {
      const raw = await readFile(configPath, "utf8");
      parsed = harnessConfigSchema.parse(JSON.parse(raw));
    } catch {
      parsed = harnessConfigSchema.parse({});
    }
    return {
      configPath,
      repoPath,
      allowedCommands: normalizeCommands(parsed.allowedCommands),
      ignored: normalizeIgnored(parsed.ignored),
      logFilePath: undefined,
    };
  }

  const explicitPath = readConfigPathFromArgs(argv) ?? env.harness_CONFIG;
  const configPath = resolveConfigPath(argv, env, cwd);

  let parsed: z.infer<typeof harnessConfigSchema>;
  try {
    const raw = await readFile(configPath, "utf8");
    parsed = harnessConfigSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if (!explicitPath && (err as NodeJS.ErrnoException).code === "ENOENT") {
      parsed = harnessConfigSchema.parse({});
    } else {
      throw err;
    }
  }

  return {
    configPath,
    repoPath: path.resolve(path.dirname(configPath), parsed.repoPath),
    allowedCommands: normalizeCommands(parsed.allowedCommands),
    ignored: normalizeIgnored(parsed.ignored),
    logFilePath: undefined,
  };
}

export function resolveConfigPath(
  argv: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  const fromArg = readConfigPathFromArgs(argv);
  const candidate =
    fromArg ?? env.harness_CONFIG ?? path.resolve(cwd, "harness.config.json");
  return path.resolve(cwd, candidate);
}

function normalizeCommands(commands: string[]): string[] {
  return Array.from(
    new Set(commands.map((command) => command.trim()).filter(Boolean)),
  );
}

function normalizeIgnored(ignored: string[]): string[] {
  return Array.from(new Set([...DEFAULT_IGNORED, ...ignored]));
}

function readConfigPathFromArgs(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--config") {
      return argv[index + 1];
    }
    if (value.startsWith("--config=")) {
      return value.slice("--config=".length);
    }
  }

  return undefined;
}

function readRepoPathFromArgs(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--repo-path") {
      return argv[index + 1];
    }
    if (value.startsWith("--repo-path=")) {
      return value.slice("--repo-path=".length);
    }
  }

  return undefined;
}
