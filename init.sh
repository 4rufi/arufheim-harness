#!/usr/bin/env bash
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok() { printf "${GREEN}[OK]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
fail() { printf "${RED}[FAIL]${NC} %s\n" "$1"; }

EXIT_CODE=0
PNPM_RUNNER="./scripts/pnpmw.sh"

echo "── 1. Verificando entorno ─────────────────────────────"
if ! command -v node >/dev/null 2>&1; then
  fail "node no está instalado"
  exit 1
fi
ok "node -> $(node --version)"

if [ ! -x "$PNPM_RUNNER" ]; then
  fail "Falta runner ejecutable: $PNPM_RUNNER"
  exit 1
fi

if ! PNPM_VERSION="$("$PNPM_RUNNER" --version 2>/tmp/harness_pnpm_error.log)"; then
  fail "$(cat /tmp/harness_pnpm_error.log)"
  exit 1
fi
ok "pnpm -> ${PNPM_VERSION}"

echo ""
echo "── 2. Verificando archivos base del arnés ─────────────"
for f in AGENTS.md CLAUDE.md CHECKPOINTS.md feature_list.json harness.config.json docs/architecture.md docs/conventions.md docs/specs.md docs/verification.md progress/README.md progress/current.md progress/history.md; do
  if [ ! -f "$f" ]; then
    fail "Falta archivo base: $f"
    EXIT_CODE=1
  else
    ok "Existe $f"
  fi
done

echo ""
echo "── 3. Validando feature_list.json y specs ─────────────"
node --input-type=commonjs - <<'JS'
const fs = require("node:fs");
const path = require("node:path");

try {
  const data = JSON.parse(fs.readFileSync("feature_list.json", "utf8"));
  const valid = new Set(["pending", "spec_ready", "in_progress", "done", "blocked"]);
  const inProgress = data.features.filter((feature) => feature.status === "in_progress");

  if (inProgress.length > 1) {
    console.log(`[FAIL] Hay ${inProgress.length} features en in_progress (máximo 1)`);
    process.exit(1);
  }

  const requiresSpec = new Set(["spec_ready", "in_progress", "done"]);
  for (const feature of data.features) {
    if (!valid.has(feature.status)) {
      console.log(`[FAIL] Estado inválido en feature ${feature.id}: ${feature.status}`);
      process.exit(1);
    }

    if (feature.sdd && requiresSpec.has(feature.status)) {
      const specDir = path.join("specs", feature.name);
      for (const fileName of ["requirements.md", "design.md", "tasks.md"]) {
        if (!fs.existsSync(path.join(specDir, fileName))) {
          console.log(`[FAIL] Feature ${feature.id} (${feature.name}) en ${feature.status} sin ${specDir}/${fileName}`);
          process.exit(1);
        }
      }
    }
  }

  console.log(`[OK] feature_list.json válido (${data.features.length} features)`);
  console.log("[OK] Specs presentes para features SDD activas");

  const closedSddFeatures = data.features.filter(
    (feature) => feature.sdd && feature.status === "done"
  );

  for (const feature of closedSddFeatures) {
    const implPath = path.join("progress", `impl_${feature.name}.md`);
    const reviewPath = path.join("progress", `review_${feature.name}.md`);

    if (!fs.existsSync(implPath)) {
      console.log(`[FAIL] Feature ${feature.id} (${feature.name}) cerrada sin ${implPath}`);
      process.exit(1);
    }

    if (!fs.existsSync(reviewPath)) {
      console.log(`[FAIL] Feature ${feature.id} (${feature.name}) cerrada sin ${reviewPath}`);
      process.exit(1);
    }

    const implText = fs.readFileSync(implPath, "utf8");
    if (!/R\d+\s*(->|→)/.test(implText)) {
      console.log(`[FAIL] ${implPath} no incluye trazabilidad R<n> -> verificación`);
      process.exit(1);
    }

    const reviewText = fs.readFileSync(reviewPath, "utf8");
    if (!/^- \[[xX]\]/m.test(reviewText)) {
      console.log(`[FAIL] ${reviewPath} no incluye checklist marcada`);
      process.exit(1);
    }

    if (!/\bAPROBADO\b/i.test(reviewText)) {
      console.log(`[FAIL] ${reviewPath} no contiene veredicto APROBADO`);
      process.exit(1);
    }
  }

  const progressEntries = fs.readdirSync("progress");
  const allowedProgressEntries = [
    /^README\.md$/,
    /^current\.md$/,
    /^history\.md$/,
    /^explore_[a-z0-9_]+\.md$/,
    /^impl_[a-z0-9_]+\.md$/,
    /^review_[a-z0-9_]+\.md$/,
    /^spec_[a-z0-9_]+\.md$/
  ];

  for (const entry of progressEntries) {
    if (!allowedProgressEntries.some((pattern) => pattern.test(entry))) {
      console.log(`[FAIL] progress/${entry} no sigue una convención soportada`);
      process.exit(1);
    }
  }

  const currentText = fs.readFileSync(path.join("progress", "current.md"), "utf8");
  const requiredCurrentSnippets = [
    "# Sesión actual",
    "- **Feature en curso:**",
    "- **Inicio:**",
    "- **Agente:**",
    "## Plan",
    "## Bitácora",
    "## Próximo paso"
  ];

  for (const snippet of requiredCurrentSnippets) {
    if (!currentText.includes(snippet)) {
      console.log(`[FAIL] progress/current.md no contiene: ${snippet}`);
      process.exit(1);
    }
  }

  const currentHeadings = [...currentText.matchAll(/^##\s+(.+)$/gm)].map((match) =>
    match[1].trim()
  );
  const expectedCurrentHeadings = ["Plan", "Bitácora", "Próximo paso"];

  if (
    currentHeadings.length !== expectedCurrentHeadings.length ||
    currentHeadings.some((heading, index) => heading !== expectedCurrentHeadings[index])
  ) {
    console.log("[FAIL] progress/current.md debe usar solo las secciones canónicas: Plan, Bitácora y Próximo paso");
    process.exit(1);
  }

  const historyText = fs.readFileSync(path.join("progress", "history.md"), "utf8");
  const requiredHistorySnippets = [
    "# Bitácora histórica (append-only)",
    "No edites entradas anteriores. Solo añades al final.",
    "---"
  ];

  for (const snippet of requiredHistorySnippets) {
    if (!historyText.includes(snippet)) {
      console.log(`[FAIL] progress/history.md no contiene: ${snippet}`);
      process.exit(1);
    }
  }

  console.log(`[OK] Evidencia SDD presente para ${closedSddFeatures.length} features cerradas`);
  console.log("[OK] Formato base de progress/ válido");
} catch (error) {
  console.log(`[FAIL] feature_list.json inválido: ${error.message}`);
  process.exit(1);
}
JS
if [ $? -ne 0 ]; then
  EXIT_CODE=1
fi

echo ""
echo "── 4. Verificación ejecutable ─────────────────────────"
if "$PNPM_RUNNER" typecheck; then
  ok "Typecheck verde"
else
  fail "Typecheck falló"
  EXIT_CODE=1
fi

if "$PNPM_RUNNER" build; then
  ok "Build verde"
else
  fail "Build falló"
  EXIT_CODE=1
fi

if "$PNPM_RUNNER" smoke; then
  ok "Smoke verde"
else
  fail "Smoke falló"
  EXIT_CODE=1
fi

echo ""
echo "── 5. Resumen ─────────────────────────────────────────"
if [ $EXIT_CODE -eq 0 ]; then
  ok "Entorno listo. Puedes trabajar."
else
  fail "Entorno NO está listo. Resuelve los errores antes de avanzar."
fi

exit $EXIT_CODE
