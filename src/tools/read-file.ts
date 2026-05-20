import { readFile, stat } from "node:fs/promises";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import {
  MAX_FILE_CHARS,
  resolveExistingWithinRepo,
  toErrorResult,
  toSuccessResult,
} from "../safety.js";

export function registerReadFileTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "read_file",
    {
      title: "Read File",
      description:
        "Read a file within the repo. Use start_line/end_line to read sections and save tokens.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path from repo root"),
        start_line: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("First line to return (1-indexed, default: 1)"),
        end_line: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Last line to return (1-indexed, default: all)"),
      },
    },
    async ({ path, start_line, end_line }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "read_file",
        input: { path, start_line, end_line },
      });

      try {
        const absolutePath = await resolveExistingWithinRepo(
          config.repoPath,
          path,
        );
        const fileStats = await stat(absolutePath);
        const raw = await readFile(absolutePath, "utf8");

        // Enforce char limit before line slicing
        const truncatedBySize = raw.length > MAX_FILE_CHARS;
        const content = truncatedBySize ? raw.slice(0, MAX_FILE_CHARS) : raw;

        const allLines = content.split("\n");
        const totalLines = allLines.length;

        const from = Math.max(1, start_line ?? 1);
        const to = Math.min(totalLines, end_line ?? totalLines);
        const slice = allLines.slice(from - 1, to).join("\n");

        const result = {
          path,
          sizeBytes: fileStats.size,
          totalLines,
          startLine: from,
          endLine: to,
          truncatedBySize,
          content: slice,
        };

        await logger.log("tool_call_finished", {
          tool: "read_file",
          ok: true,
          durationMs: Date.now() - startedAt,
          sizeBytes: fileStats.size,
          totalLines,
          startLine: from,
          endLine: to,
        });

        return toSuccessResult(result);
      } catch (error) {
        const message = toErrorMessage(error);
        await logger.log("tool_call_finished", {
          tool: "read_file",
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
