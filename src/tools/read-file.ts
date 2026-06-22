import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import { recordRepoRead, recordToolCall } from "../session-metrics.js";
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
      await recordToolCall(config.repoPath, "read_file");

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
        const from = Math.max(1, start_line ?? 1);
        if (end_line !== undefined && end_line < from) {
          throw new Error(
            `Invalid line range: end_line (${end_line}) must be greater than or equal to start_line (${from}).`,
          );
        }

        const preview = await buildPreviewForRange(absolutePath, from, end_line);

        const result = {
          path,
          sizeBytes: fileStats.size,
          totalLines: preview.totalLines,
          startLine: from,
          endLine: preview.endLine,
          ...(preview.truncatedBySize && {
            previewTotalLines: preview.previewTotalLines,
            previewEndLine: preview.previewEndLine,
          }),
          truncatedBySize: preview.truncatedBySize,
          content: preview.content,
        };
        await recordRepoRead(
          config.repoPath,
          Buffer.byteLength(preview.content, "utf8"),
        );

        await logger.log("tool_call_finished", {
          tool: "read_file",
          ok: true,
          durationMs: Date.now() - startedAt,
          sizeBytes: fileStats.size,
          totalLines: preview.totalLines,
          startLine: from,
          endLine: preview.endLine,
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

type RangePreview = {
  content: string;
  endLine: number;
  previewEndLine?: number;
  previewTotalLines?: number;
  totalLines: number;
  truncatedBySize: boolean;
};

async function buildPreviewForRange(
  absolutePath: string,
  startLine: number,
  endLine?: number,
): Promise<RangePreview> {
  const stream = createReadStream(absolutePath, { encoding: "utf8" });
  const lines = createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  let totalLines = 0;
  let content = "";
  let truncatedBySize = false;
  let previewEndLine: number | undefined;
  let previewTotalLines = 0;

  try {
    for await (const line of lines) {
      totalLines += 1;

      if (totalLines < startLine) {
        continue;
      }

      if (endLine !== undefined && totalLines > endLine) {
        continue;
      }

      if (truncatedBySize) {
        continue;
      }

      const chunk = previewTotalLines === 0 ? line : `\n${line}`;
      const remaining = MAX_FILE_CHARS - content.length;
      if (chunk.length <= remaining) {
        content += chunk;
        previewEndLine = totalLines;
        previewTotalLines += 1;
        continue;
      }

      truncatedBySize = true;
      if (remaining > 0) {
        content += chunk.slice(0, remaining);
        previewEndLine = totalLines;
        previewTotalLines += 1;
      }
    }
  } finally {
    stream.destroy();
  }

  if (totalLines === 0) {
    totalLines = 1;
  }

  const logicalEndLine = Math.min(totalLines, endLine ?? totalLines);
  return {
    content,
    endLine: logicalEndLine,
    ...(truncatedBySize && {
      previewEndLine,
      previewTotalLines,
    }),
    totalLines,
    truncatedBySize,
  };
}
