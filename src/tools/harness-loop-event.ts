import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { refreshActiveHeadSummary } from "../headroom.js";
import { appendLoopEvent } from "../loop.js";
import { JsonlLogger } from "../logger.js";
import { enforcePermissionPolicy } from "../policy.js";
import { recordRepoWrite, recordResponseOutput, recordToolCall } from "../session-metrics.js";
import { toErrorResult, toSuccessResult } from "../safety.js";
import { readFeatureListDocument, withWorkflowWriteLock, type WorkflowFeature } from "../workflow.js";

export function registerHarnessLoopEventTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "harness_loop_event",
    {
      title: "Harness Loop Event",
      description:
        "Append a structured loop event for the active feature workflow and recompute the derived plan-execute-verify state.",
      inputSchema: {
        feature_id: z.number().int().positive().describe("Feature id"),
        phase: z
          .enum(["plan", "execute", "verify", "review", "analyze", "route_back", "done", "blocked"])
          .describe("Current loop phase"),
        actor: z
          .enum(["leader", "implementer", "reviewer", "human"])
          .describe("Actor producing the event"),
        outcome: z.string().min(1).describe("Outcome label"),
        summary: z.string().min(1).describe("Short summary"),
        verification: z.string().optional().describe("Verification evidence"),
        error_signature: z.string().optional().describe("Stable failure signature"),
        progress_delta: z
          .enum(["none", "partial", "meaningful"])
          .optional()
          .describe("How much progress this event produced"),
        strategy_delta: z
          .string()
          .optional()
          .describe("What changed for the retry strategy"),
        next_actor: z
          .enum(["leader", "implementer", "reviewer", "human"])
          .optional()
          .describe("Optional explicit next actor"),
      },
    },
    async (input) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "harness_loop_event");
      await logger.log("tool_call_started", {
        tool: "harness_loop_event",
        input: { feature_id: input.feature_id, phase: input.phase, actor: input.actor },
      });

      try {
        enforcePermissionPolicy(config.permissionPolicy, "harness_loop_event", "R1");
        const result = await withWorkflowWriteLock(config.repoPath, async () => {
          const { document } = await readFeatureListDocument(config.repoPath);
          const feature = document.features.find(
            (entry) => entry.id === input.feature_id,
          ) as WorkflowFeature | undefined;
          if (!feature) {
            throw new Error(
              `Feature id=${input.feature_id} not found in .harness/feature_list.json.`,
            );
          }
          if (feature.status !== "in_progress") {
            throw new Error(
              `Feature id=${input.feature_id} must be in_progress to append loop events.`,
            );
          }

          const appended = await appendLoopEvent(
            config.repoPath,
            feature,
            {
              phase: input.phase,
              actor: input.actor,
              outcome: input.outcome,
              summary: input.summary,
              verification: input.verification,
              error_signature: input.error_signature,
              progress_delta: input.progress_delta,
              strategy_delta: input.strategy_delta,
              next_actor: input.next_actor,
            },
            config.loopPolicy,
          );
          await refreshActiveHeadSummary(config.repoPath).catch(() => undefined);

          await recordRepoWrite(
            config.repoPath,
            Buffer.byteLength(JSON.stringify(appended.loop, null, 2), "utf8"),
          ).catch(() => undefined);

          return {
            feature_id: feature.id,
            feature_name: feature.name,
            loop: appended.loop,
            loop_summary: appended.loop_summary,
            recommended_feature_status: appended.recommended_feature_status,
          };
        });

        await recordResponseOutput(
          config.repoPath,
          "tool:harness_loop_event",
          Buffer.byteLength(JSON.stringify(result, null, 2), "utf8"),
        ).catch(() => undefined);

        await logger.log("tool_call_finished", {
          tool: "harness_loop_event",
          ok: true,
          durationMs: Date.now() - startedAt,
          feature_id: result.feature_id,
          recommended_feature_status: result.recommended_feature_status,
        });
        return toSuccessResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_loop_event",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
