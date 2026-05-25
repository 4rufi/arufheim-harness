import { readFile } from "node:fs/promises";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ResolvedharnessConfig } from "../config.js";
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
  DEFAULT_HISTORY_MD,
  resolveWorkflowPaths,
} from "../workflow.js";

/**
 * Replace the body of a `## Heading` section in a markdown string.
 * If the section is missing, appends it at the end.
 */
function setSection(markdown: string, heading: string, body: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match heading + everything until next ## heading at line start or EOF
  const re = new RegExp(
    `((?:^|\\n)(## ${escaped})[ \\t]*\\n)([\\s\\S]*?)(?=\\n## |$)`,
  );
  const trimmed = body.trim();
  if (re.test(markdown)) {
    return markdown.replace(re, `$1\n${trimmed}\n`);
  }
  // Section not present — append
  return markdown.trimEnd() + `\n\n## ${heading}\n\n${trimmed}\n`;
}

export function registerProgressTools(
  server: McpServer,
  config: ResolvedharnessConfig,
  logger: JsonlLogger,
): void {
  // ── progress_set_plan ─────────────────────────────────────────────────────
  server.registerTool(
    "progress_set_plan",
    {
      title: "Progress Set Plan",
      description:
        "Replace the ## Plan section in current.md. Avoids reading + rewriting the whole file.",
      inputSchema: {
        content: z.string().min(1).describe("Plan text (markdown)"),
      },
    },
    async ({ content }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "progress_set_plan");
      await logger.log("tool_call_started", {
        tool: "progress_set_plan",
        input: { length: content.length },
      });
      try {
        enforcePermissionPolicy(config.permissionPolicy, "progress_set_plan", "R1");
        const workflowPaths = await resolveWorkflowPaths(config.repoPath);
        let current: string;
        try {
          const safePath = await resolveExistingWithinRepo(
            config.repoPath,
            workflowPaths.currentPath,
          );
          current = await readFile(safePath, "utf8");
        } catch {
          current = DEFAULT_CURRENT_MD;
        }
        const updated = setSection(current, "Plan", content);
        const handle = await openRepoWriteHandle(
          config.repoPath,
          workflowPaths.currentPath,
        );
        try {
          await handle.writeFile(updated, "utf8");
          await recordRepoWrite(
            config.repoPath,
            Buffer.byteLength(updated, "utf8"),
          );
        } finally {
          await handle.close();
        }

        await logger.log("tool_call_finished", {
          tool: "progress_set_plan",
          ok: true,
          durationMs: Date.now() - startedAt,
        });
        return toSuccessResult({ updated: workflowPaths.currentPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "progress_set_plan",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );

  // ── progress_next_step ────────────────────────────────────────────────────
  server.registerTool(
    "progress_next_step",
    {
      title: "Progress Next Step",
      description:
        "Replace the ## Próximo paso section in current.md. Avoids reading + rewriting the whole file.",
      inputSchema: {
        content: z.string().min(1).describe("Next step text (markdown)"),
      },
    },
    async ({ content }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "progress_next_step");
      await logger.log("tool_call_started", {
        tool: "progress_next_step",
        input: { length: content.length },
      });
      try {
        enforcePermissionPolicy(config.permissionPolicy, "progress_next_step", "R1");
        const workflowPaths = await resolveWorkflowPaths(config.repoPath);
        let current: string;
        try {
          const safePath = await resolveExistingWithinRepo(
            config.repoPath,
            workflowPaths.currentPath,
          );
          current = await readFile(safePath, "utf8");
        } catch {
          current = DEFAULT_CURRENT_MD;
        }
        const updated = setSection(current, "Próximo paso", content);
        const handle = await openRepoWriteHandle(
          config.repoPath,
          workflowPaths.currentPath,
        );
        try {
          await handle.writeFile(updated, "utf8");
          await recordRepoWrite(
            config.repoPath,
            Buffer.byteLength(updated, "utf8"),
          );
        } finally {
          await handle.close();
        }

        await logger.log("tool_call_finished", {
          tool: "progress_next_step",
          ok: true,
          durationMs: Date.now() - startedAt,
        });
        return toSuccessResult({ updated: workflowPaths.currentPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "progress_next_step",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );

  // ── history_append ────────────────────────────────────────────────────────
  server.registerTool(
    "history_append",
    {
      title: "History Append",
      description:
        "Append a session summary to history.md without reading the full file. Use at session close.",
      inputSchema: {
        agente: z
          .string()
          .min(1)
          .describe("Agent or role that ran the session"),
        plan: z.string().min(1).describe("What was planned"),
        cambios: z.string().min(1).describe("Files or code changed"),
        verificacion: z.string().min(1).describe("How it was verified"),
        cierre: z.string().min(1).describe("Final status or notes"),
      },
    },
    async ({ agente, plan, cambios, verificacion, cierre }) => {
      const startedAt = Date.now();
      await recordToolCall(config.repoPath, "history_append");
      await logger.log("tool_call_started", {
        tool: "history_append",
        input: { agente },
      });
      try {
        enforcePermissionPolicy(config.permissionPolicy, "history_append", "R1");
        const workflowPaths = await resolveWorkflowPaths(config.repoPath);
        const date = new Date().toISOString().slice(0, 10);
        let history = DEFAULT_HISTORY_MD;
        try {
          const safePath = await resolveExistingWithinRepo(
            config.repoPath,
            workflowPaths.historyPath,
          );
          history = await readFile(safePath, "utf8");
        } catch {
          // Create from default header below.
        }
        const entry = [
          `## ${date} — Sesión cerrada`,
          `- **Agente:** ${agente}`,
          `- **Plan:** ${plan}`,
          `- **Cambios:** ${cambios}`,
          `- **Verificación:** ${verificacion}`,
          `- **Cierre:** ${cierre}`,
          ``,
        ].join("\n");
        const updated = history.trimEnd() + "\n\n" + entry;
        const handle = await openRepoWriteHandle(
          config.repoPath,
          workflowPaths.historyPath,
        );
        try {
          await handle.writeFile(updated, "utf8");
          await recordRepoWrite(
            config.repoPath,
            Buffer.byteLength(updated, "utf8"),
          );
        } finally {
          await handle.close();
        }

        await logger.log("tool_call_finished", {
          tool: "history_append",
          ok: true,
          durationMs: Date.now() - startedAt,
        });
        return toSuccessResult({
          appended_to: workflowPaths.historyPath,
          date,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log("tool_call_finished", {
          tool: "history_append",
          ok: false,
          durationMs: Date.now() - startedAt,
          error: message,
        });
        return toErrorResult(message);
      }
    },
  );
}
