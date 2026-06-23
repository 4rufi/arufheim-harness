import process from "node:process";

import { listSharedDocs, readSharedDoc } from "./shared-docs.js";

export async function runDocs(argv: string[] = []): Promise<void> {
  const command = argv[0];

  if (command === "list" || !command) {
    const docs = await listSharedDocs();
    process.stdout.write(
      docs.map((doc) => `${doc.topic}\t${doc.title}`).join("\n") + "\n",
    );
    return;
  }

  if (command === "show") {
    const topic = argv[1];
    if (!topic) {
      throw new Error("Usage: arufheim-harness docs show <topic>");
    }
    const doc = await readSharedDoc(topic);
    process.stdout.write(doc.text);
    if (!doc.text.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return;
  }

  throw new Error(
    "Usage: arufheim-harness docs <list|show <topic>>",
  );
}
