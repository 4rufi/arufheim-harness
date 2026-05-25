import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import { summarizePermissionPolicy } from "../policy.js";
import { readSessionMetrics } from "../session-metrics.js";
import { toErrorResult, toSuccessResult } from "../safety.js";

export function registerHarnessMetricsTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "harness_metrics",
    {
      title: "Harness Metrics",
      description:
        "Current session metrics, including estimated local context tokens and permission policy summary.",
      inputSchema: {},
    },
    async () => {
      const startedAt = Date.now();
      await logger.log("tool_call_started", { tool: "harness_metrics" });

      try {
        const metrics = await readSessionMetrics(config.repoPath);
        const result = {
          metrics,
          permission_policy: summarizePermissionPolicy(config.permissionPolicy),
          note: "estimated_local_tokens is a local approximation from bytes read/returned; it is not billed provider usage.",
        };

        await logger.log("tool_call_finished", {
          tool: "harness_metrics",
          ok: true,
          durationMs: Date.now() - startedAt,
        });

        return toSuccessResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_metrics",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
