#!/usr/bin/env node
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const packageJson = JSON.parse(
  await readFile(path.join(repoRoot, "package.json"), "utf8"),
);

await build({
  entryPoints: [path.join(repoRoot, "dist", "index.js")],
  outfile: path.join(repoRoot, "dist", "runtime-bundle.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: ["node24"],
  sourcemap: false,
  external: ["esbuild"],
  define: {
    __HARNESS_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0"),
  },
  logLevel: "info",
});

process.stdout.write("runtime bundle built: dist/runtime-bundle.cjs\n");
