import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { JsonlLogger } from "../logger.js";
import {
  openRepoWriteHandle,
  resolveExistingWithinRepo,
  toErrorResult,
  toSuccessResult,
} from "../safety.js";
import {
  DEFAULT_CURRENT_MD,
  type ParsedFeatureList,
  parseFeatureHistoryText,
  parseFeatureListText,
  resolveWorkflowPaths,
  serializeFeatureHistory,
  serializeFeatureList,
  type WorkflowFeature,
} from "../workflow.js";

const VALID_STATUSES = [
  "pending",
  "spec_ready",
  "in_progress",
  "done",
  "blocked",
] as const;
type FeatureStatus = (typeof VALID_STATUSES)[number];

type Feature = WorkflowFeature & { status: FeatureStatus };

export function registerHarnessUpdateTool(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  server.registerTool(
    "harness_update",
    {
      title: "Harness Update Feature",
      description:
        "Atomically update a feature's status/name in .harness/feature_list.json. Enforces single in_progress.",
      inputSchema: {
        id: z.number().int().positive().describe("Feature id"),
        status: z
          .enum(VALID_STATUSES)
          .describe("pending | spec_ready | in_progress | done | blocked"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
      },
    },
    async ({ id, status, name, description }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "harness_update",
        input: { id, status },
      });

      try {
        // Enforce single in_progress invariant
        const workflowPaths = await resolveWorkflowPaths(config.repoPath);
        const filePath = path.join(config.repoPath, workflowPaths.featureListPath);
        const safePath = await resolveExistingWithinRepo(
          config.repoPath,
          workflowPaths.featureListPath,
        );
        const raw = await readFile(safePath, "utf8");
        const document = parseFeatureListText(raw);
        const features = document.features as Feature[];

        const idx = features.findIndex((f) => f.id === id);
        if (idx === -1) {
          throw new Error(`Feature id=${id} not found in .harness/feature_list.json.`);
        }

        if (status === "in_progress") {
          const current = features.find(
            (f) => f.status === "in_progress" && f.id !== id,
          );
          if (current) {
            throw new Error(
              `Feature id=${current.id} (${current.name}) is already in_progress. Finish it before starting another.`,
            );
          }
        }

        const nextFeature = {
          ...features[idx],
          status,
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
        };

        let archivedFeature: Feature | null = null;
        if (status === "done") {
          archivedFeature = {
            ...nextFeature,
            closed_at: new Date().toISOString(),
          };
          features.splice(idx, 1);

          let archivedFeatures: Feature[] = [];
          try {
            const archiveSafePath = await resolveExistingWithinRepo(
              config.repoPath,
              workflowPaths.featureHistoryPath,
            );
            const archiveRaw = await readFile(archiveSafePath, "utf8");
            archivedFeatures = parseFeatureHistoryText(archiveRaw) as Feature[];
          } catch {
            archivedFeatures = [];
          }
          archivedFeatures.push(archivedFeature);

          const archiveHandle = await openRepoWriteHandle(
            config.repoPath,
            workflowPaths.featureHistoryPath,
          );
          try {
            await archiveHandle.writeFile(
              serializeFeatureHistory(archivedFeatures),
              "utf8",
            );
          } finally {
            await archiveHandle.close();
          }
        } else {
          features[idx] = nextFeature;
        }

        const handle = await openRepoWriteHandle(config.repoPath, workflowPaths.featureListPath);
        try {
          await handle.writeFile(
            serializeFeatureList({
              ...document,
              features,
            }),
            "utf8",
          );
        } finally {
          await handle.close();
        }

        const result = {
          updated: archivedFeature ?? nextFeature,
          total_features: features.length,
        };

        await logger.log("tool_call_finished", {
          tool: "harness_update",
          ok: true,
          durationMs: Date.now() - startedAt,
          id,
          status,
        });

        return toSuccessResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_update",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );

  server.registerTool(
    "harness_add",
    {
      title: "Harness Add Feature",
      description:
        "Add a new feature to .harness/feature_list.json with status pending.",
      inputSchema: {
        name: z.string().min(1).describe("Feature name"),
        description: z.string().describe("What it resolves"),
        sdd: z
          .boolean()
          .optional()
          .describe("Requires SDD spec flow (default: false)"),
      },
    },
    async ({ name, description, sdd }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "harness_add",
        input: { name },
      });

      try {
        const workflowPaths = await resolveWorkflowPaths(config.repoPath);
        let document: ParsedFeatureList = {
          shape: "object",
          root: {
            project: path.basename(config.repoPath) || "project",
            description: "Backlog SDD del repo.",
            rules: {
              one_feature_at_a_time: true,
              require_green_verification_to_close: true,
              require_approved_spec_to_implement: true,
              valid_status: [
                "pending",
                "spec_ready",
                "in_progress",
                "done",
                "blocked",
              ],
              sdd_required_when: 'feature has "sdd": true',
              scope_field:
                "opcional; usado por scoper para filtrar por proyecto",
            },
            features: [],
          },
          features: [] as Feature[],
        };
        let features: Feature[] = [];
        try {
          const safePath = await resolveExistingWithinRepo(
            config.repoPath,
            workflowPaths.featureListPath,
          );
          const raw = await readFile(safePath, "utf8");
          const parsed = parseFeatureListText(raw);
          document = {
            shape: parsed.shape,
            features: parsed.features as Feature[],
            ...(parsed.root && { root: parsed.root }),
          };
          features = document.features as Feature[];
        } catch {
          // empty or missing — start fresh
        }

        const nextId =
          features.length > 0 ? Math.max(...features.map((f) => f.id)) + 1 : 1;

        const newFeature: Feature = {
          id: nextId,
          name,
          description,
          status: "pending",
          ...(sdd !== undefined && { sdd }),
        };

        features.push(newFeature);

        const handle = await openRepoWriteHandle(
          config.repoPath,
          workflowPaths.featureListPath,
        );
        try {
          await handle.writeFile(
            serializeFeatureList({
              ...document,
              features,
            }),
            "utf8",
          );
        } finally {
          await handle.close();
        }

        await logger.log("tool_call_finished", {
          tool: "harness_add",
          ok: true,
          durationMs: Date.now() - startedAt,
          id: nextId,
        });

        return toSuccessResult({
          added: newFeature,
          total_features: features.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_add",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );

  server.registerTool(
    "harness_log",
    {
      title: "Harness Log",
      description: "Append a timestamped entry to the Bitácora in current.md.",
      inputSchema: {
        entry: z.string().min(1).describe("Text to append"),
      },
    },
    async ({ entry }) => {
      const startedAt = Date.now();

      await logger.log("tool_call_started", {
        tool: "harness_log",
        input: { entry },
      });

      try {
        const workflowPaths = await resolveWorkflowPaths(config.repoPath);
        let content: string;
        try {
          const safePath = await resolveExistingWithinRepo(
            config.repoPath,
            workflowPaths.currentPath,
          );
          content = await readFile(safePath, "utf8");
        } catch {
          content = DEFAULT_CURRENT_MD;
        }

        const timestamp = new Date()
          .toISOString()
          .slice(0, 16)
          .replace("T", " ");
        const line = `- ${timestamp} — ${entry}`;

        // Replace known placeholders or append under ## Bitácora
        if (content.includes("_Sin entradas._")) {
          content = content.replace("_Sin entradas._", line);
        } else if (content.includes("_—_")) {
          content = content.replace(
            /(##\s+Bitácora\s*\n)\s*_—_\s*(\n##\s+Próximo paso)/,
            `$1${line}\n$2`,
          );
        } else {
          // Append after the last line of the Bitácora section
          content = content.replace(
            /(##\s+Bitácora[\s\S]*?)(##\s+Próximo paso)/,
            (_, bitacora, next) => `${bitacora.trimEnd()}\n${line}\n\n${next}`,
          );
        }

        const handle = await openRepoWriteHandle(
          config.repoPath,
          workflowPaths.currentPath,
        );
        try {
          await handle.writeFile(content, "utf8");
        } finally {
          await handle.close();
        }

        await logger.log("tool_call_finished", {
          tool: "harness_log",
          ok: true,
          durationMs: Date.now() - startedAt,
        });

        return toSuccessResult({ logged: line });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "harness_log",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
