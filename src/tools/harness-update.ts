import { readFile } from "node:fs/promises";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
import { refreshActiveHeadSummary } from "../headroom.js";
import {
  ensureLoopForFeature,
  syncExistingLoopIdentity,
  syncLoopTerminalState,
} from "../loop.js";
import { JsonlLogger } from "../logger.js";
import { enforcePermissionPolicy } from "../policy.js";
import { recordRepoWrite, recordToolCall } from "../session-metrics.js";
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
  withWorkflowWriteLock,
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

const REQUIRED_SDD_SPEC_FILES = [
  "requirements.md",
  "design.md",
  "tasks.md",
  "spec_summary.md",
] as const;

const SDD_SPEC_STATUSES = new Set<FeatureStatus>([
  "spec_ready",
  "in_progress",
  "done",
]);

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
      await recordToolCall(config.repoPath, "harness_update");

      await logger.log("tool_call_started", {
        tool: "harness_update",
        input: { id, status },
      });

      try {
        enforcePermissionPolicy(config.permissionPolicy, "harness_update", "R1");
        const result = await withWorkflowWriteLock(config.repoPath, async () => {
          const workflowPaths = await resolveWorkflowPaths(config.repoPath);
          const safePath = await resolveExistingWithinRepo(
            config.repoPath,
            workflowPaths.featureListPath,
          );
          const raw = await readFile(safePath, "utf8");
          const document = parseFeatureListText(raw);
          const features = document.features as Feature[];

          const idx = features.findIndex((f) => f.id === id);
          if (idx === -1) {
            throw new Error(
              `Feature id=${id} not found in .harness/feature_list.json.`,
            );
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

          if (nextFeature.sdd === true && SDD_SPEC_STATUSES.has(status)) {
            await assertFeatureSpecExists(
              config.repoPath,
              nextFeature.name,
            );
          }

          let archivedFeature: Feature | null = null;
          if (status === "done") {
            if (nextFeature.sdd === true) {
              await assertFeatureCanClose(
                config.repoPath,
                workflowPaths.currentPath,
                nextFeature.name,
              );
            }
            await syncLoopTerminalState(
              config.repoPath,
              nextFeature,
              config.loopPolicy,
              "done",
            );
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

            const archiveSerialized = serializeFeatureHistory(archivedFeatures);
            const archiveHandle = await openRepoWriteHandle(
              config.repoPath,
              workflowPaths.featureHistoryPath,
            );
            try {
              await archiveHandle.writeFile(archiveSerialized, "utf8");
              await recordRepoWrite(
                config.repoPath,
                Buffer.byteLength(archiveSerialized, "utf8"),
              );
            } finally {
              await archiveHandle.close();
            }
          } else {
            if (status === "in_progress") {
              await ensureLoopForFeature(
                config.repoPath,
                nextFeature,
                config.loopPolicy,
              );
            } else if (status === "blocked") {
              await syncLoopTerminalState(
                config.repoPath,
                nextFeature,
                config.loopPolicy,
                "blocked",
              );
            } else if (name !== undefined) {
              await syncExistingLoopIdentity(
                config.repoPath,
                nextFeature,
                config.loopPolicy,
              );
            }
            features[idx] = nextFeature;
          }

          const serialized = serializeFeatureList({
            ...document,
            features,
          });
          const handle = await openRepoWriteHandle(
            config.repoPath,
            workflowPaths.featureListPath,
          );
          try {
            await handle.writeFile(serialized, "utf8");
            await recordRepoWrite(
              config.repoPath,
              Buffer.byteLength(serialized, "utf8"),
            );
          } finally {
            await handle.close();
          }

          await refreshActiveHeadSummary(config.repoPath).catch(() => undefined);

          return {
            updated: archivedFeature ?? nextFeature,
            total_features: features.length,
          };
        });

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
      await recordToolCall(config.repoPath, "harness_add");

      await logger.log("tool_call_started", {
        tool: "harness_add",
        input: { name },
      });

      try {
        enforcePermissionPolicy(config.permissionPolicy, "harness_add", "R1");
        const result = await withWorkflowWriteLock(config.repoPath, async () => {
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

          const serialized = serializeFeatureList({
            ...document,
            features,
          });
          const handle = await openRepoWriteHandle(
            config.repoPath,
            workflowPaths.featureListPath,
          );
          try {
            await handle.writeFile(serialized, "utf8");
            await recordRepoWrite(
              config.repoPath,
              Buffer.byteLength(serialized, "utf8"),
            );
          } finally {
            await handle.close();
          }

          return {
            added: newFeature,
            total_features: features.length,
          };
        });

        await logger.log("tool_call_finished", {
          tool: "harness_add",
          ok: true,
          durationMs: Date.now() - startedAt,
          id: result.added.id,
        });

        return toSuccessResult(result);
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
      await recordToolCall(config.repoPath, "harness_log");

      await logger.log("tool_call_started", {
        tool: "harness_log",
        input: { entry },
      });

      try {
        enforcePermissionPolicy(config.permissionPolicy, "harness_log", "R1");
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
          await recordRepoWrite(
            config.repoPath,
            Buffer.byteLength(content, "utf8"),
          );
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

async function assertFeatureSpecExists(
  repoPath: string,
  featureName: string,
): Promise<void> {
  for (const fileName of REQUIRED_SDD_SPEC_FILES) {
    const specPath = path.join("specs", featureName, fileName);
    try {
      await resolveExistingWithinRepo(repoPath, specPath);
    } catch {
      throw new Error(
        `Feature ${featureName} requires ${specPath} before entering this SDD state.`,
      );
    }
  }
}

async function assertFeatureCanClose(
  repoPath: string,
  currentPath: string,
  featureName: string,
): Promise<void> {
  const progressDir = path.dirname(currentPath);
  const implPath = path.join(progressDir, `impl_${featureName}.md`);
  const reviewPath = path.join(progressDir, `review_${featureName}.md`);

  const implSafePath = await readRequiredWorkflowArtifact(
    repoPath,
    implPath,
    `Feature ${featureName} cannot close without ${implPath}.`,
  );
  const implText = await readFile(implSafePath, "utf8");
  if (!/R\d+\s*(->|→)/.test(implText)) {
    throw new Error(
      `${implPath} must include traceability in the form R<n> -> verification before closing the feature.`,
    );
  }

  const reviewSafePath = await readRequiredWorkflowArtifact(
    repoPath,
    reviewPath,
    `Feature ${featureName} cannot close without ${reviewPath}.`,
  );
  const reviewText = await readFile(reviewSafePath, "utf8");
  if (!/^- \[[xX]\]/m.test(reviewText)) {
    throw new Error(
      `${reviewPath} must include a checked review checklist before closing the feature.`,
    );
  }
  if (!/\b(APROBADO|APPROVED)\b/i.test(reviewText)) {
    throw new Error(
      `${reviewPath} must include an APROBADO/APPROVED verdict before closing the feature.`,
    );
  }
}

async function readRequiredWorkflowArtifact(
  repoPath: string,
  relativePath: string,
  missingMessage: string,
): Promise<string> {
  try {
    return await resolveExistingWithinRepo(repoPath, relativePath);
  } catch {
    throw new Error(missingMessage);
  }
}
