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
      description: "Read a UTF-8 text file relative to the repository root.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path from repo root"),
      },
    },
    async ({ path }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "read_file",
        input: { path },
      });

      try {
        const absolutePath = await resolveExistingWithinRepo(
          config.repoPath,
          path,
        );
        const fileStats = await stat(absolutePath);
        const content = await readFile(absolutePath, "utf8");
        const truncated = content.length > MAX_FILE_CHARS;

        const result = {
          path,
          sizeBytes: fileStats.size,
          truncated,
          content: truncated ? content.slice(0, MAX_FILE_CHARS) : content,
        };

        await logger.log("tool_call_finished", {
          tool: "read_file",
          ok: true,
          durationMs: Date.now() - startedAt,
          sizeBytes: fileStats.size,
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
