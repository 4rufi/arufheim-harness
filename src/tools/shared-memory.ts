import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

import {
  prepareRepoWriteTarget,
  resolveExistingWithinRepo,
} from "../safety.js";

export type MemType =
  | "decision"
  | "learning"
  | "note"
  | "blocker"
  | "session";

export interface MemEntry {
  id: number;
  timestamp: string;
  type: MemType;
  title: string;
  content: string;
  feature?: string;
  topic_key?: string;
  why?: string;
  where?: string;
  learned?: string;
  content_hash?: string;
  session_key?: string;
}

interface SearchOptions {
  query?: string;
  type?: MemType;
  feature?: string;
  limit?: number;
}

type MemoryRow = {
  id: number;
  timestamp: string;
  type: MemType;
  title: string;
  content: string;
  feature: string | null;
  topic_key: string | null;
  why: string | null;
  where_text: string | null;
  learned: string | null;
  content_hash: string;
  session_key: string | null;
};

function memoryDbPathFrom(relativePath: string): string {
  return relativePath.replace(/\.jsonl$/i, ".sqlite");
}

function computeContentHash(entry: Omit<MemEntry, "id" | "timestamp">): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        type: entry.type,
        title: entry.title,
        content: entry.content,
        feature: entry.feature ?? null,
        topic_key: entry.topic_key ?? null,
        why: entry.why ?? null,
        where: entry.where ?? null,
        learned: entry.learned ?? null,
        session_key: entry.session_key ?? null,
      }),
      "utf8",
    )
    .digest("hex");
}

function rowToEntry(row: MemoryRow): MemEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    title: row.title,
    content: row.content,
    ...(row.feature ? { feature: row.feature } : {}),
    ...(row.topic_key ? { topic_key: row.topic_key } : {}),
    ...(row.why ? { why: row.why } : {}),
    ...(row.where_text ? { where: row.where_text } : {}),
    ...(row.learned ? { learned: row.learned } : {}),
    ...(row.content_hash ? { content_hash: row.content_hash } : {}),
    ...(row.session_key ? { session_key: row.session_key } : {}),
  };
}

async function openMemoryDb(repoPath: string, relativePath: string) {
  const dbPath = await prepareRepoWriteTarget(
    repoPath,
    memoryDbPathFrom(relativePath),
  );
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      feature TEXT,
      topic_key TEXT,
      why TEXT,
      where_text TEXT,
      learned TEXT,
      content_hash TEXT NOT NULL UNIQUE,
      session_key TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_topic_key
      ON memories(topic_key)
      WHERE topic_key IS NOT NULL;
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      title,
      content,
      why,
      learned,
      tokenize = 'unicode61'
    );
  `);

  await importLegacyJsonlIfNeeded(db, repoPath, relativePath);
  return db;
}

async function importLegacyJsonlIfNeeded(
  db: DatabaseSync,
  repoPath: string,
  relativePath: string,
): Promise<void> {
  const countRow = db
    .prepare("SELECT COUNT(*) AS count FROM memories")
    .get() as { count: number };
  if (countRow.count > 0) return;

  let safePath: string;
  try {
    safePath = await resolveExistingWithinRepo(repoPath, relativePath);
  } catch {
    return;
  }

  let raw: string;
  try {
    raw = await readFile(safePath, "utf8");
  } catch {
    return;
  }

  const insertMemory = db.prepare(`
    INSERT OR IGNORE INTO memories (
      id, timestamp, type, title, content, feature, topic_key, why, where_text, learned, content_hash, session_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT OR REPLACE INTO memories_fts(rowid, title, content, why, learned)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = (entries: MemEntry[]) => {
    db.exec("BEGIN");
    try {
      for (const entry of entries) {
        const contentHash =
          entry.content_hash ??
        computeContentHash({
          type: entry.type,
          title: entry.title,
          content: entry.content,
          feature: entry.feature,
          topic_key: entry.topic_key,
          why: entry.why,
          where: entry.where,
          learned: entry.learned,
          session_key: entry.session_key,
        });
      insertMemory.run(
        entry.id,
        entry.timestamp,
        entry.type,
        entry.title,
        entry.content,
        entry.feature ?? null,
        entry.topic_key ?? null,
        entry.why ?? null,
        entry.where ?? null,
        entry.learned ?? null,
        contentHash,
        entry.session_key ?? null,
      );
      insertFts.run(
        entry.id,
        entry.title,
        entry.content,
        entry.why ?? "",
        entry.learned ?? "",
      );
    }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  const parsed: MemEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      parsed.push(JSON.parse(trimmed) as MemEntry);
    } catch {
      // keep migration resilient
    }
  }

  insertMany(parsed);
}

