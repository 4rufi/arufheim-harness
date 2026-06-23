import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  inferScaffoldLayout,
  isDetectableHarnessRepo,
} from "../src/scaffold-layout.js";
import { listSharedDocs, readSharedDoc } from "../src/shared-docs.js";

describe("scaffold layout", () => {
  it("defaults new repos to thin and detects full-only assets", async () => {
    const repoPath = await mkdtemp(path.join(os.tmpdir(), "harness-layout-"));
    try {
      expect(await inferScaffoldLayout(repoPath)).toBe("thin");

      await mkdir(path.join(repoPath, ".harness-docs"), { recursive: true });
      await writeFile(
        path.join(repoPath, ".harness-docs", "verification.md"),
        "# Verificación\n",
        "utf8",
      );

      expect(await inferScaffoldLayout(repoPath)).toBe("full");
      expect(
        await inferScaffoldLayout(repoPath, {
          scaffold: {
            layout: "thin",
          },
        }),
      ).toBe("thin");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("does not treat a weak legacy marker as a valid harness repo", async () => {
    const repoPath = await mkdtemp(path.join(os.tmpdir(), "harness-detect-"));
    try {
      await writeFile(
        path.join(repoPath, "feature_list.json"),
        "[]\n",
        "utf8",
      );
      expect(await isDetectableHarnessRepo(repoPath)).toBe(false);

      await writeFile(
        path.join(repoPath, "harness.config.json"),
        "{\n  \"version\": 1\n}\n",
        "utf8",
      );
      expect(await isDetectableHarnessRepo(repoPath)).toBe(true);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });
});

describe("shared docs", () => {
  it("lists topics and reads shared markdown from the harness runtime", async () => {
    const docs = await listSharedDocs();
    expect(docs.some((doc) => doc.topic === "verification")).toBe(true);

    const verification = await readSharedDoc("verification");
    expect(verification.title).toContain("Verificación");
    expect(verification.text).toContain("En harness no basta");
  });
});
