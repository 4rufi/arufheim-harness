import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { resolveWorkflowPaths } from "../workflow.js";
import {
  appendMemoryEntry,
  getMemoryEntryById,
  MemEntry,
  MemType,
  readMemoryEntries,
  searchMemoryEntries,
  upsertMemoryEntry,
} from "./shared-memory.js";

const VALID_TYPES: MemType[] = [
  "decision",
  "learning",
  "note",
  "blocker",
  "session",
];

function compactMemoryShape(entry: MemEntry) {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    feature: entry.feature,
    timestamp: entry.timestamp,
    ...(entry.why ? { why: entry.why } : {}),
    ...(entry.where ? { where: entry.where } : {}),
    ...(entry.learned ? { learned: entry.learned } : {}),
    summary:
      entry.content.length > 160
        ? `${entry.content.slice(0, 157)}...`
        : entry.content,
  };
}

export function registerMemoryTools(server: McpServer): void {
  // ── mem_save ─────────────────────────────────────────────────────────────
  server.registerTool(
    "mem_save",
    {
      description:
        "Persist a memory entry to .harness/memory.jsonl. Survives context resets.",
      inputSchema: {
        title: z.string().min(1).describe("Short title"),
        content: z.string().min(1).describe("Detailed content"),
        type: z
          .enum(["decision", "learning", "note", "blocker", "session"])
          .describe("Entry type"),
        feature: z.string().optional().describe("Related feature name"),
        topic_key: z
          .string()
          .optional()
          .describe("Dedup key; upserts if already exists"),
        why: z.string().optional().describe("Rationale"),
        where: z.string().optional().describe("Location context"),
        learned: z.string().optional().describe("Lesson learned"),
      },
    },
    async ({
      title,
      content,
      type,
      feature,
      topic_key,
      why,
      where,
      learned,
    }) => {
      if (!VALID_TYPES.includes(type as MemType)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tipo inválido: ${type}. Válidos: ${VALID_TYPES.join(", ")}`,
            },
          ],
        };
      }

      const config = await loadConfig();
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const existing = await readMemoryEntries(
        config.repoPath,
        workflowPaths.memoryPath,
      );
      const nextId =
        existing.length > 0 ? Math.max(...existing.map((e) => e.id)) + 1 : 1;

      const entry: MemEntry = {
        id: nextId,
        timestamp: new Date().toISOString(),
        type: type as MemType,
        title,
        content,
        ...(feature ? { feature } : {}),
        ...(topic_key ? { topic_key } : {}),
        ...(why ? { why } : {}),
        ...(where ? { where } : {}),
        ...(learned ? { learned } : {}),
      };

      if (topic_key) {
        const saved = await upsertMemoryEntry(
          config.repoPath,
          workflowPaths.memoryPath,
          entry,
          topic_key,
        );
        const verb = saved.id === nextId ? "guardada" : "actualizada";
        return {
          content: [
            {
              type: "text",
              text: `Memoria #${saved.id} ${verb}: [${type}] ${title}`,
            },
          ],
        };
      }

      const saved = await appendMemoryEntry(
        config.repoPath,
        workflowPaths.memoryPath,
        entry,
      );

      return {
        content: [
          {
            type: "text",
            text: `Memoria #${saved.id} guardada: [${type}] ${title}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "mem_session_summary",
    {
      description:
        "Save or update a compact end-of-session summary. Survives compaction and is optimized for later retrieval.",
      inputSchema: {
        title: z.string().min(1).describe("Short session title"),
        what: z.string().min(1).describe("What changed"),
        why: z.string().optional().describe("Why it mattered"),
        where: z.string().optional().describe("Files or subsystem touched"),
        learned: z.string().optional().describe("Key lesson or follow-up"),
        next_step: z.string().optional().describe("What should happen next"),
        feature: z.string().optional().describe("Related feature"),
        topic_key: z
          .string()
          .optional()
          .describe("Optional upsert key for repeated session summaries"),
        session_key: z
          .string()
          .optional()
          .describe("Stable key for one session across retries"),
      },
    },
    async ({
      title,
      what,
      why,
      where,
      learned,
      next_step,
      feature,
      topic_key,
      session_key,
    }) => {
      const config = await loadConfig();
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const existing = await readMemoryEntries(
        config.repoPath,
        workflowPaths.memoryPath,
      );
      const nextId =
        existing.length > 0 ? Math.max(...existing.map((e) => e.id)) + 1 : 1;

      const content = [
        `What: ${what}`,
        ...(why ? [`Why: ${why}`] : []),
        ...(where ? [`Where: ${where}`] : []),
        ...(learned ? [`Learned: ${learned}`] : []),
        ...(next_step ? [`Next: ${next_step}`] : []),
      ].join("\n");

      const entry: MemEntry = {
        id: nextId,
        timestamp: new Date().toISOString(),
        type: "session",
        title,
        content,
        ...(feature ? { feature } : {}),
        ...(topic_key ? { topic_key } : {}),
        ...(session_key ? { session_key } : {}),
        ...(why ? { why } : {}),
        ...(where ? { where } : {}),
        ...(learned ? { learned } : {}),
      };

      const upsertKey = topic_key ?? session_key;
      const saved = upsertKey
        ? await upsertMemoryEntry(
            config.repoPath,
            workflowPaths.memoryPath,
            entry,
            upsertKey,
          )
        : await appendMemoryEntry(config.repoPath, workflowPaths.memoryPath, entry);

      return {
        content: [
          {
            type: "text",
            text: `Resumen de sesión #${saved.id} guardado: ${title}`,
          },
        ],
      };
    },
  );

  // ── mem_search ───────────────────────────────────────────────────────────
  server.registerTool(
    "mem_search",
    {
      description: "Search .harness/memory.jsonl by text, type, or feature.",
      inputSchema: {
        query: z.string().describe("Text to search in title and content"),
        type: z
          .enum(["decision", "learning", "note", "blocker", "session"])
          .optional()
          .describe("Filter by type"),
        feature: z.string().optional().describe("Filter by feature"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results (default: 10)"),
        full: z
          .boolean()
          .optional()
          .describe("Return full entry (default: false)"),
      },
    },
    async ({ query, type, feature, limit = 10, full = false }) => {
      const config = await loadConfig();
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const results = await searchMemoryEntries(
        config.repoPath,
        workflowPaths.memoryPath,
        { query, type, feature, limit },
      );

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: "Sin entradas de memoria aún." }],
        };
      }

      if (full) {
        const lines = results.map((e) => {
          const feat = e.feature ? ` (${e.feature})` : "";
          const date = e.timestamp.slice(0, 10);
          return `## #${e.id} [${e.type}] ${e.title}${feat} — ${date}\n\n${e.content}`;
        });
        return {
          content: [{ type: "text", text: lines.join("\n\n---\n\n") }],
        };
      }

      const compact = results.map(compactMemoryShape);

      return {
        content: [{ type: "text", text: JSON.stringify(compact, null, 2) }],
      };
    },
  );

  // ── mem_get ──────────────────────────────────────────────────────────────
  server.registerTool(
    "mem_get",
    {
      description: "Get a single memory entry by id.",
      inputSchema: {
        id: z.number().int().positive().describe("Entry id"),
      },
    },
    async ({ id }) => {
      const config = await loadConfig();
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const entry = await getMemoryEntryById(
        config.repoPath,
        workflowPaths.memoryPath,
        id,
      );
      if (!entry) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No existe entrada con id ${id} en memoria.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
      };
    },
  );

  // ── mem_context ──────────────────────────────────────────────────────────
  server.registerTool(
    "mem_context",
    {
      description:
        "Get the most recent memory entries as compact summaries. Use at session start for context.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Optional text query for relevant context"),
        feature: z.string().optional().describe("Filter by feature"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Max results (default: 5)"),
      },
    },
    async ({ query, feature, limit = 5 }) => {
      const config = await loadConfig();
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const entries = await searchMemoryEntries(
        config.repoPath,
        workflowPaths.memoryPath,
        {
          query,
          feature,
          limit,
        },
      );

      const compact = entries.map(compactMemoryShape);

      return {
        content: [{ type: "text", text: JSON.stringify(compact, null, 2) }],
      };
    },
  );

  server.registerTool(
    "mem_get_observation",
    {
      description:
        "Alias of mem_get. Use after mem_context or mem_search when you need the full stored observation.",
      inputSchema: {
        id: z.number().int().positive().describe("Entry id"),
      },
    },
    async ({ id }) => {
      const config = await loadConfig();
      const workflowPaths = await resolveWorkflowPaths(config.repoPath);
      const entry = await getMemoryEntryById(
        config.repoPath,
        workflowPaths.memoryPath,
        id,
      );

      if (!entry) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No existe entrada con id ${id} en memoria.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
      };
    },
  );
}