export async function readMemoryEntries(
  repoPath: string,
  relativePath: string,
): Promise<MemEntry[]> {
  const db = await openMemoryDb(repoPath, relativePath);
  try {
    const rows = db
      .prepare(`
        SELECT
          id,
          timestamp,
          type,
          title,
          content,
          feature,
          topic_key,
          why,
          where_text,
          learned,
          content_hash,
          session_key
        FROM memories
        ORDER BY id ASC
      `)
      .all() as MemoryRow[];
    return rows.map(rowToEntry);
  } finally {
    db.close();
  }
}

export async function appendMemoryEntry(
  repoPath: string,
  relativePath: string,
  entry: MemEntry,
): Promise<MemEntry> {
  const db = await openMemoryDb(repoPath, relativePath);
  try {
    const contentHash =
      entry.content_hash ??
      computeContentHash({
        type: entry.type,
        title: entry.title,
        content: entry.content,
        feature: entry.feature,
        topic_key: entry.topic_key,
        why: entry.why,
        where: entry.where,
        learned: entry.learned,
        session_key: entry.session_key,
      });

    const existing = db
      .prepare(`
        SELECT
          id,
          timestamp,
          type,
          title,
          content,
          feature,
          topic_key,
          why,
          where_text,
          learned,
          content_hash,
          session_key
        FROM memories
        WHERE content_hash = ?
      `)
      .get(contentHash) as MemoryRow | undefined;
    if (existing) {
      return rowToEntry(existing);
    }

    db.prepare(`
      INSERT INTO memories (
        id, timestamp, type, title, content, feature, topic_key, why, where_text, learned, content_hash, session_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.timestamp,
      entry.type,
      entry.title,
      entry.content,
      entry.feature ?? null,
      entry.topic_key ?? null,
      entry.why ?? null,
      entry.where ?? null,
      entry.learned ?? null,
      contentHash,
      entry.session_key ?? null,
    );

    db.prepare(`
      INSERT OR REPLACE INTO memories_fts(rowid, title, content, why, learned)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.title,
      entry.content,
      entry.why ?? "",
      entry.learned ?? "",
    );

    return {
      ...entry,
      content_hash: contentHash,
    };
  } finally {
    db.close();
  }
}

