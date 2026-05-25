import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import { enforcePermissionPolicy } from "../policy.js";
import { recordRepoWrite, recordToolCall } from "../session-metrics.js";
import {
  openRepoWriteHandle,
  toErrorResult,
  toSuccessResult,
} from "../safety.js";

const MAX_WRITE_BYTES = 1024 * 1024; // 1 MB

export function registerWriteFileTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "write_file",
    {
      title: "Write File",
      description:
        "Write or append to a file within the repo. Creates parent dirs. Max 1 MB.",
      inputSchema: {
        path: z.string().min(1).describe("Relative path from repo root"),
        content: z.string().describe("UTF-8 content to write"),
        append: z
          .boolean()
          .optional()
          .describe("If true, appends instead of overwriting (default: false)"),
      },
    },
    async ({ path: filePath, content, append }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "write_file");

      await logger.log("tool_call_started", {
        tool: "write_file",
        input: { path: filePath, append: append ?? false },
      });

      try {
        enforcePermissionPolicy(config.permissionPolicy, "write_file", "R2");
        if (path.isAbsolute(filePath)) {
          throw new Error("Only relative paths are allowed.");
        }

        if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
          throw new Error(
            `Content exceeds maximum write size of ${MAX_WRITE_BYTES} bytes.`,
          );
        }
        const handle = await openRepoWriteHandle(
          config.repoPath,
          filePath,
          append ?? false,
        );
        try {
          await handle.writeFile(content, "utf8");
        } finally {
          await handle.close();
        }

        const result = {
          path: filePath,
          bytesWritten: Buffer.byteLength(content, "utf8"),
          append: append ?? false,
        };
        await recordRepoWrite(config.repoPath, result.bytesWritten);

        await logger.log("tool_call_finished", {
          tool: "write_file",
          ok: true,
          durationMs: Date.now() - startedAt,
          bytesWritten: result.bytesWritten,
        });

        return toSuccessResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "write_file",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
