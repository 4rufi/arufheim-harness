import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import * as readline from "node:readline/promises";

const harness_CONFIG_NAME = "harness.config.json";
const VSCODE_MCP_PATH = ".vscode/mcp.json";
const COPILOT_INSTRUCTIONS_PATH = ".github/copilot-instructions.md";
const CLAUDE_MD_PATH = "CLAUDE.md";
const CLAUDE_COMMAND_PATH = ".claude/commands/leader.md";
const HARNESS_DIR = ".harness";
const FEATURE_LIST_PATH = ".harness/feature_list.json";
const PROGRESS_DIR = ".harness/progress";
const PROGRESS_CURRENT_PATH = ".harness/progress/current.md";
const INBOX_DIR = ".harness/inbox";
const INBOX_README = ".harness/inbox/README.md";

const DEFAULT_harness_CONFIG = {
  allowedCommands: [
    "pnpm test",
    "npm test",
    "yarn test",
    "ls",
    "pwd",
    "git status",
  ],
  ignored: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    ".harness/**",
    ".next/**",
    "build/**",
  ],
};

const DEFAULT_MCP_JSON = {
  servers: {
    "arufheim-harness": {
      type: "stdio",
      command: "npx",
      args: ["arufheim-harness", "--repo-path", "${workspaceFolder}"],
    },
  },
};

const INBOX_README_CONTENT = `# inbox/

Carpeta para depositar requerimientos en bruto. El agente \`inbox_reader\` los procesa
y convierte en features estructuradas.

## Uso

1. Crea un archivo \`.md\` por proyecto o bloque de requerimientos
2. Usa frontmatter para indicar el scope (opcional):
   \`\`\`markdown
   ---
   scope: nombre-proyecto
   ---
   # Requerimientos
   - El sistema debe hacer X
   - Cuando Y, el sistema debe hacer Z
   \`\`\`
3. Dile al agente: **"procesa el inbox"**
4. Los archivos procesados se mueven a \`.harness/inbox/processed/\`
`;

const COPILOT_INSTRUCTIONS_CONTENT = `# Copilot Instructions

## Arranque automático

Al iniciar CUALQUIER conversación en este repo, sin esperar instrucciones:

1. Lee \`.harness/feature_list.json\`
2. Lee \`.harness/progress/current.md\`
3. Si hay archivos en \`.harness/inbox/\`, listarlos

Reporta en máximo 3 líneas: feature activa, próximo paso, pendientes en inbox.

## Comunicación

No narres tus pasos internos. Actúa y reporta solo el resultado. Prohibido el monólogo tipo "Voy a leer...", "Ahora reviso...", "Ya confirmé...". Si leíste un archivo, muestra qué encontraste, no que lo leíste.

## Ante cualquier pedido de feature o tarea

Sin excepción, antes de implementar:

1. Agrega la feature a \`.harness/feature_list.json\` con \`"status": "pending"\`
2. Cambia a \`"in_progress"\` y escribe el plan en \`.harness/progress/current.md\`
3. Implementa usando las herramientas MCP
4. Al terminar: cambia a \`"done"\`, mueve resumen a \`.harness/progress/history.md\`, limpia \`current.md\`

Una sola feature \`in_progress\` a la vez. No implementes sin registrar primero.

## Herramientas MCP preferidas

Usa SIEMPRE estas herramientas para operaciones sobre el repo:

| Operación         | Herramienta                        |
| ----------------- | ---------------------------------- |
| Buscar texto      | \`mcp_arufheim-harness_search_repo\` |
| Listar archivos   | \`mcp_arufheim-harness_list_files\`  |
| Leer archivos     | \`mcp_arufheim-harness_read_file\`   |
| Ejecutar comandos | \`mcp_arufheim-harness_run_command\` |

No uses \`grep_search\`, \`file_search\`, \`read_file\` ni \`run_in_terminal\` cuando una herramienta arufheim-harness pueda hacer lo mismo.

Usa herramientas nativas solo para:
- editar archivos
- mover archivos de \`.harness/inbox/\`
`;

