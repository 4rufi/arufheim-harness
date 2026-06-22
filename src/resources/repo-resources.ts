import { access, readFile } from "node:fs/promises";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ResolvedharnessConfig } from "../config.js";
import { evaluateHarnessHealth } from "../health.js";
import { readLoopStatus } from "../loop.js";
import { JsonlLogger } from "../logger.js";
import { assertExistingPathWithinRepo } from "../safety.js";

const RAW_CONFIG_RESOURCE_URI = "harness://config/raw";
const RESOLVED_CONFIG_RESOURCE_URI = "harness://config/resolved";
const HEALTH_RESOURCE_URI = "harness://health";
const ACTIVE_LOOP_RESOURCE_URI = "harness://loop/active";
const LOG_RESOURCE_URI = "harness://logs/main";

const MAX_LOG_BYTES = 128 * 1024;

export function registerRepoResources(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerResource(
    "raw_config",
    RAW_CONFIG_RESOURCE_URI,
    {
      title: "Raw harness Config",
      description: "The raw harness.config.json file for this server instance.",
      mimeType: "application/json",
    },
    async (uri) => {
      assertExpectedUri(uri.href, RAW_CONFIG_RESOURCE_URI);

      return withResourceLogging(logger, "raw_config", uri.href, async () => {
        const exists = await fileExists(config.configPath);
        const safePath = exists
          ? await resolveReadableConfigPath(config.repoPath, config.configPath)
          : config.configPath;
        const text = exists ? await readFile(safePath, "utf8") : "";
        const scope = isWithinRepo(config.repoPath, safePath)
          ? "repo"
          : "external";

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text,
              _meta: {
                exists,
                scope,
                relativePath:
                  scope === "repo"
                    ? relativize(config.repoPath, safePath)
                    : safePath,
              },
            },
          ],
        };
      });
    },
  );

  server.registerResource(
    "resolved_config",
    RESOLVED_CONFIG_RESOURCE_URI,
    {
      title: "Resolved harness Config",
      description:
        "The effective harness config after defaults and path resolution.",
      mimeType: "application/json",
    },
    async (uri) => {
      assertExpectedUri(uri.href, RESOLVED_CONFIG_RESOURCE_URI);

      return withResourceLogging(
        logger,
        "resolved_config",
        uri.href,
        async () => {
          const safeConfig = redactResolvedConfig(config);

          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(safeConfig, null, 2),
              },
            ],
          };
        },
      );
    },
  );

  server.registerResource(
    "health",
    HEALTH_RESOURCE_URI,
    {
      title: "harness Health",
      description:
        "The effective health snapshot shared by doctor, harness_status, TUI and the startup banner.",
      mimeType: "application/json",
    },
    async (uri) => {
      assertExpectedUri(uri.href, HEALTH_RESOURCE_URI);

      return withResourceLogging(logger, "health", uri.href, async () => {
        const snapshot = await evaluateHarnessHealth(config.repoPath);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      });
    },
  );

  server.registerResource(
    "active_loop",
    ACTIVE_LOOP_RESOURCE_URI,
    {
      title: "harness Active Loop",
      description:
        "The active plan-execute-verify loop state for the current feature, or exists=false when no feature is active.",
      mimeType: "application/json",
    },
    async (uri) => {
      assertExpectedUri(uri.href, ACTIVE_LOOP_RESOURCE_URI);

      return withResourceLogging(logger, "active_loop", uri.href, async () => {
        const status = await readLoopStatus(config.repoPath);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      });
    },
  );

  server.registerResource(
    "main_log",
    LOG_RESOURCE_URI,
    {
      title: "harness Main Log",
      description:
        "The tail of the JSONL operational log written by harness in .harness/logs/harness.jsonl.",
      mimeType: "application/x-ndjson",
    },
    async (uri) => {
      assertExpectedUri(uri.href, LOG_RESOURCE_URI);

      const startedAt = Date.now();

      try {
        const exists = await fileExists(logger.logFilePath);
        const safePath = exists
          ? await assertExistingPathWithinRepo(
              config.repoPath,
              logger.logFilePath,
            )
          : logger.logFilePath;
        const text = exists ? await readTail(safePath, MAX_LOG_BYTES) : "";

        await logger.log("resource_read_finished", {
          resource: "main_log",
          uri: uri.href,
          ok: true,
          durationMs: Date.now() - startedAt,
          exists,
          truncatedToBytes: MAX_LOG_BYTES,
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/x-ndjson",
              text,
              _meta: {
                exists,
                truncatedToBytes: MAX_LOG_BYTES,
                relativePath: relativize(config.repoPath, safePath),
              },
            },
          ],
        };
      } catch (error) {
        const message = toErrorMessage(error);

        await logger.log("resource_read_finished", {
          resource: "main_log",
          uri: uri.href,
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });

        throw error;
      }
    },
  );
}

async function withResourceLogging<T>(
  logger: JsonlLogger,
  resource: string,
  uri: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  await logger.log("resource_read_started", {
    resource,
    uri,
  });

  try {
    const result = await operation();

    await logger.log("resource_read_finished", {
      resource,
      uri,
      ok: true,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    const message = toErrorMessage(error);

    await logger.log("resource_read_finished", {
      resource,
      uri,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: message,
    });

    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTail(filePath: string, maxBytes: number): Promise<string> {
  const file = await import("node:fs/promises");
  const stat = await file.stat(filePath);
  const start = Math.max(0, stat.size - maxBytes);
  const handle = await file.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(stat.size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

function assertExpectedUri(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Unexpected resource URI: ${actual}`);
  }
}

function relativize(root: string, filePath: string): string {
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;

  if (filePath.startsWith(normalizedRoot)) {
    return filePath.slice(normalizedRoot.length);
  }

  return filePath;
}

function redactResolvedConfig(
  config: ResolvedharnessConfig,
): Record<string, unknown> {
  const configPath = isWithinRepo(config.repoPath, config.configPath)
    ? relativize(config.repoPath, config.configPath)
    : config.configPath;
  const logFilePath =
    config.logFilePath && isWithinRepo(config.repoPath, config.logFilePath)
      ? relativize(config.repoPath, config.logFilePath)
      : config.logFilePath;

  return {
    ...config,
    // Avoid leaking absolute internal paths unless the client really needs them.
    repoPath: ".",
    configPath,
    logFilePath,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveReadableConfigPath(
  repoPath: string,
  configPath: string,
): Promise<string> {
  if (isWithinRepo(repoPath, configPath)) {
    return assertExistingPathWithinRepo(repoPath, configPath);
  }

  return configPath;
}

function isWithinRepo(repoPath: string, filePath: string): boolean {
  const absoluteRepoPath = repoPath.endsWith("/")
    ? repoPath
    : `${repoPath}/`;
  return filePath === repoPath || filePath.startsWith(absoluteRepoPath);
}
