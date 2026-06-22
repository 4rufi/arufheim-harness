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

  // ── CLI commands ───────────────────────────────────────────────────────────
  lines.push(heading("CLI"));
  lines.push(
    cmd(
      "setup",
      "[--repo-path <ruta>] [--global] [--update] [--clients <lista>] [--force-managed-global]",
      "camino recomendado: reconcilia scaffold, bindings y valida health",
    ),
  );
  lines.push(
    cmd(
      "repair",
      "[--repo-path <ruta>] [--global] [--clients <lista>] [--force-managed-global]",
      "autorepara assets/config gestionados por el arnés",
    ),
  );
  lines.push(cmd("doctor", "[--repo-path <ruta>] [--json]", "inspecciona health y propone fixes"));
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
  lines.push(note("Codex usa `CODEX.md` y `.codex/config.toml`; el binding repo-scoped es la ruta preferente"));
  lines.push(note("setup instala el workflow completo actual; --clients filtra integraciones, no el core del arnés"));
  lines.push(note("setup --update fuerza reconciliación de assets/config gestionados; release gate automático: npm run release:check"));
  lines.push(note("si el frontend no expuso `harness_status`, usa `arufheim-harness status --brief-minimal --json` como fallback operativo más barato"));
  lines.push(note("si quieres estimar el costo local del startup o triage, usa `arufheim-harness simulate --flow <flujo> --json`"));
  lines.push(note("si la feature ya está `in_progress`, usa `harness_loop_status` para fase, intento, budget y route-back antes de abrir más contexto"));
  lines.push(note("usa `--brief` si además necesitas activation/client_readiness en el snapshot CLI"));
  lines.push(note("doctor, status full y status --brief exponen `client_readiness`: verified · configured_needs_activation · invalid_manual_fix_required"));
  lines.push(note("setup/repair --global fallan cerrado ante configs globales inválidas por defecto"));
  lines.push(note("si quieres backup + regeneración controlada del archivo gestionado, usa --force-managed-global"));
  lines.push(note("bindings nuevos incluyen `--client`; setup/repair dejan verificados los bindings determinísticos"));
  lines.push(note("setup/repair --global con `--repo-path` o cwd harness detectable dejan también `.mcp.json` / `.codex/config.toml` repo-scoped cuando aplica"));
  lines.push(note("solo los bindings globales `assumed` con `--repo-path .` o similares esperan el primer arranque real del frontend"));
  lines.push(note("publish gate manual: completa `release-readiness.json` y corre `npm run release:publish-check`"));
  lines.push(note("checklist manual de release: `manual-release-checklist.md`"));
  lines.push(note("CI recomendada: typecheck + build + smoke + release:check con HARNESS_RELEASE_ALLOW_DIRTY=1"));
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
  lines.push(resource("harness://logs/main", "últimas líneas del log JSONL"));

  lines.push("");

  process.stdout.write(lines.join("\n") + "\n");
}