const CLAUDE_MD_CONTENT = `# CLAUDE.md

## Protocolo de arranque

1. Lee \`.harness/progress/current.md\`.
2. Lee \`.harness/feature_list.json\`.
3. Si hay archivos en \`.harness/inbox/\`, procésalos primero.

## Flujo obligatorio por feature

Antes de implementar cualquier tarea:

1. Agrégala a \`.harness/feature_list.json\` con \`"status": "pending"\`
2. Cambia el estado a \`"in_progress"\` y escribe el plan en \`.harness/progress/current.md\`
3. Implementa
4. Cambia el estado a \`"done"\`, documenta en \`current.md\` y agrega resumen a \`.harness/progress/history.md\`

No implementes nada sin registrarlo primero en \`feature_list.json\`.

## Comunicación

No narres tus pasos internos. Actúa y reporta solo el resultado. Prohibido el monólogo tipo "Voy a leer...", "Ahora reviso...", "Ya confirmé...". Si leíste un archivo, muestra qué encontraste, no que lo leíste.

## Herramientas MCP preferidas

Para operaciones sobre este repositorio, usa SIEMPRE las herramientas MCP de arufheim-harness en lugar de las herramientas nativas:

| Operación         | Herramienta                          |
| ----------------- | ------------------------------------ |
| Buscar texto      | \`mcp__arufheim-harness__search_repo\` |
| Listar archivos   | \`mcp__arufheim-harness__list_files\`  |
| Leer archivos     | \`mcp__arufheim-harness__read_file\`   |
| Ejecutar comandos | \`mcp__arufheim-harness__run_command\` |

No uses \`Glob\`, \`Grep\`, \`Read\` ni \`Bash\` cuando una herramienta arufheim-harness pueda realizar la misma operación.

Usa herramientas nativas solo para:

- editar archivos (\`Edit\`, \`Write\`)
- mover archivos de \`.harness/inbox/\` (\`Bash\`)
`;

const CLAUDE_COMMAND_CONTENT = `# Leader — arranque de sesión

## Protocolo de arranque

1. Lee \`.harness/feature_list.json\`.
2. Lee \`.harness/progress/current.md\`.
3. Lista \`.harness/inbox/\` — si hay archivos, procésalos antes del flujo normal.

## Reportar al humano

Resume en máximo 3 líneas:
- Feature activa (si hay una \`in_progress\`)
- Próximo paso según \`current.md\`
- Pendientes en inbox (si los hay)

Propón la siguiente acción concreta y espera confirmación antes de ejecutar.

## Comunicación

No narres tus pasos internos. Actúa y reporta solo el resultado. Prohibido el monólogo tipo "Voy a leer...", "Ahora reviso...", "Ya confirmé...". Si leíste un archivo, muestra qué encontraste, no que lo leíste.

## Flujo por feature

\`\`\`
pending → in_progress → done
\`\`\`

1. **Tarea nueva**: agrégala a \`.harness/feature_list.json\` con \`"status": "pending"\`
2. **Al arrancar**: cambia a \`"in_progress"\`, escribe el plan en \`.harness/progress/current.md\`
3. **Al terminar**: cambia a \`"done"\`, añade resumen append-only a \`.harness/progress/history.md\`, limpia \`current.md\`

## Reglas duras

- Una sola feature \`in_progress\` a la vez.
- No implementes sin registrar primero en \`feature_list.json\`.
- No declares \`done\` sin verificación ejecutable.
- Si te bloqueas, deja estado \`blocked\` y documenta el motivo en \`current.md\`.
- Tú eres el único que actualiza \`.harness/feature_list.json\`.
`;

