import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const skipAutomated = args.includes("--skip-automated");
const rootIndex = args.indexOf("--root");
const rootDir =
  rootIndex >= 0 && args[rootIndex + 1]
    ? path.resolve(args[rootIndex + 1])
    : defaultRoot;

if (!skipAutomated) {
  execFileSync("npm", ["run", "release:check"], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

const packageJsonPath = path.join(rootDir, "package.json");
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const readinessPath = path.join(rootDir, "release-readiness.json");

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
if (typeof pkg.version !== "string" || pkg.version.trim() === "") {
  fail("package.json no tiene una versión válida.");
}
const version = pkg.version.trim();

const changelog = readFileSync(changelogPath, "utf8");
const unreleasedSection = readChangelogSection(changelog, "Unreleased");
if (unreleasedSection === null) {
  fail("CHANGELOG.md no tiene sección 'Unreleased'.");
}
if (hasChangelogContent(unreleasedSection)) {
  fail(
    "CHANGELOG.md aún tiene cambios en 'Unreleased'. Muévelos a una sección versionada antes de publicar.",
  );
}

const releaseSection = readChangelogSection(changelog, version);
if (releaseSection === null) {
  fail(
    `CHANGELOG.md no tiene una sección '## ${version}' alineada con package.json.`,
  );
}
if (!/^\s*-\s+/m.test(releaseSection)) {
  fail(`La sección ${version} del changelog está vacía o no tiene bullets.`);
}

const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
if (readiness.version !== version) {
  fail(
    `release-readiness.json apunta a '${String(readiness.version)}' pero package.json está en '${version}'.`,
  );
}
if (!Array.isArray(readiness.manual_checks)) {
  fail("release-readiness.json no tiene 'manual_checks' como arreglo.");
}

const seenIds = new Set();
const missing = [];
for (const check of readiness.manual_checks) {
  if (
    !check ||
    typeof check.id !== "string" ||
    typeof check.label !== "string" ||
    typeof check.required !== "boolean" ||
    typeof check.checked !== "boolean"
  ) {
    fail("release-readiness.json tiene checks con shape inválido.");
  }
  if (seenIds.has(check.id)) {
    fail(`release-readiness.json repite el check '${check.id}'.`);
  }
  seenIds.add(check.id);

  if (check.checked && typeof check.verified_at !== "string") {
    fail(
      `El check '${check.id}' está marcado como completado pero no tiene 'verified_at'.`,
    );
  }
  if (check.required && !check.checked) {
    missing.push(`${check.id} (${check.label})`);
  }
}

if (missing.length > 0) {
  fail(
    [
      "Falta cerrar la checklist manual de release en release-readiness.json.",
      ...missing.map((item) => `- ${item}`),
    ].join("\n"),
  );
}

console.log(`[OK] release:publish-check`);
console.log(`version=${version}`);
console.log(`manual_checks=${readiness.manual_checks.length}`);

function readChangelogSection(changelogText, heading) {
  const lines = changelogText.split(/\r?\n/);
  const targetHeading = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line.trim() === targetHeading);
  if (startIndex < 0) {
    return null;
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join("\n");
}

function hasChangelogContent(sectionText) {
  return sectionText
    .split("\n")
    .map((line) => line.trim())
    .some((line) => line.length > 0);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}
