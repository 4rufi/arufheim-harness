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
      "init",
      "",
      "inicializa workflow base + Claude + Copilot en repo actual",
    ),
  );
  lines.push(
    cmd(
      "init",
      "--claude",
      "workflow base + archivos Claude",
    ),
  );
  lines.push(
    cmd(
      "init",
      "--copilot",
      "workflow base + archivos Copilot",
    ),
  );
  lines.push(
    cmd("init", "--global", "configura VS Code / Claude Desktop / Claude Code"),
  );
  lines.push(
    cmd("init", "--update", "aplica secciones faltantes sin sobreescribir"),
  );
  lines.push(cmd("doctor", "", "valida el setup y propone fixes"));
  lines.push(cmd("tui", "", "dashboard visual con estado del repo"));
  lines.push(cmd("help", "", "muestra esta ayuda"));
  lines.push("");
  lines.push(note("--repo-path <ruta>   raíz del repo (default: cwd)"));
  lines.push(note("--config <ruta>      ruta al harness.config.json"));

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
      "snapshot de sesión; usa brief_only para ahorrar tokens",
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
  lines.push(note("estados: pending · spec_ready · in_progress · done · blocked"));

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
  lines.push(resource("harness://logs/main", "últimas líneas del log JSONL"));

  lines.push("");

  process.stdout.write(lines.join("\n") + "\n");
}