const COMMUNICATION_PATCH = `## Comunicación

No narres tus pasos internos. Actúa y reporta solo el resultado. Prohibido el monólogo tipo "Voy a leer...", "Ahora reviso...", "Ya confirmé...". Si leíste un archivo, muestra qué encontraste, no que lo leíste.
`;

const FEATURE_LIST_CONTENT = `[]
`;

const PROGRESS_CURRENT_CONTENT = `# Sesión actual

## Plan

_Sin plan activo._

## Bitácora

_Sin entradas._

## Próximo paso

_Nada pendiente._
`;

// ─── Rutas de config global por cliente MCP ──────────────────────────────────

function getVSCodeGlobalMcpPath(): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library/Application Support/Code/User/mcp.json");
  }
  if (process.platform === "win32") {
    return path.join(process.env["APPDATA"] ?? home, "Code/User/mcp.json");
  }
  return path.join(home, ".config/Code/User/mcp.json");
}

function getClaudeDesktopConfigPath(): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(
      home,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  }
  if (process.platform === "win32") {
    return path.join(
      process.env["APPDATA"] ?? home,
      "Claude/claude_desktop_config.json",
    );
  }
  return path.join(home, ".config/claude/claude_desktop_config.json");
}

function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), ".claude.json");
}

// ─── JSONC parser mínimo (strip comments + trailing commas) ──────────────────

export function parseJsonc(text: string): unknown {
  const withoutComments = stripJsonComments(text);
  const withoutTrailingCommas = stripTrailingCommas(withoutComments);
  return JSON.parse(withoutTrailingCommas);
}

// ─── Escritura a cada cliente ─────────────────────────────────────────────────

// Sin --repo-path: en configs globales el cliente (VS Code, Claude Code) fija
// el CWD al workspace root, y el servidor lo usa como repoPath automáticamente.
const harness_SERVER_ENTRY = {
  type: "stdio",
  command: "npx",
  args: ["arufheim-harness"],
};

async function addToVSCodeGlobal(): Promise<void> {
  const mcpPath = getVSCodeGlobalMcpPath();
  let config: Record<string, unknown> = { servers: {} };

  try {
    const raw = await readFile(mcpPath, "utf8");
    config = parseJsonc(raw) as Record<string, unknown>;
  } catch {
    // archivo no existe aún, usamos defaults
  }

  const servers = (config["servers"] ?? {}) as Record<string, unknown>;
  if (servers["arufheim-harness"]) {
    console.log(
      `  skip  VS Code global (harness ya configurado en ${mcpPath})`,
    );
    return;
  }

  servers["arufheim-harness"] = harness_SERVER_ENTRY;
  config["servers"] = servers;

  await mkdir(path.dirname(mcpPath), { recursive: true });
  await writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`  create VS Code global → ${mcpPath}`);
}

async function addToClaudeDesktop(): Promise<void> {
  const cfgPath = getClaudeDesktopConfigPath();
  let config: Record<string, unknown> = { mcpServers: {} };

  try {
    const raw = await readFile(cfgPath, "utf8");
    config = parseJsonc(raw) as Record<string, unknown>;
  } catch {
    // archivo no existe aún
  }

  const mcpServers = (config["mcpServers"] ?? {}) as Record<string, unknown>;
  if (mcpServers["arufheim-harness"]) {
    console.log(
      `  skip  Claude Desktop (harness ya configurado en ${cfgPath})`,
    );
    return;
  }

  mcpServers["arufheim-harness"] = {
    command: "npx",
    args: ["arufheim-harness"],
  };
  config["mcpServers"] = mcpServers;

  await mkdir(path.dirname(cfgPath), { recursive: true });
  await writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`  create Claude Desktop → ${cfgPath}`);
}

