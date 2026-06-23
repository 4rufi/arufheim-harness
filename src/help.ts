import process from "node:process";

// ── Catppuccin Mocha (subset) ────────────────────────────────────────────────
const P = {
  surface2: "#585b70",
  subtext0: "#bac2de",
  subtext1: "#a6adc8",
  text: "#cdd6f4",
  green: "#a6e3a1",
  blue: "#89b4fa",
  yellow: "#f9e2af",
  teal: "#94e2d5",
  mauve: "#cba6f7",
} as const;

const RST = "\x1b[0m";
const BOLD = "\x1b[1m";

function ansi(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(v >> 16) & 0xff};${(v >> 8) & 0xff};${v & 0xff}m`;
}

function c(hex: string, text: string): string {
  return `${ansi(hex)}${text}${RST}`;
}

function b(text: string): string {
  return `${BOLD}${text}${RST}`;
}

function dim(text: string): string {
  return c(P.subtext0, text);
}

// ── Layout ───────────────────────────────────────────────────────────────────
function heading(text: string): string {
  return `\n${c(P.mauve, b(text))}`;
}

function cmd(name: string, args: string, desc: string): string {
  const left = `  ${c(P.blue, b(name))} ${c(P.subtext1, args)}`;
  const llen = `  ${name} ${args}`.length;
  const gap = " ".repeat(Math.max(2, 44 - llen));
  return `${left}${gap}${dim(desc)}`;
}

function tool(name: string, params: string, desc: string): string {
  const left = `  ${c(P.green, name)} ${c(P.subtext1, params)}`;
  const llen = `  ${name} ${params}`.length;
  const gap = " ".repeat(Math.max(2, 44 - llen));
  return `${left}${gap}${dim(desc)}`;
}

function resource(uri: string, desc: string): string {
  const left = `  ${c(P.teal, uri)}`;
  const llen = `  ${uri}`.length;
  const gap = " ".repeat(Math.max(2, 44 - llen));
  return `${left}${gap}${dim(desc)}`;
}

function note(text: string): string {
  return `  ${c(P.yellow, "·")} ${dim(text)}`;
}

// ── Help output ──────────────────────────────────────────────────────────────
export function runHelp(): void {
  const lines: string[] = [];

  lines.push(
    `\n${c(P.mauve, b("arufheim-harness"))} ${dim("— MCP server + workflow tracking")}`,
  );

  // ── Happy path ────────────────────────────────────────────────────────────
  lines.push(heading("Ruta recomendada"));
  lines.push(cmd("npm install -g", "arufheim-harness@latest", "instala o actualiza el CLI global"));
  lines.push(cmd("setup", "--global-runtime", "siembra o repara el runtime global gestionado"));
  lines.push(cmd("cd", "/ruta/al/repo", "entra al proyecto que quieres preparar"));
  lines.push(cmd("setup", "--repo-path .", "configura el repo en layout thin por defecto"));
  lines.push(cmd("verify", "--repo-path .", "confirma que el repo quedó listo"));
  lines.push(note("abre o recarga Codex/VS Code/Claude Code/OpenCode y llama `harness_status(mode: \"brief_minimal\")`"));
  lines.push(note("si `repo_path` coincide, puedes trabajar; clientes `missing` no bloquean si no los usas"));
  lines.push("");
  lines.push(note("Actualizar repo viejo: `setup --repo-path . --update` -> `migrate --repo-path . --to thin` -> `repair --repo-path .` -> `verify --repo-path .`"));
  lines.push(note("Global clients son opcionales; el camino preferido es repo-scoped con `setup --repo-path .`"));

  // ── CLI commands ───────────────────────────────────────────────────────────
  lines.push(heading("CLI"));
  lines.push(
    cmd(
      "setup",
      "[--repo-path <ruta>] [--global] [--global-runtime] [--layout thin|full] [--update] [--clients <lista>] [--force-managed-global]",
      "camino recomendado: thin por defecto en repos consumidores; reconcilia scaffold, bindings y valida health",
    ),
  );
  lines.push(
    cmd(
      "migrate",
      "--to thin [--repo-path <ruta>] [--dry-run] [--json]",
      "migra un repo existente al layout thin de forma explícita y segura",
    ),
  );
  lines.push(
    cmd(
      "repair",
      "[--repo-path <ruta>] [--global] [--global-runtime] [--clients <lista>] [--force-managed-global]",
      "autorepara assets/config gestionados por el arnés",
    ),
  );
  lines.push(cmd("doctor", "[--repo-path <ruta>] [--json]", "inspecciona health y propone fixes"));
  lines.push(cmd("verify", "[--repo-path <ruta>] [--json]", "gate recomendado para repos consumidores"));
  lines.push(
    cmd(
      "status",
      "[--repo-path <ruta>] [--brief | --brief-minimal] [--json]",
      "snapshot CLI; fallback cuando el frontend no cargó tools MCP",
    ),
  );
  lines.push(
    cmd(
      "simulate",
      "[--repo-path <ruta>] [--flow <startup|activation|loop|triage|all>] [--json]",
      "estima bytes/tokens locales por flujo sin tocar session.json",
    ),
  );
  lines.push(
    cmd("init", "", "primitive compatible: inicializa workflow base + clientes"),
  );
  lines.push(cmd("docs", "<list|show <topic>>", "muestra docs compartidas desde el runtime del harness"));
  lines.push(note("thin es el default recomendado; usa `setup --layout full` solo si quieres materializar docs/prompts largos"));
  lines.push(note("si el frontend no expuso `harness_status`, usa `status --brief-minimal --json`"));
  lines.push(note("setup/repair --global fallan cerrado ante configs inválidas; `--force-managed-global` crea backup y regenera la entrada gestionada"));
  lines.push(note("release: `npm run release:check` -> actualiza release-readiness.json -> `npm run release:publish-check`"));
  lines.push(note("más detalle: README.md, `docs list`, `docs show <topic>` y manual-release-checklist.md"));
  lines.push(cmd("init", "--claude", "workflow base + archivos Claude"));
  lines.push(cmd("init", "--codex", "workflow base + binding repo-scoped de Codex"));
  lines.push(cmd("init", "--copilot", "workflow base + archivos Copilot"));
  lines.push(cmd("init", "--opencode", "workflow base + archivos OpenCode"));
  lines.push(
    cmd("init", "--global", "configura VS Code / Claude Desktop / Claude Code / Codex"),
  );
  lines.push(
    cmd("init", "--update", "aplica secciones faltantes sin sobreescribir"),
  );
  lines.push(cmd("init", "--layout thin|full", "elige el scaffold local al usar el primitive"));
  lines.push(
    cmd(
      "agent",
      '--provider <...> --prompt "..." [--effort auto|low|high]',
      "modo agente con routing fast/deep por complejidad",
    ),
  );
  lines.push(
    cmd(
      "config",
      "<path|init|show|set>",
      "gestiona configuración global o por repo",
    ),
  );
  lines.push(cmd("tui", "", "dashboard visual con estado, policy y métricas"));
  lines.push(cmd("version", "| --version | -v", "muestra la versión del CLI"));
  lines.push(cmd("help", "", "muestra esta ayuda"));
  lines.push("");
  lines.push(
    note("--repo-path <ruta>   raíz del repo; obligatorio si no hay harness.config.json local"),
  );
  lines.push(note("--config <ruta>      ruta al harness.config.json"));
  lines.push(
    note(
      "config set arrays    usa JSON: [\"pnpm test\",\"npm test\"] · [\"R1\",\"R2\"]",
    ),
  );
  lines.push(note("testing.fastCommand/testing.integrationCommand fijan la capa rápida e integración por repo"));

  // ── MCP tools: repo ────────────────────────────────────────────────────────
  lines.push(heading("Herramientas MCP — Exploración"));
  lines.push(tool("list_files", "[include]", "lista archivos del repo"));
  lines.push(tool("read_file", "<path>", "lee un archivo"));
  lines.push(
    tool(
      "write_file",
      "<path> <content> [append]",
      "escribe o crea un archivo",
    ),
  );
  lines.push(
    tool(
      "search_repo",
      "<query> [regex] [context] [include]",
      "busca texto o regex con contexto",
    ),
  );
  lines.push(
    tool("run_command", "<command>", "ejecuta un comando de la allowlist"),
  );

  // ── MCP tools: workflow ────────────────────────────────────────────────────
  lines.push(heading("Herramientas MCP — Workflow"));
  lines.push(
    tool(
      "harness_status",
      "[mode]",
      "snapshot de sesión; usa brief_minimal para el arranque más barato o brief_only para un snapshot más rico",
    ),
  );
  lines.push(
    tool(
      "harness_loop_status",
      "[feature_id]",
      "estado del loop plan-execute-verify de la feature activa o indicada",
    ),
  );
  lines.push(
    tool(
      "harness_loop_event",
      "<feature_id> <phase> <actor> <outcome> <summary>",
      "append estructurado del loop y recomputación del estado derivado",
    ),
  );
  lines.push(
    tool("harness_update", "<id> <status>", "muta el estado de una feature"),
  );
  lines.push(
    tool(
      "harness_add",
      "<name> [description] [sdd]",
      "agrega una nueva feature",
    ),
  );
  lines.push(
    tool("harness_log", "<entry>", "append a la bitácora de current.md"),
  );
  lines.push(
    tool(
      "harness_metrics",
      "",
      "métricas de sesión + tokens locales estimados",
    ),
  );

  // ── MCP tools: inbox ──────────────────────────────────────────────────────
  lines.push(heading("Herramientas MCP — Inbox"));
  lines.push(tool("inbox_list", "", "lista archivos pendientes con metadata"));
  lines.push(tool("inbox_consume", "<filename>", "lee y mueve a processed/"));

  // ── MCP tools: memory ─────────────────────────────────────────────────────
  lines.push(heading("Herramientas MCP — Memoria"));
  lines.push(
    tool(
      "mem_save",
      "<title> <content> <type> [feature]",
      "guarda entrada estructurada en memoria",
    ),
  );
  lines.push(
    tool(
      "mem_search",
      "<query> [type] [feature] [limit]",
      "busca con FTS5 en la memoria persistente",
    ),
  );
  lines.push(
    tool(
      "mem_context",
      "[feature] [query] [limit]",
      "trae contexto compacto para arranque o compaction",
    ),
  );
  lines.push(tool("mem_get", "<id>", "recupera entrada completa por id"));
  lines.push(
    tool(
      "mem_session_summary",
      "<title> <what> [why] [where] [learned]",
      "guarda un resumen compacto de sesión",
    ),
  );
  lines.push("");
  lines.push(note("tipos: decision · learning · note · blocker · session"));
  lines.push(
    note("estados: pending · spec_ready · in_progress · done · blocked"),
  );
  lines.push(
    note(
      "permissionPolicy: always_allow · always_ask · allow_list (harness.config.json)",
    ),
  );

  // ── Resources ─────────────────────────────────────────────────────────────
  lines.push(heading("MCP Resources"));
  lines.push(
    resource("harness://config/raw", "contenido del harness.config.json"),
  );
  lines.push(
    resource(
      "harness://config/resolved",
      "config efectivo tras resolución de paths",
    ),
  );
  lines.push(resource("harness://health", "snapshot de health compartido por doctor/status/tui"));
  lines.push(resource("harness://loop/active", "loop activo de la feature viva"));
  lines.push(resource("harness://docs/index", "índice de docs compartidas del runtime"));
  lines.push(resource("harness://docs/<topic>", "doc compartida individual por tópico"));
  lines.push(resource("harness://logs/main", "últimas líneas del log JSONL"));

  lines.push("");

  process.stdout.write(lines.join("\n") + "\n");
}
