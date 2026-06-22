import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveWorkflowPaths } from "./workflow.js";

export interface SessionMetrics {
  started_at: string;
  updated_at: string;
  tool_calls: number;
  tool_calls_by_name: Record<string, number>;
  response_output_bytes: number;
  response_output_tokens: number;
  response_output_bytes_by_surface: Record<string, number>;
  response_output_tokens_by_surface: Record<string, number>;
  repo_reads: number;
  repo_read_bytes: number;
  repo_writes: number;
  repo_write_bytes: number;
  memory_reads: number;
  memory_read_bytes: number;
  memory_writes: number;
  memory_write_bytes: number;
  command_calls: number;
  command_output_bytes: number;
  estimated_local_tokens: number;
}

type MetricsMutation = (metrics: SessionMetrics) => void;

const writeLocks = new Map<string, Promise<void>>();

export function estimateLocalTokens(bytes: number): number {
  return Math.ceil(bytes / 4);
}

export function estimateSerializedPayload(value: unknown): {
  bytes: number;
  tokens: number;
  text: string;
} {
  const text = JSON.stringify(value, null, 2);
  const bytes = Buffer.byteLength(text, "utf8");
  return {
    bytes,
    tokens: estimateLocalTokens(bytes),
    text,
  };
}

function emptyMetrics(): SessionMetrics {
  const now = new Date().toISOString();
  return {
    started_at: now,
    updated_at: now,
    tool_calls: 0,
    tool_calls_by_name: {},
    response_output_bytes: 0,
    response_output_tokens: 0,
    response_output_bytes_by_surface: {},
    response_output_tokens_by_surface: {},
    repo_reads: 0,
    repo_read_bytes: 0,
    repo_writes: 0,
    repo_write_bytes: 0,
    memory_reads: 0,
    memory_read_bytes: 0,
    memory_writes: 0,
    memory_write_bytes: 0,
    command_calls: 0,
    command_output_bytes: 0,
    estimated_local_tokens: 0,
  };
}

async function metricsPathFor(repoPath: string): Promise<string> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  return path.join(repoPath, workflowPaths.metricsPath);
}

async function readMetricsFile(repoPath: string): Promise<SessionMetrics> {
  const filePath = await metricsPathFor(repoPath);
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      ...emptyMetrics(),
      ...(JSON.parse(raw) as Partial<SessionMetrics>),
    };
  } catch {
    return emptyMetrics();
  }
}

async function writeMetricsFile(
  repoPath: string,
  metrics: SessionMetrics,
): Promise<void> {
  const filePath = await metricsPathFor(repoPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(metrics, null, 2) + "\n", "utf8");
}

async function mutateMetrics(
  repoPath: string,
  mutation: MetricsMutation,
): Promise<void> {
  const key = path.resolve(repoPath);
  const previous = writeLocks.get(key) ?? Promise.resolve();
  const next = previous.then(async () => {
    const metrics = await readMetricsFile(repoPath);
    mutation(metrics);
    metrics.updated_at = new Date().toISOString();
    await writeMetricsFile(repoPath, metrics);
  });

  writeLocks.set(
    key,
    next.catch(() => {
      // Preserve queue progression after failures.
    }),
  );

  await next;
}

export async function readSessionMetrics(repoPath: string): Promise<SessionMetrics> {
  return readMetricsFile(repoPath);
}

export async function recordToolCall(
  repoPath: string,
  toolName: string,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    metrics.tool_calls += 1;
    metrics.tool_calls_by_name[toolName] =
      (metrics.tool_calls_by_name[toolName] ?? 0) + 1;
  });
}

export async function recordResponseOutput(
  repoPath: string,
  surface: string,
  outputBytes: number,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    const estimatedTokens = estimateLocalTokens(outputBytes);
    metrics.response_output_bytes += outputBytes;
    metrics.response_output_tokens += estimatedTokens;
    metrics.response_output_bytes_by_surface[surface] =
      (metrics.response_output_bytes_by_surface[surface] ?? 0) + outputBytes;
    metrics.response_output_tokens_by_surface[surface] =
      (metrics.response_output_tokens_by_surface[surface] ?? 0) + estimatedTokens;
    metrics.estimated_local_tokens += estimatedTokens;
  });
}

export async function recordRepoRead(
  repoPath: string,
  bytes: number,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    metrics.repo_reads += 1;
    metrics.repo_read_bytes += bytes;
    metrics.estimated_local_tokens += estimateLocalTokens(bytes);
  });
}

export async function recordRepoWrite(
  repoPath: string,
  bytes: number,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    metrics.repo_writes += 1;
    metrics.repo_write_bytes += bytes;
  });
}

export async function recordMemoryRead(
  repoPath: string,
  bytes: number,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    metrics.memory_reads += 1;
    metrics.memory_read_bytes += bytes;
    metrics.estimated_local_tokens += estimateLocalTokens(bytes);
  });
}

export async function recordMemoryWrite(
  repoPath: string,
  bytes: number,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    metrics.memory_writes += 1;
    metrics.memory_write_bytes += bytes;
  });
}

export async function recordCommandCall(
  repoPath: string,
  outputBytes: number,
): Promise<void> {
  await mutateMetrics(repoPath, (metrics) => {
    metrics.command_calls += 1;
    metrics.command_output_bytes += outputBytes;
    metrics.estimated_local_tokens += estimateLocalTokens(outputBytes);
  });
}
