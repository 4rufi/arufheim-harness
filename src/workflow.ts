import { readFile } from "node:fs/promises";
import path from "node:path";

export interface WorkflowPaths {
  layout: "hidden";
  featureListPath: string;
  featureHistoryPath: string;
  currentPath: string;
  historyPath: string;
  inboxDir: string;
  inboxProcessedDir: string;
  memoryPath: string;
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
  shape: "object";
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

export async function resolveWorkflowPaths(
  _repoPath: string,
): Promise<WorkflowPaths> {
  return {
    layout: "hidden",
    featureListPath: ".harness/feature_list.json",
    featureHistoryPath: ".harness/feature_history.json",
    currentPath: ".harness/progress/current.md",
    historyPath: ".harness/progress/history.md",
    inboxDir: ".harness/inbox",
    inboxProcessedDir: ".harness/inbox/processed",
    memoryPath: ".harness/memory.jsonl",
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

  throw new Error(".harness/feature_list.json must be an object with a features array.");
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

  throw new Error(
    "feature_history.json must be an object with archived_features.",
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
