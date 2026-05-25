import { readFile } from "node:fs/promises";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fg from "fast-glob";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import { summarizePermissionPolicy } from "../policy.js";
import { readSessionMetrics, recordToolCall } from "../session-metrics.js";
import {
  resolveExistingWithinRepo,
  toErrorResult,
  toSuccessResult,
} from "../safety.js";
import { readMemoryEntries } from "./shared-memory.js";
import {
  parseFeatureHistoryText,
  parseFeatureListText,
  resolveWorkflowPaths,
} from "../workflow.js";

interface Feature {
  id: number;
  name: string;
  description?: string;
  status: string;
  sdd?: boolean;
}

function isPlaceholderBody(text: string): boolean {
  return text === "_—_" || text === "_Nada pendiente._";
}

async function readRecentBlockers(
  repoPath: string,
  memoryPath: string,
  limit = 3,
) {
  const entries = await readMemoryEntries(repoPath, memoryPath);
  return entries
    .filter((entry) => entry.type === "blocker")
    .slice(-limit)
    .reverse()
    .map(({ id, timestamp, title, content, feature }) => ({
      id,
      timestamp,
      title,
      content,
      feature,
    }));
}

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
          .enum(["full", "brief_only"])
          .optional()
          .describe("Use brief_only to minimize token usage at startup."),
      },
    },
    async ({ mode }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "harness_status");

      await logger.log("tool_call_started", { tool: "harness_status" });

      try {
        const repoPath = config.repoPath;
        const workflowPaths = await resolveWorkflowPaths(repoPath);

        // All data in parallel
        const [features, archivedFeatures, currentMd, inboxFiles, recentBlockers] =
          await Promise.all([
            resolveExistingWithinRepo(repoPath, workflowPaths.featureListPath)
              .then((safePath) => readFile(safePath, "utf8"))
              .then((raw) => parseFeatureListText(raw).features as Feature[])
              .catch(() => [] as Feature[]),
            resolveExistingWithinRepo(repoPath, workflowPaths.featureHistoryPath)
              .then((safePath) => readFile(safePath, "utf8"))
              .then((raw) => parseFeatureHistoryText(raw) as Feature[])
              .catch(() => [] as Feature[]),
            resolveExistingWithinRepo(repoPath, workflowPaths.currentPath)
              .then((safePath) => readFile(safePath, "utf8"))
              .catch(() => ""),
            resolveExistingWithinRepo(repoPath, workflowPaths.inboxDir)
              .then((safeInboxDir) =>
                fg("*", {
                  cwd: safeInboxDir,
                  onlyFiles: true,
                  dot: false,
                  ignore: ["processed/**"],
                }),
              )
              .catch(() => [] as string[]),
            readRecentBlockers(repoPath, workflowPaths.memoryPath),
          ]);

        const activeFeature =
          features.find((f) => f.status === "in_progress") ?? null;
        const pendingFeatures = features.filter((f) => f.status === "pending");
        const specReadyFeatures = features.filter(
          (f) => f.status === "spec_ready",
        );
        const blockedFeatures = features.filter((f) => f.status === "blocked");

        // Extract "## Próximo paso" section from current.md
        let nextStep = "(sin plan activo)";
        const match = currentMd.match(
          /##\s+Próximo paso\s*\n([\s\S]*?)(?=\n##|$)/,
        );
        if (match) {
          const text = match[1].trim();
          if (text && !isPlaceholderBody(text)) {
            nextStep = text;
          }
        }

        const activeLabel = activeFeature
          ? `${activeFeature.id}:${activeFeature.name}:${activeFeature.status}`
          : "none";
        const specReadyLabel =
          specReadyFeatures.length > 0
            ? specReadyFeatures
                .map((feature) => `${feature.id}:${feature.name}`)
                .join(", ")
            : "none";
        const pendingLabel =
          pendingFeatures.length > 0
            ? pendingFeatures
                .slice(0, 5)
                .map((feature) => `${feature.id}:${feature.name}`)
                .join(", ")
            : "none";
        const blockedLabel =
          blockedFeatures.length > 0
            ? blockedFeatures
                .slice(0, 5)
                .map((feature) => `${feature.id}:${feature.name}`)
                .join(", ")
            : "none";
        const inboxLabel =
          inboxFiles.length > 0 ? inboxFiles.slice(0, 5).join(", ") : "none";
        const startupBrief = [
          `active=${activeLabel}`,
          `next=${nextStep}`,
          `spec_ready=${specReadyLabel}`,
          `pending=${pendingLabel}`,
          `blocked=${blockedLabel}`,
          `inbox=${inboxLabel}`,
        ].join(" | ");

        if (mode === "brief_only") {
          const briefResult = {
            startup_brief: startupBrief,
            active_feature: activeFeature,
            next_step: nextStep,
            pending_count: pendingFeatures.length,
            spec_ready_count: specReadyFeatures.length,
            blocked_count: blockedFeatures.length,
            inbox_count: inboxFiles.length,
            archived_count: archivedFeatures.length,
          };

          await logger.log("tool_call_finished", {
            tool: "harness_status",
            ok: true,
            durationMs: Date.now() - startedAt,
            mode: "brief_only",
            active: !!activeFeature,
            inbox_count: inboxFiles.length,
            spec_ready_count: specReadyFeatures.length,
            blocked_count: blockedFeatures.length,
          });

          return toSuccessResult(briefResult);
        }

        const result = {
          initialized:
            features.length > 0 ||
            archivedFeatures.length > 0 ||
            inboxFiles.length > 0,
          active_feature: activeFeature,
          spec_ready_features: specReadyFeatures,
          blocked_features: blockedFeatures,
          pending_features: pendingFeatures,
          next_step: nextStep,
          inbox_pending: inboxFiles,
          total_features: features.length,
          archived_features_count: archivedFeatures.length,
          recent_memory_blockers: recentBlockers,
          session_metrics: await readSessionMetrics(repoPath),
          permission_policy: summarizePermissionPolicy(config.permissionPolicy),
          startup_brief: startupBrief,
        };

        await logger.log("tool_call_finished", {
          tool: "harness_status",
          ok: true,
          durationMs: Date.now() - startedAt,
          active: !!activeFeature,
          inbox_count: inboxFiles.length,
          spec_ready_count: specReadyFeatures.length,
          blocked_count: blockedFeatures.length,
        });

        return toSuccessResult(result);
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