async function addToClaudeCode(): Promise<void> {
  const cfgPath = getClaudeCodeConfigPath();
  let config: Record<string, unknown> = {};

  try {
    const raw = await readFile(cfgPath, "utf8");
    config = parseJsonc(raw) as Record<string, unknown>;
  } catch {
    // archivo no existe aún
  }

  const mcpServers = (config["mcpServers"] ?? {}) as Record<string, unknown>;
  if (mcpServers["arufheim-harness"]) {
    console.log(`  skip  Claude Code (harness ya configurado en ${cfgPath})`);
    return;
  }

  mcpServers["arufheim-harness"] = {
    command: "npx",
    args: ["arufheim-harness"],
  };
  config["mcpServers"] = mcpServers;

  await mkdir(path.dirname(cfgPath), { recursive: true });
  await writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`  create Claude Code → ${cfgPath}`);
}

// ─── Menú interactivo ─────────────────────────────────────────────────────────

const CLIENTS = [
  {
    label: "VS Code (global)",
    fn: addToVSCodeGlobal,
    path: getVSCodeGlobalMcpPath,
  },
  {
    label: "Claude Desktop",
    fn: addToClaudeDesktop,
    path: getClaudeDesktopConfigPath,
  },
  { label: "Claude Code", fn: addToClaudeCode, path: getClaudeCodeConfigPath },
] as const;

