import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

declare const __HARNESS_VERSION__: string | undefined;

function readHarnessVersion(): string {
  if (typeof __HARNESS_VERSION__ === "string" && __HARNESS_VERSION__.trim() !== "") {
    return __HARNESS_VERSION__.trim();
  }

  try {
    const filePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "package.json",
    );
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      version?: unknown;
    };
    return typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const HARNESS_VERSION = readHarnessVersion();