export async function upsertMemoryEntry(
  repoPath: string,
  relativePath: string,
  entry: MemEntry,
  topicKey: string,
): Promise<MemEntry> {
  const db = await openMemoryDb(repoPath, relativePath);
  try {
    const contentHash =
      entry.content_hash ??
      computeContentHash({
        type: entry.type,
        title: entry.title,
        content: entry.content,
        feature: entry.feature,
        topic_key: topicKey,
        why: entry.why,
        where: entry.where,
        learned: entry.learned,
        session_key: entry.session_key,
      });

    const duplicate = db
      .prepare(`
        SELECT
          id,
          timestamp,
          type,
          title,
          content,
          feature,
          topic_key,
          why,
          where_text,
          learned,
          content_hash,
          session_key
        FROM memories
        WHERE content_hash = ?
      `)
      .get(contentHash) as MemoryRow | undefined;
    if (duplicate) {
      return rowToEntry(duplicate);
    }

    const existing = db
      .prepare(`
        SELECT
          id,
          timestamp,
          type,
          title,
          content,
          feature,
          topic_key,
          why,
          where_text,
          learned,
          content_hash,
          session_key
        FROM memories
        WHERE topic_key = ?
      `)
      .get(topicKey) as MemoryRow | undefined;

    if (!existing) {
      return appendMemoryEntry(repoPath, relativePath, {
        ...entry,
        topic_key: topicKey,
        content_hash: contentHash,
      });
    }

    db.prepare(`
      UPDATE memories
      SET
        timestamp = ?,
        type = ?,
        title = ?,
        content = ?,
        feature = ?,
        topic_key = ?,
        why = ?,
        where_text = ?,
        learned = ?,
        content_hash = ?,
        session_key = ?
      WHERE id = ?
    `).run(
      entry.timestamp,
      entry.type,
      entry.title,
      entry.content,
      entry.feature ?? null,
      topicKey,
      entry.why ?? null,
      entry.where ?? null,
      entry.learned ?? null,
      contentHash,
      entry.session_key ?? null,
      existing.id,
    );

    db.prepare("DELETE FROM memories_fts WHERE rowid = ?").run(existing.id);
    db.prepare(`
      INSERT INTO memories_fts(rowid, title, content, why, learned)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      existing.id,
      entry.title,
      entry.content,
      entry.why ?? "",
      entry.learned ?? "",
    );

    return {
      ...entry,
      id: existing.id,
      topic_key: topicKey,
      content_hash: contentHash,
    };
  } finally {
    db.close();
  }
}

export async function getMemoryEntryById(
  repoPath: string,
  relativePath: string,
  id: number,
): Promise<MemEntry | null> {
  const db = await openMemoryDb(repoPath, relativePath);
  try {
    const row = db
      .prepare(`
        SELECT
          id,
          timestamp,
          type,
          title,
          content,
          feature,
          topic_key,
          why,
          where_text,
          learned,
          content_hash,
          session_key
        FROM memories
        WHERE id = ?
      `)
      .get(id) as MemoryRow | undefined;
    return row ? rowToEntry(row) : null;
  } finally {
    db.close();
  }
}

export async function searchMemoryEntries(
  repoPath: string,
  relativePath: string,
  options: SearchOptions,
): Promise<MemEntry[]> {
  const { query, type, feature, limit = 10 } = options;
  const db = await openMemoryDb(repoPath, relativePath);
  try {
    if (query && query.trim().length > 0) {
      const filters: string[] = ["memories_fts MATCH ?"];
      const params: Array<string | number> = [query.trim()];
      if (type) {
        filters.push("memories.type = ?");
        params.push(type);
      }
      if (feature) {
        filters.push("LOWER(COALESCE(memories.feature, '')) LIKE ?");
        params.push(`%${feature.toLowerCase()}%`);
      }
      params.push(limit);

      const rows = db
        .prepare(`
          SELECT
            memories.id,
            memories.timestamp,
            memories.type,
            memories.title,
            memories.content,
            memories.feature,
            memories.topic_key,
            memories.why,
            memories.where_text,
            memories.learned,
            memories.content_hash,
            memories.session_key
          FROM memories_fts
          JOIN memories ON memories_fts.rowid = memories.id
          WHERE ${filters.join(" AND ")}
          ORDER BY bm25(memories_fts), datetime(memories.timestamp) DESC
          LIMIT ?
        `)
        .all(...params) as MemoryRow[];
      return rows.map(rowToEntry);
    }

    const filters: string[] = [];
    const params: Array<string | number> = [];
    if (type) {
      filters.push("type = ?");
      params.push(type);
    }
    if (feature) {
      filters.push("LOWER(COALESCE(feature, '')) LIKE ?");
      params.push(`%${feature.toLowerCase()}%`);
    }
    params.push(limit);

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = db
      .prepare(`
        SELECT
          id,
          timestamp,
          type,
          title,
          content,
          feature,
          topic_key,
          why,
          where_text,
          learned,
          content_hash,
          session_key
        FROM memories
        ${whereClause}
        ORDER BY datetime(timestamp) DESC
        LIMIT ?
      `)
      .all(...params) as MemoryRow[];
    return rows.map(rowToEntry);
  } finally {
    db.close();
  }
}
