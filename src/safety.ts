import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IGNORED = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  ".harness/**",
];

export const MAX_FILE_CHARS = 100_000;
export const MAX_SEARCH_RESULTS = 50;
export const MAX_SEARCH_FILE_BYTES = 256_000;
export const COMMAND_TIMEOUT_MS = 30_000;
export const COMMAND_MAX_BUFFER_BYTES = 1024 * 1024;

export async function resolveExistingWithinRepo(
  repoPath: string,
  targetPath: string,
): Promise<string> {
  if (path.isAbsolute(targetPath)) {
    throw new Error("Only relative paths are allowed.");
  }

  const absoluteRepoPath = await realpath(path.resolve(repoPath));
  const candidate = path.resolve(absoluteRepoPath, targetPath);
  const canonicalCandidate = await realpath(candidate);

  return assertCanonicalPathWithinRepo(
    absoluteRepoPath,
    canonicalCandidate,
    targetPath,
    "Blocked path traversal attempt",
  );
}

export async function assertExistingPathWithinRepo(
  repoPath: string,
  targetPath: string,
): Promise<string> {
  const absoluteRepoPath = await realpath(path.resolve(repoPath));
  const canonicalCandidate = await realpath(path.resolve(targetPath));

  return assertCanonicalPathWithinRepo(
    absoluteRepoPath,
    canonicalCandidate,
    targetPath,
    "Blocked access outside repoPath",
  );
}

export function toSuccessResult<T extends Record<string, unknown>>(result: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result,
  };
}

export function toErrorResult(
  message: string,
  extra: Record<string, unknown> = {},
) {
  const payload = {
    error: message,
    ...extra,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError: true,
  };
}

export function assertAllowedCommand(
  command: string,
  allowedCommands: string[],
): void {
  if (!allowedCommands.includes(command.trim())) {
    throw new Error(
      `Command '${command}' is not allowed by harness.config.json.`,
    );
  }
}

export function assertSafeGlobPattern(pattern: string): void {
  const normalized = pattern.replace(/\\/g, "/");
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(pattern)) {
    throw new Error("Glob patterns must stay relative to repoPath.");
  }

  if (/(^|\/)\.\.(\/|$)/.test(normalized)) {
    throw new Error("Glob patterns cannot traverse outside repoPath.");
  }
}

export function tokenizeCommand(command: string): string[] {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error("run_command requires a non-empty command.");
  }

  for (const token of tokens) {
    if (!/^[A-Za-z0-9_./:@=-]+$/.test(token)) {
      throw new Error(
        `Rejected token '${token}'. Quotes and shell metacharacters are not allowed.`,
      );
    }
  }

  return tokens;
}

export async function openRepoWriteHandle(
  repoPath: string,
  targetPath: string,
  append = false,
) {
  const absoluteTarget = await prepareRepoWriteTarget(repoPath, targetPath);
  const noFollowFlag =
    typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  const flags =
    fsConstants.O_WRONLY |
    fsConstants.O_CREAT |
    (append ? fsConstants.O_APPEND : fsConstants.O_TRUNC) |
    noFollowFlag;

  return open(absoluteTarget, flags, 0o666);
}

export async function prepareRepoWriteTarget(
  repoPath: string,
  targetPath: string,
): Promise<string> {
  if (path.isAbsolute(targetPath)) {
    throw new Error("Only relative paths are allowed.");
  }

  const absoluteRepoPath = await realpath(path.resolve(repoPath));
  const absoluteTarget = path.resolve(absoluteRepoPath, targetPath);

  assertCanonicalPathWithinRepo(
    absoluteRepoPath,
    absoluteTarget,
    targetPath,
    "Blocked path traversal attempt",
  );

  const parentDir = path.dirname(absoluteTarget);
  await mkdir(parentDir, { recursive: true });
  const canonicalParent = await realpath(parentDir);

  assertCanonicalPathWithinRepo(
    absoluteRepoPath,
    canonicalParent,
    targetPath,
    "Blocked symlink escape attempt",
  );

  try {
    const stats = await lstat(absoluteTarget);
    if (stats.isSymbolicLink()) {
      throw new Error(`Blocked symlink escape attempt for '${targetPath}'.`);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  return absoluteTarget;
}

function assertCanonicalPathWithinRepo(
  absoluteRepoPath: string,
  canonicalCandidate: string,
  targetPath: string,
  message: string,
): string {
  const repoPrefix = `${absoluteRepoPath}${path.sep}`;

  if (
    canonicalCandidate !== absoluteRepoPath &&
    !canonicalCandidate.startsWith(repoPrefix)
  ) {
    throw new Error(`${message} for '${targetPath}'.`);
  }

  return canonicalCandidate;
}
