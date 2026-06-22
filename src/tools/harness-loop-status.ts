import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { readLoopStatus } from "../loop.js";
import { JsonlLogger } from "../logger.js";
import { recordResponseOutput, recordToolCall } from "../session-metrics.js";
import { toErrorResult, toSuccessResult } from "../safety.js";

export function registerHarnessLoopStatusTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "harness_loop_status",
    {
      title: "Harness Loop Status",
      description:
        "Read the current plan-execute-verify loop state for the active feature or a specific feature id.",
      inputSchema: {
        feature_id: z.number().int().positive().optional().describe("Optional feature id"),
      },
    },
    async ({ feature_id }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "harness_loop_status");
      await logger.log("tool_call_started", {
        tool: "harness_loop_status",
        input: { feature_id },
      });

      try {
        const result = await readLoopStatus(config.repoPath, feature_id);
        const payload = {
          exists: result.exists,
          feature_id: result.feature_id,
          feature_name: result.feature_name,
          path: result.path,
          loop: result.loop,
          loop_summary: result.loop_summary,
        };
        await recordResponseOutput(
          config.repoPath,
          "tool:harness_loop_status",
          Buffer.byteLength(JSON.stringify(payload, null, 2), "utf8"),
        ).catch(() => undefined);

        await logger.log("tool_call_finished", {
          tool: "harness_loop_status",
          ok: true,
          durationMs: Date.now() - startedAt,
          exists: result.exists,
          feature_id: result.feature_id,
        });
        return toSuccessResult(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_loop_status",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
