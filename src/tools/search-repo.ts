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
      description:
        "Search text or regex across repo files with optional line context.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Plain-text string or regex pattern to search for"),
        regex: z
          .boolean()
          .optional()
          .describe("Treat query as a regular expression (default: false)"),
        context_lines: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe(
            "Lines of context before and after each match (default: 0)",
          ),
        include: z
          .string()
          .optional()
          .describe(
            "Glob pattern to restrict which files are searched (e.g. '**/*.ts')",
          ),
      },
    },
    async ({ query, regex, context_lines, include }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "search_repo",
        input: { query, regex, context_lines, include },
      });

      try {
        let matcher: (line: string) => boolean;
        if (regex) {
          const re = new RegExp(query);
          matcher = (line) => re.test(line);
        } else {
          matcher = (line) => line.includes(query);
        }

        const ctxLines = context_lines ?? 0;

        const files = await fg(include ?? "**/*", {
          cwd: config.repoPath,
          dot: true,
          onlyFiles: true,
          ignore: config.ignored,
          followSymbolicLinks: false,
        });

        const matches: Array<{
          path: string;
          line: number;
          preview: string;
          context_before: string[];
          context_after: string[];
        }> = [];
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
            if (!matcher(lines[index])) {
              continue;
            }

            const before =
              ctxLines > 0
                ? lines.slice(Math.max(0, index - ctxLines), index)
                : [];
            const after =
              ctxLines > 0 ? lines.slice(index + 1, index + 1 + ctxLines) : [];

            matches.push({
              path: relativePath,
              line: index + 1,
              preview: lines[index].slice(0, 240),
              context_before: before,
              context_after: after,
            });

            if (matches.length >= MAX_SEARCH_RESULTS) {
              truncated = true;
              break;
            }
          }
        }

        const result = {
          query,
          regex: regex ?? false,
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
