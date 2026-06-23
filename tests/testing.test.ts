import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTestingTemplateContext,
  mergeAllowedCommands,
  recommendTestLayer,
  resolveRepoTestingGuidance,
} from "../src/testing.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "harness-testing-"));
}

describe("testing guidance", () => {
  it("prefers explicit testing config over autodetection", async () => {
    const repoPath = await createTempDir();
    try {
      await writeFile(
        path.join(repoPath, "package.json"),
        JSON.stringify(
          {
            packageManager: "pnpm@10.33.4",
            scripts: {
              "test:unit": "vitest run",
              smoke: "node smoke.mjs",
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const guidance = await resolveRepoTestingGuidance(repoPath, {
        fastCommand: "pnpm custom:test",
        integrationCommand: "pnpm custom:smoke",
      });

      expect(guidance.fastCommand).toBe("pnpm custom:test");
      expect(guidance.integrationCommand).toBe("pnpm custom:smoke");
      expect(guidance.fastSource).toBe("config");
      expect(guidance.integrationSource).toBe("config");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("detects fast and integration scripts from package.json", async () => {
    const repoPath = await createTempDir();
    try {
      await writeFile(
        path.join(repoPath, "package.json"),
        JSON.stringify(
          {
            packageManager: "pnpm@10.33.4",
            scripts: {
              "test:unit": "vitest run",
              verify: "pnpm test:unit && pnpm smoke",
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const guidance = await resolveRepoTestingGuidance(repoPath, undefined);
      expect(guidance.fastCommand).toBe("pnpm test:unit");
      expect(guidance.integrationCommand).toBe("pnpm verify");
      expect(guidance.fastSource).toBe("script");
      expect(guidance.integrationSource).toBe("script");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("recommends Vitest only for JS/TS repos without fast suite", async () => {
    const jsRepoPath = await createTempDir();
    const genericRepoPath = await createTempDir();
    try {
      await writeFile(
        path.join(jsRepoPath, "package.json"),
        JSON.stringify(
          {
            packageManager: "npm@10.0.0",
            devDependencies: {
              typescript: "^5.0.0",
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      await writeFile(path.join(jsRepoPath, "tsconfig.json"), "{}\n", "utf8");
      await writeFile(path.join(genericRepoPath, "README.md"), "# generic\n", "utf8");

      const jsGuidance = await resolveRepoTestingGuidance(jsRepoPath, undefined);
      const genericGuidance = await resolveRepoTestingGuidance(
        genericRepoPath,
        undefined,
      );

      expect(jsGuidance.fastCommand).toBeNull();
      expect(jsGuidance.fastSource).toBe("fallback");
      expect(jsGuidance.fastRecommendation).toContain("Vitest");

      expect(genericGuidance.fastCommand).toBeNull();
      expect(genericGuidance.fastSource).toBe("none");
      expect(genericGuidance.fastRecommendation).toContain("suite rápida nativa");
    } finally {
      await rm(jsRepoPath, { recursive: true, force: true });
      await rm(genericRepoPath, { recursive: true, force: true });
    }
  });

  it("uses yarn when the repo declares yarn instead of pushing pnpm", async () => {
    const repoPath = await createTempDir();
    try {
      await writeFile(
        path.join(repoPath, "package.json"),
        JSON.stringify(
          {
            packageManager: "yarn@4.0.0",
            scripts: {
              "test:unit": "vitest run",
              smoke: "node smoke.mjs",
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );

      const guidance = await resolveRepoTestingGuidance(repoPath, undefined);
      expect(guidance.packageManager).toBe("yarn");
      expect(guidance.fastCommand).toBe("yarn test:unit");
      expect(guidance.integrationCommand).toBe("yarn smoke");
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  });

  it("merges allowed commands without duplicates and classifies layers", () => {
    const merged = mergeAllowedCommands(
      ["pnpm test:unit", "pnpm smoke"],
      {
        fastCommand: "pnpm test:unit",
        integrationCommand: "pnpm smoke",
        fastSource: "script",
        integrationSource: "script",
        jsTsProject: true,
        packageManager: "pnpm",
        fastRecommendation: null,
      },
    );

    expect(merged).toEqual(["pnpm test:unit", "pnpm smoke"]);
    expect(recommendTestLayer("doctor status json shape")).toBe("contract");
    expect(recommendTestLayer("setup binding release hardening")).toBe("smoke");
    expect(recommendTestLayer("loop reducer and parser")).toBe("unit");
  });

  it("renders contextual testing guidance instead of universal preflight", () => {
    const context = buildTestingTemplateContext({
      fastCommand: "pnpm test:unit",
      integrationCommand: "pnpm verify",
      fastSource: "script",
      integrationSource: "script",
      jsTsProject: true,
      packageManager: "pnpm",
      fastRecommendation: null,
    });

    expect(context.fastLine).toContain("No hace falta validar binarios o versiones antes");
    expect(context.integrationLine).toContain("no como chequeo previo universal");
    expect(context.fallbackLine).toContain("cuando el cambio lo amerite");
  });
});
