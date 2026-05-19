import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import * as readline from "node:readline/promises";

const HERMESS_CONFIG_NAME = "hermess.config.json";
const VSCODE_MCP_PATH = ".vscode/mcp.json";
const INBOX_DIR = "inbox";
const INBOX_README = "inbox/README.md";

const DEFAULT_HERMESS_CONFIG = {
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
    ".hermess/**",
    ".next/**",
    "build/**",
  ],
};

const DEFAULT_MCP_JSON = {
  servers: {
    hermess: {
      type: "stdio",
      command: "npx",
      args: ["arufheim-hermess", "--repo-path", "${workspaceFolder}"],
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
4. Los archivos procesados se mueven a \`inbox/processed/\`
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
const HERMESS_SERVER_ENTRY = {
  type: "stdio",
  command: "npx",
  args: ["arufheim-hermess"],
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
  if (servers["hermess"]) {
    console.log(
      `  skip  VS Code global (hermess ya configurado en ${mcpPath})`,
    );
    return;
  }

  servers["hermess"] = HERMESS_SERVER_ENTRY;
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
  if (mcpServers["hermess"]) {
    console.log(
      `  skip  Claude Desktop (hermess ya configurado en ${cfgPath})`,
    );
    return;
  }

  mcpServers["hermess"] = {
    command: "npx",
    args: ["arufheim-hermess"],
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
  if (mcpServers["hermess"]) {
    console.log(`  skip  Claude Code (hermess ya configurado en ${cfgPath})`);
    return;
  }

  mcpServers["hermess"] = {
    command: "npx",
    args: ["arufheim-hermess"],
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
  console.log("\n¿Para qué cliente MCP deseas configurar hermess?\n");
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

  console.log(
    "\n✓ Listo. Reinicia el cliente MCP para que tome los cambios.\n",
  );
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

async function runInitLocal(repoPath: string): Promise<void> {
  console.log(`\nInicializando hermess en: ${repoPath}\n`);

  await writeIfAbsent(
    path.join(repoPath, HERMESS_CONFIG_NAME),
    JSON.stringify(DEFAULT_HERMESS_CONFIG, null, 2) + "\n",
    HERMESS_CONFIG_NAME,
  );

  await writeIfAbsent(
    path.join(repoPath, VSCODE_MCP_PATH),
    JSON.stringify(DEFAULT_MCP_JSON, null, 2) + "\n",
    VSCODE_MCP_PATH,
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
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
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
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
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
