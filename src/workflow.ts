import fg from "fast-glob";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface WorkflowPaths {
  layout: "hidden" | "root-legacy";
  featureListPath: string;
  featureHistoryPath: string;
  currentPath: string;
  historyPath: string;
  inboxDir: string;
  inboxProcessedDir: string;
  memoryPath: string;
  metricsPath: string;
  loopMetricsDir: string;
}

export interface WorkflowFeature {
  id: number;
  name: string;
  description?: string;
  status: string;
  sdd?: boolean;
  [key: string]: unknown;
}

type FeatureListRootDocument = {
  features: WorkflowFeature[];
  [key: string]: unknown;
};

type FeatureHistoryRootDocument = {
  archived_features: WorkflowFeature[];
  [key: string]: unknown;
};

export interface ParsedFeatureList {
  shape: "object" | "array";
  features: WorkflowFeature[];
  root: FeatureListRootDocument;
}

export const DEFAULT_CURRENT_MD = `# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a \`history.md\`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** _ninguna_
- **Inicio:** _—_
- **Agente:** _—_

## Plan

_—_

## Bitácora

_—_

## Próximo paso

_—_
`;

export const DEFAULT_HISTORY_MD = `# Bitácora histórica (append-only)

> Cada vez que se cierra una sesión, su resumen se añade aquí.
> No edites entradas anteriores. Solo añades al final.

---
`;

export const INBOX_RESERVED_BASENAMES = new Set(["README.md"]);

const workflowWriteLocks = new Map<string, Promise<void>>();

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveWorkflowPaths(
  repoPath: string,
): Promise<WorkflowPaths> {
  const hiddenFeatureList = path.join(repoPath, ".harness/feature_list.json");
  if (await pathExists(hiddenFeatureList)) {
    return {
      layout: "hidden",
      featureListPath: ".harness/feature_list.json",
      featureHistoryPath: ".harness/feature_history.json",
      currentPath: ".harness/progress/current.md",
      historyPath: ".harness/progress/history.md",
      inboxDir: ".harness/inbox",
      inboxProcessedDir: ".harness/inbox/processed",
      memoryPath: ".harness/memory.sqlite",
      metricsPath: ".harness/metrics/session.json",
      loopMetricsDir: ".harness/metrics/loops",
    };
  }

  const legacyFeatureList = path.join(repoPath, "feature_list.json");
  if (!(await pathExists(legacyFeatureList))) {
    return {
      layout: "hidden",
      featureListPath: ".harness/feature_list.json",
      featureHistoryPath: ".harness/feature_history.json",
      currentPath: ".harness/progress/current.md",
      historyPath: ".harness/progress/history.md",
      inboxDir: ".harness/inbox",
      inboxProcessedDir: ".harness/inbox/processed",
      memoryPath: ".harness/memory.sqlite",
      metricsPath: ".harness/metrics/session.json",
      loopMetricsDir: ".harness/metrics/loops",
    };
  }

  return {
    layout: "root-legacy",
    featureListPath: "feature_list.json",
    featureHistoryPath: "feature_history.json",
    currentPath: "progress/current.md",
    historyPath: "progress/history.md",
    inboxDir: "inbox",
    inboxProcessedDir: "inbox/processed",
    memoryPath: ".harness/memory.sqlite",
    metricsPath: ".harness/metrics/session.json",
    loopMetricsDir: ".harness/metrics/loops",
  };
}

export function parseFeatureListText(raw: string): ParsedFeatureList {
  const parsed = JSON.parse(raw) as unknown;

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as FeatureListRootDocument).features)
  ) {
    const root = parsed as FeatureListRootDocument;
    return {
      shape: "object",
      features: root.features,
      root,
    };
  }

  if (Array.isArray(parsed)) {
    const features = parsed as WorkflowFeature[];
    return {
      shape: "array",
      features,
      root: {
        features,
      },
    };
  }

  throw new Error(
    "feature_list.json must be either an object with a features array or a legacy feature array.",
  );
}

export function serializeFeatureList(document: ParsedFeatureList): string {
  return (
    JSON.stringify(
      {
        ...document.root,
        features: document.features,
      },
      null,
      2,
    ) + "\n"
  );
}

export function parseFeatureHistoryText(raw: string): WorkflowFeature[] {
  const parsed = JSON.parse(raw) as unknown;

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as FeatureHistoryRootDocument).archived_features)
  ) {
    return (parsed as FeatureHistoryRootDocument).archived_features;
  }

  if (Array.isArray(parsed)) {
    return parsed as WorkflowFeature[];
  }

  throw new Error(
    "feature_history.json must be either an object with archived_features or a legacy feature array.",
  );
}

export function serializeFeatureHistory(features: WorkflowFeature[]): string {
  return (
    JSON.stringify(
      {
        archived_features: features,
      },
      null,
      2,
    ) + "\n"
  );
}

export async function readFeatureListDocument(
  repoPath: string,
): Promise<{ paths: WorkflowPaths; document: ParsedFeatureList }> {
  const paths = await resolveWorkflowPaths(repoPath);
  const raw = await readFile(path.join(repoPath, paths.featureListPath), "utf8");
  return {
    paths,
    document: parseFeatureListText(raw),
  };
}

export function isPendingInboxEntryName(name: string): boolean {
  return !name.startsWith(".") && !INBOX_RESERVED_BASENAMES.has(name);
}

export async function listPendingInboxEntries(repoPath: string): Promise<string[]> {
  const workflowPaths = await resolveWorkflowPaths(repoPath);
  try {
    const entries = await fg("*", {
      cwd: path.join(repoPath, workflowPaths.inboxDir),
      ignore: ["processed/**"],
      onlyFiles: true,
      dot: false,
    });
    return entries.filter(isPendingInboxEntryName);
  } catch {
    return [];
  }
}

export async function withWorkflowWriteLock<T>(
  repoPath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = path.resolve(repoPath);
  const previous = workflowWriteLocks.get(key) ?? Promise.resolve();

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  workflowWriteLocks.set(
    key,
    previous.then(() => gate).catch(() => gate),
  );

  await previous;

  try {
    return await operation();
  } finally {
    release();
    const current = workflowWriteLocks.get(key);
    if (current === gate || current === previous) {
      workflowWriteLocks.delete(key);
    }
  }
}
