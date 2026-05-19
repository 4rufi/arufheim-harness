import { readFile } from "node:fs/promises";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fg from "fast-glob";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import {
  MAX_SEARCH_FILE_BYTES,
  MAX_SEARCH_RESULTS,
  resolveExistingWithinRepo,
  toErrorResult,
  toSuccessResult,
} from "../safety.js";

const MAX_SCANNED_FILES = 250;

export function registerSearchRepoTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "search_repo",
    {
      title: "Search Repo",
      description: "Search plain text across repository files.",
      inputSchema: {
        query: z.string().min(1).describe("Plain-text query to search for"),
      },
    },
    async ({ query }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "search_repo",
        input: { query },
      });

      try {
        const files = await fg("**/*", {
          cwd: config.repoPath,
          dot: true,
          onlyFiles: true,
          ignore: config.ignored,
          followSymbolicLinks: false,
        });

        const matches: Array<{ path: string; line: number; preview: string }> =
          [];
        let scannedFiles = 0;
        let truncated = false;

        for (const relativePath of files.slice(0, MAX_SCANNED_FILES)) {
          if (matches.length >= MAX_SEARCH_RESULTS) {
            truncated = true;
            break;
          }

          let absolutePath: string;
          try {
            absolutePath = await resolveExistingWithinRepo(
              config.repoPath,
              relativePath,
            );
          } catch (error) {
            if (shouldSkipScannedPath(error)) {
              continue;
            }
            throw error;
          }

          const buffer = await readFile(absolutePath);
          if (buffer.byteLength > MAX_SEARCH_FILE_BYTES) {
            continue;
          }

          scannedFiles += 1;
          const lines = buffer.toString("utf8").split(/\r?\n/);

          for (let index = 0; index < lines.length; index += 1) {
            if (!lines[index].includes(query)) {
              continue;
            }

            matches.push({
              path: relativePath,
              line: index + 1,
              preview: lines[index].slice(0, 240),
            });

            if (matches.length >= MAX_SEARCH_RESULTS) {
              truncated = true;
              break;
            }
          }
        }

        const result = {
          query,
          scannedFiles,
          truncated,
          matches,
        };

        await logger.log("tool_call_finished", {
          tool: "search_repo",
          ok: true,
          durationMs: Date.now() - startedAt,
          matches: matches.length,
        });

        return toSuccessResult(result);
      } catch (error) {
        const message = toErrorMessage(error);
        await logger.log("tool_call_finished", {
          tool: "search_repo",
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

function shouldSkipScannedPath(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || error.message.startsWith("Blocked ");
}
