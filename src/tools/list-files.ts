import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fg from "fast-glob";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import {
  assertSafeGlobPattern,
  resolveExistingWithinRepo,
  toErrorResult,
  toSuccessResult,
} from "../safety.js";

const MAX_FILES = 500;

export function registerListFilesTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "list_files",
    {
      title: "List Files",
      description: "List repository files with an optional glob pattern.",
      inputSchema: {
        pattern: z
          .string()
          .optional()
          .describe("Glob pattern relative to repo root"),
      },
    },
    async ({ pattern }) => {
      const startedAt = Date.now();
      const effectivePattern = pattern?.trim() || "**/*";

      await logger.log("tool_call_started", {
        tool: "list_files",
        input: { pattern: effectivePattern },
      });

      try {
        assertSafeGlobPattern(effectivePattern);

        const files = await fg(effectivePattern, {
          cwd: config.repoPath,
          dot: true,
          onlyFiles: true,
          ignore: config.ignored,
          followSymbolicLinks: false,
        });
        const safeFiles: string[] = [];

        for (const relativePath of files) {
          try {
            await resolveExistingWithinRepo(config.repoPath, relativePath);
            safeFiles.push(relativePath);
          } catch (error) {
            if (shouldSkipListedPath(error)) {
              continue;
            }
            throw error;
          }
        }

        const result = {
          repoPath: config.repoPath,
          pattern: effectivePattern,
          total: safeFiles.length,
          truncated: safeFiles.length > MAX_FILES,
          files: safeFiles.slice(0, MAX_FILES),
        };

        await logger.log("tool_call_finished", {
          tool: "list_files",
          ok: true,
          durationMs: Date.now() - startedAt,
          total: result.total,
        });

        return toSuccessResult(result);
      } catch (error) {
        const message = toErrorMessage(error);
        await logger.log("tool_call_finished", {
          tool: "list_files",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldSkipListedPath(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || error.message.startsWith("Blocked ");
}
