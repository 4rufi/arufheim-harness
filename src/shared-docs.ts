import registry from "./generated/shared-docs-registry.json" with { type: "json" };

export interface SharedDocSummary {
  topic: string;
  title: string;
  relative_path: string;
}

export interface SharedDocContent extends SharedDocSummary {
  text: string;
}

interface SharedDocRegistryEntry extends SharedDocContent {}

interface SharedDocRegistry {
  docs: SharedDocRegistryEntry[];
}

const sharedDocsRegistry = registry as SharedDocRegistry;
const DOCS_BY_TOPIC = new Map(
  sharedDocsRegistry.docs.map((doc) => [doc.topic, doc] as const),
);

export async function listSharedDocs(): Promise<SharedDocSummary[]> {
  return sharedDocsRegistry.docs.map(({ topic, title, relative_path }) => ({
    topic,
    title,
    relative_path,
  }));
}

export async function readSharedDoc(topic: string): Promise<SharedDocContent> {
  const doc = DOCS_BY_TOPIC.get(topic);
  if (!doc) {
    throw new Error(`Unknown shared doc topic '${topic}'.`);
  }

  return doc;
}
