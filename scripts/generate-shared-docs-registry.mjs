#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const scaffoldLayoutPath = path.join(repoRoot, "src", "scaffold-layout.ts");
const sourceOutputPath = path.join(
  repoRoot,
  "src",
  "generated",
  "shared-docs-registry.json",
);
const distOutputPath = path.join(
  repoRoot,
  "dist",
  "generated",
  "shared-docs-registry.json",
);

function extractTitle(text, fallbackTopic) {
  const match = text.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim();
  }
  return fallbackTopic.replace(/_/g, " ");
}

async function parseTopics() {
  const text = await readFile(scaffoldLayoutPath, "utf8");
  const startMarker = "export const SHARED_DOC_TOPICS = [";
  const endMarker = "] as const";
  const startIndex = text.indexOf(startMarker);
  const endIndex = text.indexOf(endMarker, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("No se pudo localizar SHARED_DOC_TOPICS en src/scaffold-layout.ts.");
  }

  const section = text.slice(startIndex, endIndex);
  const topics = [];
  const pattern = /\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g;
  let match;
  while ((match = pattern.exec(section)) !== null) {
    topics.push({
      topic: match[1],
      relative_path: match[2],
    });
  }

  if (topics.length === 0) {
    throw new Error("No se pudieron extraer tópicos de docs compartidas.");
  }

  return topics;
}

async function buildRegistry() {
  const topics = await parseTopics();
  const docs = await Promise.all(
    topics.map(async ({ topic, relative_path }) => {
      const absolutePath = path.join(repoRoot, relative_path);
      const text = await readFile(absolutePath, "utf8");
      return {
        topic,
        title: extractTitle(text, topic),
        relative_path,
        text,
      };
    }),
  );

  return { docs };
}

async function writeJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function main() {
  const registry = await buildRegistry();
  await writeJson(sourceOutputPath, registry);
  await writeJson(distOutputPath, registry);
  process.stdout.write(
    `shared docs registry updated: ${path.relative(repoRoot, sourceOutputPath)}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
