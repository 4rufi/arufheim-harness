import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import { recordResponseOutput, recordToolCall } from "../session-metrics.js";
import { toErrorResult, toSuccessResult } from "../safety.js";
import { buildHarnessStatus } from "../status.js";

export function registerHarnessStatusTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "harness_status",
    {
      title: "Harness Status",
      description:
        "Session snapshot: active feature, next step, inbox count, spec_ready and blocked features, recent memory blockers. Call once at startup.",
      inputSchema: {
        mode: z
          .enum(["full", "brief_only", "brief_minimal"])
          .optional()
          .describe(
            "Use brief_minimal for the cheapest startup snapshot, or brief_only for the richer startup summary.",
          ),
      },
    },
    async ({ mode }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "harness_status");

      await logger.log("tool_call_started", { tool: "harness_status" });

      try {
        const snapshot = await buildHarnessStatus({
          repoPath: config.repoPath,
          configPath: config.configPath,
          configScope: config.configScope,
          permissionPolicy: config.permissionPolicy,
          mode,
        });
        await recordResponseOutput(
          config.repoPath,
          `tool:harness_status:${snapshot.meta.mode}`,
          Buffer.byteLength(JSON.stringify(snapshot.content, null, 2), "utf8"),
        ).catch(() => undefined);

        await logger.log("tool_call_finished", {
          tool: "harness_status",
          ok: true,
          durationMs: Date.now() - startedAt,
          mode: snapshot.meta.mode,
          active: snapshot.meta.active,
          inbox_count: snapshot.meta.inbox_count,
          spec_ready_count: snapshot.meta.spec_ready_count,
          blocked_count: snapshot.meta.blocked_count,
        });

        return toSuccessResult(snapshot.content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_status",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
