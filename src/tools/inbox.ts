import { mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { enforcePermissionPolicy } from "../policy.js";
import {
  recordRepoRead,
  recordRepoWrite,
  recordToolCall,
} from "../session-metrics.js";
import {
  prepareRepoWriteTarget,
  resolveExistingWithinRepo,
} from "../safety.js";
import { resolveWorkflowPaths } from "../workflow.js";

export function registerInboxTools(server: McpServer): void {
  // ── inbox_list ───────────────────────────────────────────────────────────
  server.registerTool(
    "inbox_list",
    {
      description:
        "Pending files in the workflow inbox with name, size, modified date.",
      inputSchema: {},
    },
    async () => {
      const config = await loadConfig();
      await recordToolCall(config.repoPath, "inbox_list");
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);

      let files: string[];
      let inboxAbs: string;
      try {
        inboxAbs = await resolveExistingWithinRepo(
          config.repoPath,
          workflowPaths.inboxDir,
        );
        files = await fg("*", {
          cwd: inboxAbs,
          ignore: ["processed/**"],
          onlyFiles: true,
          dot: false,
        });
      } catch {
        return {
          content: [
            {
              type: "text",
              text: "inbox no inicializado (directorio no encontrado)",
            },
          ],
        };
      }

      if (files.length === 0) {
        return {
          content: [
            { type: "text", text: "inbox vacío — no hay archivos pendientes" },
          ],
        };
      }

      const entries = await Promise.all(
        files.map(async (f) => {
          const abs = path.join(inboxAbs, f);
          try {
            const s = await stat(abs);
            return { name: f, size: s.size, modified: s.mtime.toISOString() };
          } catch {
            return { name: f, size: null, modified: null };
          }
        }),
      );
      await recordRepoRead(
        config.repoPath,
        Buffer.byteLength(JSON.stringify(entries), "utf8"),
      );

      return {
        content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
      };
    },
  );

  // ── inbox_consume ────────────────────────────────────────────────────────
  server.registerTool(
    "inbox_consume",
    {
      description: "Read inbox file, move to processed/, return content.",
      inputSchema: {
        filename: z.string().describe("Filename only, no path"),
      },
    },
    async ({ filename }) => {
      // Reject any path traversal attempts
      const safe = path.basename(filename);
      if (safe !== filename || safe === "" || safe === "." || safe === "..") {
        return {
          isError: true,
          content: [
            { type: "text", text: `Nombre de archivo inválido: ${filename}` },
          ],
        };
      }

      const config = await loadConfig();
      await recordToolCall(config.repoPath, "inbox_consume");
      enforcePermissionPolicy(config.permissionPolicy, "inbox_consume", "R2");
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const processedAbs = path.join(
        config.repoPath,
        workflowPaths.inboxProcessedDir,
      );
      const srcRelativePath = path.posix.join(workflowPaths.inboxDir, safe);
      const dstRelativePath = path.posix.join(
        workflowPaths.inboxProcessedDir,
        safe,
      );
      const dstPath = await prepareRepoWriteTarget(
        config.repoPath,
        dstRelativePath,
      );

      let content: string;
      try {
        const srcPath = await resolveExistingWithinRepo(
          config.repoPath,
          srcRelativePath,
        );
        content = await readFile(srcPath, "utf8");
        await recordRepoRead(
          config.repoPath,
          Buffer.byteLength(content, "utf8"),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `No se pudo leer ${safe}: ${msg}` }],
        };
      }

      try {
        await mkdir(processedAbs, { recursive: true });
        const srcPath = await resolveExistingWithinRepo(
          config.repoPath,
          srcRelativePath,
        );
        await rename(srcPath, dstPath);
        await recordRepoWrite(
          config.repoPath,
          Buffer.byteLength(content, "utf8"),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No se pudo mover ${safe} a processed/: ${msg}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `# ${safe}\n\n${content}\n\n---\n_Archivo movido a .harness/inbox/processed/_`,
          },
        ],
      };
    },
  );
}