async function runInitGlobal(): Promise<void> {
  console.log("\n¿Para qué cliente MCP deseas configurar harness?\n");
  CLIENTS.forEach((c, i) => {
    console.log(`  ${i + 1}) ${c.label.padEnd(20)} ${c.path()}`);
  });
  console.log(`  ${CLIENTS.length + 1}) Todos\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = (
    await rl.question(`Elige [1-${CLIENTS.length + 1}]: `)
  ).trim();
  rl.close();

  const choice = parseInt(answer, 10);
  if (isNaN(choice) || choice < 1 || choice > CLIENTS.length + 1) {
    console.error("\nOpción inválida. Abortando.\n");
    process.exit(1);
  }

  console.log("");
  if (choice === CLIENTS.length + 1) {
    for (const client of CLIENTS) await client.fn();
  } else {
    await CLIENTS[choice - 1].fn();
  }

  // Intentar recargar VS Code via CLI para que detecte el nuevo servidor
  const { execSync } = await import("node:child_process");
  let reloaded = false;
  try {
    execSync("code --command workbench.action.reloadWindow", {
      stdio: "ignore",
      timeout: 3000,
    });
    reloaded = true;
  } catch {
    // code CLI no disponible o no hay ventana abierta — no es error crítico
  }

  if (reloaded) {
    console.log("\n✓ Listo. VS Code se está recargando.\n");
    console.log("  Una vez recargado, activa el servidor así:");
    console.log(
      "  1. Abre el panel MCP (icono de enchufe en la barra lateral)",
    );
    console.log('  2. Busca "arufheim-harness" y haz click en Start\n');
  } else {
    console.log("\n✓ Configuración guardada. Para activar el servidor:\n");
    console.log("  VS Code:");
    console.log('    1. Cmd+Shift+P → "Developer: Reload Window"');
    console.log(
      '    2. Panel MCP → busca "arufheim-harness" → click en Start\n',
    );
    console.log("  Claude Desktop / Claude Code:");
    console.log("    1. Cierra y vuelve a abrir la app\n");
  }

  console.log("─".repeat(50));
  console.log(
    "\nPróximo paso — inicializa cada repo donde quieras usar harness:\n",
  );
  console.log("  cd /ruta/al/repo");
  console.log("  arufheim-harness init\n");
}

// ─── Init local (por repo) ────────────────────────────────────────────────────

interface InitOptions {
  repoPath: string;
  global?: boolean;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeIfAbsent(
  filePath: string,
  content: string,
  label: string,
): Promise<void> {
  if (await fileExists(filePath)) {
    console.log(`  skip  ${label} (ya existe)`);
    return;
  }
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`  create ${label}`);
}

/** Appends `section` to an existing file only if `marker` is not already present. */
async function patchIfMissing(
  filePath: string,
  marker: string,
  section: string,
  label: string,
): Promise<void> {
  if (!(await fileExists(filePath))) return;
  const current = await readFile(filePath, "utf8");
  if (current.includes(marker)) {
    console.log(`  skip  ${label} (ya tiene la sección)`);
    return;
  }
  await writeFile(filePath, current.trimEnd() + "\n\n" + section, "utf8");
  console.log(`  patch ${label}`);
}

async function runInitLocal(repoPath: string): Promise<void> {
  console.log(`\nInicializando harness en: ${repoPath}\n`);

  await writeIfAbsent(
    path.join(repoPath, harness_CONFIG_NAME),
    JSON.stringify(DEFAULT_harness_CONFIG, null, 2) + "\n",
    harness_CONFIG_NAME,
  );

  await writeIfAbsent(
    path.join(repoPath, VSCODE_MCP_PATH),
    JSON.stringify(DEFAULT_MCP_JSON, null, 2) + "\n",
    VSCODE_MCP_PATH,
  );

  await writeIfAbsent(
    path.join(repoPath, COPILOT_INSTRUCTIONS_PATH),
    COPILOT_INSTRUCTIONS_CONTENT,
    COPILOT_INSTRUCTIONS_PATH,
  );
  await patchIfMissing(
    path.join(repoPath, COPILOT_INSTRUCTIONS_PATH),
    "## Comunicación",
    COMMUNICATION_PATCH,
    COPILOT_INSTRUCTIONS_PATH,
  );

  await writeIfAbsent(
    path.join(repoPath, CLAUDE_MD_PATH),
    CLAUDE_MD_CONTENT,
    CLAUDE_MD_PATH,
  );
  await patchIfMissing(
    path.join(repoPath, CLAUDE_MD_PATH),
    "## Comunicación",
    COMMUNICATION_PATCH,
    CLAUDE_MD_PATH,
  );

  await writeIfAbsent(
    path.join(repoPath, CLAUDE_COMMAND_PATH),
    CLAUDE_COMMAND_CONTENT,
    CLAUDE_COMMAND_PATH,
  );

  await mkdir(path.join(repoPath, HARNESS_DIR), { recursive: true });

  await writeIfAbsent(
    path.join(repoPath, FEATURE_LIST_PATH),
    FEATURE_LIST_CONTENT,
    FEATURE_LIST_PATH,
  );

  await mkdir(path.join(repoPath, PROGRESS_DIR), { recursive: true });
  await writeIfAbsent(
    path.join(repoPath, PROGRESS_CURRENT_PATH),
    PROGRESS_CURRENT_CONTENT,
    PROGRESS_CURRENT_PATH,
  );

  await writeIfAbsent(
    path.join(repoPath, INBOX_README),
    INBOX_README_CONTENT,
    `${INBOX_DIR}/`,
  );

  await mkdir(path.join(repoPath, INBOX_DIR, "processed"), { recursive: true });

  console.log("\n✓ Listo. Abre el repo en VS Code para activar el MCP.\n");
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function runInit(options: InitOptions): Promise<void> {
  if (options.global) {
    await runInitGlobal();
  } else {
    await runInitLocal(options.repoPath);
  }
}

export function readInitRepoPath(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--path" || argv[i] === "--repo-path") {
      return argv[i + 1] ?? process.cwd();
    }
    if (argv[i].startsWith("--path=")) {
      return argv[i].slice("--path=".length);
    }
    if (argv[i].startsWith("--repo-path=")) {
      return argv[i].slice("--repo-path=".length);
    }
  }
  return process.cwd();
}

export function isGlobalInit(argv: string[]): boolean {
  return argv.includes("--global");
}

function stripJsonComments(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function stripTrailingCommas(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (lookahead < text.length && /\s/.test(text[lookahead])) {
        lookahead += 1;
      }

      const next = text[lookahead];
      if (next === "}" || next === "]") {
        continue;
      }
    }

    result += char;
  }

  return result;
}
