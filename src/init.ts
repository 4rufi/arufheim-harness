import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import * as readline from "node:readline/promises";
import {
  DEFAULT_CURRENT_MD,
  DEFAULT_HISTORY_MD,
  parseFeatureHistoryText,
  parseFeatureListText,
  resolveWorkflowPaths,
  serializeFeatureHistory,
  serializeFeatureList,
  type WorkflowPaths,
} from "./workflow.js";

const harness_CONFIG_NAME = "harness.config.json";
const VSCODE_MCP_PATH = ".vscode/mcp.json";
const COPILOT_INSTRUCTIONS_PATH = ".github/copilot-instructions.md";
const CLAUDE_MD_PATH = "CLAUDE.md";
const CLAUDE_PROJECT_MCP_PATH = ".mcp.json";
const CLAUDE_AGENTS_DIR = ".claude/agents";
const CLAUDE_COMMAND_PATH = ".claude/commands/harness.md";
const CODEX_CONFIG_PATH = ".codex/config.toml";
const OPENCODE_CONFIG_PATH = ".opencode/opencode.json";
const OPENCODE_COMMAND_PATH = ".opencode/commands/harness.md";
const HARNESS_DIR = ".harness";
const FEATURE_LIST_PATH = ".harness/feature_list.json";
const PROGRESS_DIR = ".harness/progress";
const PROGRESS_CURRENT_PATH = ".harness/progress/current.md";
const INBOX_DIR = ".harness/inbox";
const INBOX_README = ".harness/inbox/README.md";
const GITHUB_PROMPTS_DIR = ".github/prompts";
const AGENTS_MD_PATH = "AGENTS.md";
const REPO_INIT_SCRIPT_PATH = "init.sh";
export const AGENTS_VERSION_MARKER = "<!-- harness-agents-v5 -->";
export const AGENTS_MANAGED_START_MARKER = "<!-- harness-agents-managed:start -->";
export const AGENTS_MANAGED_END_MARKER = "<!-- harness-agents-managed:end -->";

const HARNESS_CONFIG_VERSION = 1;

export type InitTarget =
  | "all"
  | "claude"
  | "copilot"
  | "opencode"
  | "codex";

export type GlobalClientId =
  | "vscode"
  | "claude-desktop"
  | "claude-code"
  | "codex";

export interface GlobalConfigBackupRecord {
  label: string;
  filePath: string;
  backupPath: string;
}

export type PreparedGlobalConfig =
  | {
      kind: "jsonc";
      value: Record<string, unknown>;
    }
  | {
      kind: "toml";
      value: string;
    };

const DEFAULT_AGENT_ROUTING_CONFIG = {
  defaultProvider: "anthropic",
  effort: "auto",
  complexityThreshold: 5,
  autoProviderRouting: true,
  showRouting: true,
  costStrategy: "quality_first",
  models: {
    anthropic: {
      fast: "claude-3-5-haiku-latest",
      deep: "claude-3-7-sonnet-latest",
    },
    openai: {
      fast: "gpt-4.1",
      deep: "gpt-4.1",
    },
    "openai-codex": {
      fast: "gpt-5.5-codex",
      deep: "gpt-5.5",
    },
    "claude-code": {
      fast: "claude-haiku-4.5",
      deep: "claude-sonnet-4.6",
    },
    "copilot-cli": {
      fast: "gpt-4.1",
      deep: "claude-3-7-sonnet-latest",
    },
    "gemini-cli": {
      fast: "gemini-3-flash",
      deep: "gemini-3-pro",
    },
    "gemini-code-assist": {
      fast: "gemini-3-flash",
      deep: "gemini-3-pro",
    },
  },
  taskRouting: {
    architecture: "deep",
    reasoning: "deep",
    refactor: "deep",
    review: "deep",
    tooling: "fast",
    frontend: "deep",
    debug: "deep",
    pr: "deep",
    execution: "auto",
    long_context: "deep",
    general: "auto",
  },
} as const;

const DEFAULT_harness_CONFIG = {
  version: HARNESS_CONFIG_VERSION,
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
  permissionPolicy: {
    mode: "always_allow",
    allowedTools: [],
    allowedRisk: [],
  },
  agentRouting: DEFAULT_AGENT_ROUTING_CONFIG,
};

const ALL_LOCAL_CLIENTS = ["claude", "copilot", "opencode", "codex"] as const;

const DEFAULT_MCP_JSON = {
  servers: {
    "arufheim-harness": {
      type: "stdio",
      command: "npx",
      args: [
        "arufheim-harness",
        "--repo-path",
        "${workspaceFolder}",
        "--client",
        "vscode",
      ],
    },
  },
};

const DEFAULT_OPENCODE_JSON = {
  $schema: "https://opencode.ai/config.json",
  mcp: {
    "arufheim-harness": {
      type: "local",
      command: [
        "npx",
        "arufheim-harness",
        "--repo-path",
        ".",
        "--client",
        "opencode",
      ],
      enabled: true,
    },
  },
  permission: {
    "*": "ask",
    read: "allow",
    glob: "allow",
    grep: "allow",
    list: "allow",
    "arufheim-harness_harness_status": "allow",
    "arufheim-harness_harness_loop_status": "allow",
    "arufheim-harness_harness_metrics": "allow",
    "arufheim-harness_list_files": "allow",
    "arufheim-harness_read_file": "allow",
    "arufheim-harness_search_repo": "allow",
    "arufheim-harness_mem_context": "allow",
    "arufheim-harness_mem_search": "allow",
    "arufheim-harness_mem_get": "allow",
    "arufheim-harness_mem_get_observation": "allow",
  },
};

const DEFAULT_CLAUDE_PROJECT_MCP_JSON = {
  mcpServers: {
    "arufheim-harness": {
      command: "npx",
      args: [
        "--yes",
        "arufheim-harness",
        "--repo-path",
        ".",
        "--client",
        "claude-code",
      ],
      cwd: ".",
      env: {},
    },
  },
};

function renderCodexProjectConfigToml(): string {
  return [
    "[mcp_servers.arufheim-harness]",
    'command = "npx"',
    'args = ["--yes", "arufheim-harness", "--repo-path", ".", "--client", "codex"]',
    'cwd = "."',
    "",
  ].join("\n");
}

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

const COPILOT_INSTRUCTIONS_CONTENT = `# Copilot Instructions — harness

## Arranque

Al iniciar → sin esperar:
1. Lee \`.harness/feature_list.json\`
2. Lee \`.harness/progress/current.md\`
3. Inbox con archivos → lista

Reporta ≤3 líneas: feature activa, próximo paso, inbox pending.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Feature nueva

Siempre antes de implementar:
1. Añade a \`.harness/feature_list.json\` → \`"status": "pending"\`
2. Cambia a \`"in_progress"\` + plan en \`.harness/progress/current.md\`
3. Implementa con herramientas MCP
4. Al terminar: si la feature quedó \`"done"\`, márcala como tal; si la sesión dejó cambios o decisiones útiles, resumen → \`.harness/progress/history.md\`; limpia \`current.md\`

Una sola \`in_progress\`. No implementes sin registrar.

## Herramientas MCP

<!-- harness-tools-v2 -->

| Operación | Herramienta |
|---|---|
| Listar archivos | \`mcp_arufheim-harness_list_files\` |
| Leer archivos | \`mcp_arufheim-harness_read_file\` |
| Escribir archivos | \`mcp_arufheim-harness_write_file\` |
| Buscar texto | \`mcp_arufheim-harness_search_repo\` |
| Ejecutar comandos | \`mcp_arufheim-harness_run_command\` |
| Estado sesión | \`mcp_arufheim-harness_harness_status\` |
| Mutar feature | \`mcp_arufheim-harness_harness_update\` |
| Agregar feature | \`mcp_arufheim-harness_harness_add\` |
| Log bitácora | \`mcp_arufheim-harness_harness_log\` |
| Inbox list | \`mcp_arufheim-harness_inbox_list\` |
| Inbox consume | \`mcp_arufheim-harness_inbox_consume\` |
| Memoria guardar | \`mcp_arufheim-harness_mem_save\` |
| Memoria buscar | \`mcp_arufheim-harness_mem_search\` |
| Memoria por id | \`mcp_arufheim-harness_mem_get\` |
| Memoria observación | \`mcp_arufheim-harness_mem_get_observation\` |
| Memoria contexto | \`mcp_arufheim-harness_mem_context\` |
| Resumen sesión | \`mcp_arufheim-harness_mem_session_summary\` |
| Escribir plan | \`mcp_arufheim-harness_progress_set_plan\` |
| Próximo paso | \`mcp_arufheim-harness_progress_next_step\` |
| Cerrar sesión | \`mcp_arufheim-harness_history_append\` |

Usa herramientas nativas solo para editar archivos.
`;

const CLAUDE_MD_CONTENT = `# CLAUDE.md

## Arranque

1. Lee \`.harness/progress/current.md\`
2. Lee \`.harness/feature_list.json\`
3. Inbox con archivos → procésalos primero

## Flujo por feature

Antes de implementar:
1. Añade a \`.harness/feature_list.json\` → \`"status": "pending"\`
2. \`"in_progress"\` + plan en \`.harness/progress/current.md\`
3. Implementa
4. Si la sesión dejó cambios o decisiones útiles: resumen → \`.harness/progress/history.md\`

No implementes sin registrar.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Herramientas MCP

<!-- harness-tools-v2 -->

| Operación | Herramienta |
|---|---|
| Listar archivos | \`mcp__arufheim-harness__list_files\` |
| Leer archivos | \`mcp__arufheim-harness__read_file\` |
| Escribir archivos | \`mcp__arufheim-harness__write_file\` |
| Buscar texto | \`mcp__arufheim-harness__search_repo\` |
| Ejecutar comandos | \`mcp__arufheim-harness__run_command\` |
| Estado sesión | \`mcp__arufheim-harness__harness_status\` |
| Mutar feature | \`mcp__arufheim-harness__harness_update\` |
| Agregar feature | \`mcp__arufheim-harness__harness_add\` |
| Log bitácora | \`mcp__arufheim-harness__harness_log\` |
| Inbox list | \`mcp__arufheim-harness__inbox_list\` |
| Inbox consume | \`mcp__arufheim-harness__inbox_consume\` |
| Memoria guardar | \`mcp__arufheim-harness__mem_save\` |
| Memoria buscar | \`mcp__arufheim-harness__mem_search\` |
| Memoria por id | \`mcp__arufheim-harness__mem_get\` |
| Memoria observación | \`mcp__arufheim-harness__mem_get_observation\` |
| Memoria contexto | \`mcp__arufheim-harness__mem_context\` |
| Resumen sesión | \`mcp__arufheim-harness__mem_session_summary\` |
| Escribir plan | \`mcp__arufheim-harness__progress_set_plan\` |
| Próximo paso | \`mcp__arufheim-harness__progress_next_step\` |
| Cerrar sesión | \`mcp__arufheim-harness__history_append\` |

Usa \`Edit\`/\`Write\` solo para editar archivos. No uses \`Glob\`, \`Grep\`, \`Read\`, \`Bash\` cuando harness lo cubra.
`;

const CLAUDE_COMMAND_CONTENT = `# Leader — arranque de sesión

## Arranque

1. Lee \`.harness/feature_list.json\`
2. Lee \`.harness/progress/current.md\`
3. Lista \`.harness/inbox/\` — si hay archivos, procésalos primero

Resume ≤3 líneas: feature activa, próximo paso, inbox pendiente. Propón acción concreta, espera confirmación.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Flujo

pending → in_progress → tests+README+CHANGELOG → done

1. Tarea nueva: añade → \`"pending"\`
2. Arrancar: \`"in_progress"\` + plan en \`.harness/progress/current.md\`
3. Terminar: si la feature quedó \`"done"\`, márcala como tal; si la sesión dejó cambios o decisiones útiles, resumen → \`.harness/progress/history.md\` + limpia \`current.md\`

## Reglas

- Una sola \`in_progress\` a la vez
- No implementes sin registrar en \`feature_list.json\`
- No declares \`done\` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y \`CHANGELOG.md\` alineado cuando el cambio sea release-facing
- Bloqueado → estado \`blocked\` + motivo en \`current.md\`
`;

const COMMUNICATION_PATCH = `## Comunicación

No narres pasos internos. Muestra resultado, no proceso.
`;

const COPILOT_TOOLS_PATCH = `## Herramientas MCP

<!-- harness-tools-v2 -->

| Operación | Herramienta |
|---|---|
| Listar archivos | \`mcp_arufheim-harness_list_files\` |
| Leer archivos | \`mcp_arufheim-harness_read_file\` |
| Escribir archivos | \`mcp_arufheim-harness_write_file\` |
| Buscar texto | \`mcp_arufheim-harness_search_repo\` |
| Ejecutar comandos | \`mcp_arufheim-harness_run_command\` |
| Estado sesión | \`mcp_arufheim-harness_harness_status\` |
| Mutar feature | \`mcp_arufheim-harness_harness_update\` |
| Agregar feature | \`mcp_arufheim-harness_harness_add\` |
| Log bitácora | \`mcp_arufheim-harness_harness_log\` |
| Inbox list | \`mcp_arufheim-harness_inbox_list\` |
| Inbox consume | \`mcp_arufheim-harness_inbox_consume\` |
| Memoria guardar | \`mcp_arufheim-harness_mem_save\` |
| Memoria buscar | \`mcp_arufheim-harness_mem_search\` |
| Memoria por id | \`mcp_arufheim-harness_mem_get\` |
| Memoria observación | \`mcp_arufheim-harness_mem_get_observation\` |
| Memoria contexto | \`mcp_arufheim-harness_mem_context\` |
| Resumen sesión | \`mcp_arufheim-harness_mem_session_summary\` |
| Escribir plan | \`mcp_arufheim-harness_progress_set_plan\` |
| Próximo paso | \`mcp_arufheim-harness_progress_next_step\` |
| Cerrar sesión | \`mcp_arufheim-harness_history_append\` |
`;

const CLAUDE_TOOLS_PATCH = `## Herramientas MCP

<!-- harness-tools-v2 -->

| Operación | Herramienta |
|---|---|
| Listar archivos | \`mcp__arufheim-harness__list_files\` |
| Leer archivos | \`mcp__arufheim-harness__read_file\` |
| Escribir archivos | \`mcp__arufheim-harness__write_file\` |
| Buscar texto | \`mcp__arufheim-harness__search_repo\` |
| Ejecutar comandos | \`mcp__arufheim-harness__run_command\` |
| Estado sesión | \`mcp__arufheim-harness__harness_status\` |
| Mutar feature | \`mcp__arufheim-harness__harness_update\` |
| Agregar feature | \`mcp__arufheim-harness__harness_add\` |
| Log bitácora | \`mcp__arufheim-harness__harness_log\` |
| Inbox list | \`mcp__arufheim-harness__inbox_list\` |
| Inbox consume | \`mcp__arufheim-harness__inbox_consume\` |
| Memoria guardar | \`mcp__arufheim-harness__mem_save\` |
| Memoria buscar | \`mcp__arufheim-harness__mem_search\` |
| Memoria por id | \`mcp__arufheim-harness__mem_get\` |
| Memoria observación | \`mcp__arufheim-harness__mem_get_observation\` |
| Memoria contexto | \`mcp__arufheim-harness__mem_context\` |
| Resumen sesión | \`mcp__arufheim-harness__mem_session_summary\` |
| Escribir plan | \`mcp__arufheim-harness__progress_set_plan\` |
| Próximo paso | \`mcp__arufheim-harness__progress_next_step\` |
| Cerrar sesión | \`mcp__arufheim-harness__history_append\` |
`;

const AGENTS_MD_CONTENT = `# AGENTS.md

Punto de entrada para agentes. Lee antes de operar.

## Mapa

| Archivo | Qué contiene |
|---|---|
| \`.harness/feature_list.json\` | Lista de features y estado |
| \`.harness/progress/current.md\` | Estado vivo de la sesión |
| \`.harness/progress/history.md\` | Historial append-only |
| \`.harness/inbox/\` | Requerimientos en bruto pendientes |

## Flujo

\`\`\`
pending → in_progress → tests+README+CHANGELOG → done
\`\`\`

- Una sola \`in_progress\` a la vez
- No implementes sin registrar en \`feature_list.json\`
- SDD: \`pending → spec_ready → aprobación humana → in_progress → tests+README+CHANGELOG → done\`

## Cierre de sesión

1. Actualiza \`.harness/feature_list.json\`
2. Añade resumen a \`.harness/progress/history.md\`
3. Limpia \`.harness/progress/current.md\`
`;

const LEADER_PROMPT_CONTENT = `---
agent: leader
description: Orquestador. Coordina el flujo SDD del repo y delega el trabajo. NUNCA implementa código directamente.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_run_command
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
  - mcp_arufheim-harness_harness_update
  - mcp_arufheim-harness_harness_add
  - mcp_arufheim-harness_harness_log
  - mcp_arufheim-harness_progress_set_plan
  - mcp_arufheim-harness_progress_next_step
  - mcp_arufheim-harness_history_append
  - mcp_arufheim-harness_mem_save
  - mcp_arufheim-harness_mem_search
  - mcp_arufheim-harness_mem_context
  - mcp_arufheim-harness_mem_session_summary
---

<!-- harness-agents-v5 -->

# Leader

Eres el orquestador. No escribes código de producto.

## Arranque

1. Lee \`AGENTS.md\`
2. Lee \`.harness/feature_list.json\` y \`.harness/progress/current.md\`
3. Llama \`mem_context\` para recuperar el contexto reciente de memoria
4. Inbox con archivos → procésalos primero
Resume ≤3 líneas: feature activa, próximo paso, inbox pendiente. Propón acción concreta, espera confirmación.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Reglas

- Una sola \`in_progress\` a la vez
- Tú eres el único que actualiza \`.harness/feature_list.json\`
- No saltes aprobación humana entre \`spec_ready\` e \`in_progress\`

## Flujo SDD (\`"sdd": true\`)

\`\`\`
pending → [spec_author] → spec_ready → HUMANO → in_progress → [implementer → tests+README+CHANGELOG] → [reviewer] → done
\`\`\`

### pending
1. Lanza \`spec_author\`
2. Si OK → \`spec_ready\` + para, pide revisión humana

### spec_ready + aprobación
1. \`in_progress\`
2. Lanza \`implementer\` → exige verificación relevante + README/docs si aplica + CHANGELOG si el cambio es release-facing → si \`done\` → lanza \`reviewer\`
3. Si \`APPROVED\` → \`done\`; usa \`history_append\` si la sesión dejó cambios o decisiones útiles; limpia \`current.md\`

### spec_ready sin aprobación
No continúas.

### in_progress (sesión interrumpida)
Revisa \`current.md\`, pregunta reanudar o abortar.

### blocked
Mueve feature a \`blocked\`, documenta en \`current.md\`, reporta al humano.

## Flujo simple (sin SDD)

\`\`\`
pending → in_progress → [implementer → tests+README+CHANGELOG] → done
\`\`\`
`;

const IMPLEMENTER_PROMPT_CONTENT = `---
agent: implementer
description: Trabajador. Implementa una sola feature según su spec aprobado. Escribe código, verificación y evidencia de trazabilidad.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_run_command
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_log
  - mcp_arufheim-harness_progress_set_plan
  - mcp_arufheim-harness_progress_next_step
  - mcp_arufheim-harness_mem_save
  - mcp_arufheim-harness_mem_search
  - mcp_arufheim-harness_mem_context
  - mcp_arufheim-harness_mem_session_summary
---

<!-- harness-agents-v5 -->

# Implementador

Ejecutas exactamente una feature aprobada.

## Precondiciones

- Feature en \`in_progress\` en \`.harness/feature_list.json\`
- Si SDD: existen \`specs/<name>/{requirements.md,design.md,tasks.md}\`
- Si falla → documenta en \`.harness/progress/current.md\`

## Reglas

- No cambias \`.harness/feature_list.json\`
- No inventas requisitos fuera del spec
- No marcas \`[x]\` hasta que el cambio y verificación pasen

## Protocolo

1. Lee \`AGENTS.md\` y \`.harness/progress/current.md\`
2. Llama \`mem_context\` con la feature activa para recuperar contexto relevante
3. Si SDD: lee \`specs/<name>/{requirements.md,design.md,tasks.md}\`
4. Actualiza \`## Plan\` en \`current.md\` con las tasks
Para cada task:
1. Implementa
2. Verifica
3. Actualiza README/docs si cambia el uso o comportamiento visible
4. Actualiza \`CHANGELOG.md\` si el cambio es release-facing
5. Marca \`[x]\` en \`tasks.md\`
6. Actualiza \`## Bitácora\` y \`## Próximo paso\`

## Cierre

Escribe \`.harness/progress/impl_<name>.md\`:

\`\`\`markdown
# Impl — <name>

## Archivos tocados

## Trazabilidad R<n> → verificación

## Verificación final
\`\`\`

Respuesta final:

\`\`\`
done -> .harness/progress/impl_<name>.md
\`\`\`

o

\`\`\`
blocked -> .harness/progress/impl_<name>.md
\`\`\`
`;

const REVIEWER_PROMPT_CONTENT = `---
agent: reviewer
description: Revisor automático. Aprueba o rechaza el trabajo del implementador.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_run_command
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_mem_search
---

<!-- harness-agents-v5 -->

# Revisor

Apruebas o rechazas cambios. No editas código ni cambias estados.

## Protocolo

1. Lee \`AGENTS.md\` y \`.harness/progress/impl_<name>.md\`
2. Llama \`mem_context\` para recuperar contexto de memoria relevante
3. Si SDD: lee \`specs/<name>/requirements.md\` y \`specs/<name>/tasks.md\`
4. Verifica que todas las tasks estén \`[x]\`
5. Comprueba trazabilidad R<n> → verificación ejecutable
6. Emite veredicto
## Veredicto

Escribe \`.harness/progress/review_<name>.md\`:

\`\`\`markdown
# Review — <name>

**Veredicto:** APPROVED | CHANGES_REQUESTED

## Trazabilidad

- R1: [x] verificado con \`<comando>\`

## Tasks

- T1: [x]

## Observaciones
\`\`\`

Respuesta final: \`APPROVED\` o \`CHANGES_REQUESTED\`
`;

const SPEC_AUTHOR_PROMPT_CONTENT = `---
agent: spec_author
description: Redacta specs Kiro-style (requirements/design/tasks) para una feature pending con "sdd": true. NUNCA escribe código de aplicación ni tests.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_mem_search
---

<!-- harness-agents-v5 -->

# Spec Author

Produces specs para una feature \`pending\` con \`"sdd": true\`. No escribes código.

## Protocolo

1. Lee \`AGENTS.md\` y \`.harness/feature_list.json\`
2. Toma la feature \`pending\` de menor \`id\` con \`"sdd": true\`
3. Crea \`specs/<name>/\` si no existe
4. Redacta:
   - \`requirements.md\` — requisitos EARS, verificables
   - \`design.md\` — archivos a tocar, firmas, restricciones, alternativa descartada
   - \`tasks.md\` — pasos discretos \`[ ] T<n>\` con referencia a R<n>

## Reglas

- No editas código ni \`.harness/feature_list.json\`
- Si el acceptance no alcanza para specs verificables → \`blocked\`

## Respuesta final

\`\`\`
spec_ready -> specs/<name>/
\`\`\`

o

\`\`\`
blocked -> .harness/progress/spec_<name>.md
\`\`\`
`;

const INBOX_READER_PROMPT_CONTENT = `---
agent: inbox_reader
description: Procesa archivos de requerimientos en inbox/ y los convierte en features en feature_list.json.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_add
  - mcp_arufheim-harness_harness_update
  - mcp_arufheim-harness_inbox_list
  - mcp_arufheim-harness_inbox_consume
---

<!-- harness-agents-v5 -->

# Inbox Reader

Convierte requerimientos en bruto en features estructuradas.

## Proceso

1. Lista \`.harness/inbox/\` (excluye \`processed/\` y \`README.md\`)
2. Por cada archivo:
   - Extrae scope (frontmatter \`scope:\` o nombre del archivo)
   - Identifica funcionalidades discretas → una feature cada una
   - Asigna \`id\` incremental desde el máximo en \`feature_list.json\`
   - Determina \`"sdd": true\` según complejidad
3. Añade features con \`harness_add\`
4. Consume archivo con \`inbox_consume\`
5. Actualiza \`## Bitácora\` en \`.harness/progress/current.md\`

## Reglas

- No implementes nada
- Requerimiento ambiguo → \`"status": "blocked"\` + descripción del problema
- Un archivo puede generar múltiples features
`;

const SCOPER_PROMPT_CONTENT = `---
agent: scoper
description: Filtra feature_list.json por proyecto/scope y define qué trabaja el agente en esta sesión.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
---

<!-- harness-agents-v5 -->

# Scoper

Acota el contexto de trabajo para una sesión.

## Cuándo

- El humano pide trabajar solo en un proyecto específico
- Hay features de múltiples scopes mezcladas

## Proceso

1. Lee \`.harness/feature_list.json\`
2. Agrupa por campo \`scope\` (sin scope → \`"general"\`)
3. Presenta resumen al humano:
   \`\`\`
   proyecto_a (3 pending, 1 in_progress)
   proyecto_b (2 pending)
   \`\`\`
4. Espera elección del humano
5. Registra scope activo en \`## Bitácora\` de \`.harness/progress/current.md\`
6. Devuelve al leader la lista de ids a procesar

## Reglas

- No cambias status de features
- Si el humano no elige → no hagas nada
`;

const AGENT_PROMPTS: Array<[string, string]> = [
  ["leader.prompt.md", LEADER_PROMPT_CONTENT],
  ["implementer.prompt.md", IMPLEMENTER_PROMPT_CONTENT],
  ["reviewer.prompt.md", REVIEWER_PROMPT_CONTENT],
  ["spec_author.prompt.md", SPEC_AUTHOR_PROMPT_CONTENT],
  ["inbox_reader.prompt.md", INBOX_READER_PROMPT_CONTENT],
  ["scoper.prompt.md", SCOPER_PROMPT_CONTENT],
];

const CLAUDE_LEADER_CONTENT = `---
name: leader
description: Orquestador. Coordina el flujo SDD del repo y delega el trabajo. NUNCA implementa código directamente.
tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

<!-- harness-agents-v5 -->

# Leader

Eres el orquestador. No escribes código de producto.

## Arranque

1. Lee \`AGENTS.md\`
2. Lee \`.harness/feature_list.json\` y \`.harness/progress/current.md\`
3. Llama \`mem_context\` para recuperar el contexto reciente de memoria
4. Inbox con archivos → procésalos primero
Resume ≤3 líneas: feature activa, próximo paso, inbox pendiente. Propón acción concreta, espera confirmación.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Reglas

- Una sola \`in_progress\` a la vez
- Tú eres el único que actualiza \`.harness/feature_list.json\`
- No saltes aprobación humana entre \`spec_ready\` e \`in_progress\`

## Flujo SDD (\`"sdd": true\`)

\`\`\`
pending → [spec_author] → spec_ready → HUMANO → in_progress → [implementer → tests+README+CHANGELOG] → [reviewer] → done
\`\`\`

### pending
1. Lanza \`spec_author\`
2. Si OK → \`spec_ready\` + para, pide revisión humana

### spec_ready + aprobación
1. \`in_progress\`
2. Lanza \`implementer\` → exige verificación relevante + README/docs si aplica + CHANGELOG si el cambio es release-facing → si \`done\` → lanza \`reviewer\`
3. Si \`APPROVED\` → \`done\`; si la sesión dejó cambios o decisiones útiles, resumen en \`.harness/progress/history.md\` + limpia \`current.md\`

### spec_ready sin aprobación
No continúas.

### in_progress (sesión interrumpida)
Revisa \`current.md\`, pregunta reanudar o abortar.

### blocked
Mueve feature a \`blocked\`, documenta en \`current.md\`, reporta al humano.

## Flujo simple (sin SDD)

\`\`\`
pending → in_progress → [implementer → tests+README+CHANGELOG] → done
\`\`\`
`;

const CLAUDE_IMPLEMENTER_CONTENT = `---
name: implementer
description: Trabajador. Implementa una sola feature según su spec aprobado. Escribe código, verificación y evidencia de trazabilidad.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v5 -->

# Implementador

Ejecutas exactamente una feature aprobada.

## Precondiciones

- Feature en \`in_progress\` en \`.harness/feature_list.json\`
- Si SDD: existen \`specs/<name>/{requirements.md,design.md,tasks.md}\`
- Si falla → documenta en \`.harness/progress/current.md\`

## Reglas

- No cambias \`.harness/feature_list.json\`
- No inventas requisitos fuera del spec
- No marcas \`[x]\` hasta que el cambio y verificación pasen

## Protocolo

1. Lee \`AGENTS.md\` y \`.harness/progress/current.md\`
2. Llama \`mem_context\` con la feature activa para recuperar contexto relevante
3. Si SDD: lee \`specs/<name>/{requirements.md,design.md,tasks.md}\`
4. Actualiza \`## Plan\` en \`current.md\` con las tasks
Para cada task:
1. Implementa
2. Verifica
3. Actualiza README/docs si cambia el uso o comportamiento visible
4. Actualiza \`CHANGELOG.md\` si el cambio es release-facing
5. Marca \`[x]\` en \`tasks.md\`
6. Actualiza \`## Bitácora\` y \`## Próximo paso\`

## Cierre

Escribe \`.harness/progress/impl_<name>.md\`:

\`\`\`markdown
# Impl — <name>

## Archivos tocados

## Trazabilidad R<n> → verificación

## Verificación final
\`\`\`

Respuesta final:

\`\`\`
done -> .harness/progress/impl_<name>.md
\`\`\`

o

\`\`\`
blocked -> .harness/progress/impl_<name>.md
\`\`\`
`;

const CLAUDE_REVIEWER_CONTENT = `---
name: reviewer
description: Revisor automático. Aprueba o rechaza el trabajo del implementador.
tools: Read, Write, Glob, Grep, Bash
---

<!-- harness-agents-v5 -->

# Revisor

Apruebas o rechazas cambios. No editas código ni cambias estados.

## Protocolo

1. Lee \`AGENTS.md\` y \`.harness/progress/impl_<name>.md\`
2. Llama \`mem_context\` para recuperar contexto de memoria relevante
3. Si SDD: lee \`specs/<name>/requirements.md\` y \`specs/<name>/tasks.md\`
4. Verifica que todas las tasks estén \`[x]\`
5. Comprueba trazabilidad R<n> → verificación ejecutable
6. Emite veredicto
## Veredicto

Escribe \`.harness/progress/review_<name>.md\`:

\`\`\`markdown
# Review — <name>

**Veredicto:** APPROVED | CHANGES_REQUESTED

## Trazabilidad

- R1: [x] verificado con \`<comando>\`

## Tasks

- T1: [x]

## Observaciones
\`\`\`

Respuesta final: \`APPROVED\` o \`CHANGES_REQUESTED\`
`;

const CLAUDE_SPEC_AUTHOR_CONTENT = `---
name: spec_author
description: Redacta specs Kiro-style (requirements/design/tasks) para una feature pending con "sdd": true. NUNCA escribe código de aplicación ni tests.
tools: Read, Write, Edit, Glob, Grep
---

<!-- harness-agents-v5 -->

# Spec Author

Produces specs para una feature \`pending\` con \`"sdd": true\`. No escribes código.

## Protocolo

1. Lee \`AGENTS.md\` y \`.harness/feature_list.json\`
2. Toma la feature \`pending\` de menor \`id\` con \`"sdd": true\`
3. Crea \`specs/<name>/\` si no existe
4. Redacta:
   - \`requirements.md\` — requisitos EARS, verificables
   - \`design.md\` — archivos a tocar, firmas, restricciones, alternativa descartada
   - \`tasks.md\` — pasos discretos \`[ ] T<n>\` con referencia a R<n>

## Reglas

- No editas código ni \`.harness/feature_list.json\`
- Si el acceptance no alcanza para specs verificables → \`blocked\`

## Respuesta final

\`\`\`
spec_ready -> specs/<name>/
\`\`\`

o

\`\`\`
blocked -> .harness/progress/spec_<name>.md
\`\`\`
`;

const CLAUDE_INBOX_READER_CONTENT = `---
name: inbox_reader
description: Procesa archivos de requerimientos en inbox/ y los convierte en features en feature_list.json.
tools: Read, Write, Edit, Glob, Bash
---

<!-- harness-agents-v5 -->

# Inbox Reader

Convierte requerimientos en bruto en features estructuradas.

## Proceso

1. Lista \`.harness/inbox/\` (excluye \`processed/\` y \`README.md\`)
2. Por cada archivo:
   - Extrae scope (frontmatter \`scope:\` o nombre del archivo)
   - Identifica funcionalidades discretas → una feature cada una
   - Asigna \`id\` incremental desde el máximo en \`.harness/feature_list.json\`
   - Determina \`"sdd": true\` según complejidad
3. Añade features a \`.harness/feature_list.json\`
4. Mueve el archivo a \`.harness/inbox/processed/<archivo>\`
5. Actualiza \`## Bitácora\` en \`.harness/progress/current.md\`

## Reglas

- No implementes nada
- Requerimiento ambiguo → \`"status": "blocked"\` + descripción del problema
- Un archivo puede generar múltiples features
`;

const CLAUDE_SCOPER_CONTENT = `---
name: scoper
description: Filtra feature_list.json por proyecto/scope y define qué trabaja el agente en esta sesión.
tools: Read, Write, Edit, Glob
---

<!-- harness-agents-v5 -->

# Scoper

Acota el contexto de trabajo para una sesión.

## Cuándo

- El humano pide trabajar solo en un proyecto específico
- Hay features de múltiples scopes mezcladas

## Proceso

1. Lee \`.harness/feature_list.json\`
2. Agrupa por campo \`scope\` (sin scope → \`"general"\`)
3. Presenta resumen al humano:
   \`\`\`
   proyecto_a (3 pending, 1 in_progress)
   proyecto_b (2 pending)
   \`\`\`
4. Espera elección del humano
5. Registra scope activo en \`## Bitácora\` de \`.harness/progress/current.md\`
6. Devuelve al leader la lista de ids a procesar

## Reglas

- No cambias status de features
- Si el humano no elige → no hagas nada
`;

const CLAUDE_AGENT_FILES: Array<[string, string]> = [
  ["leader.md", CLAUDE_LEADER_CONTENT],
  ["implementer.md", CLAUDE_IMPLEMENTER_CONTENT],
  ["reviewer.md", CLAUDE_REVIEWER_CONTENT],
  ["spec_author.md", CLAUDE_SPEC_AUTHOR_CONTENT],
  ["inbox_reader.md", CLAUDE_INBOX_READER_CONTENT],
  ["scoper.md", CLAUDE_SCOPER_CONTENT],
];

const FEATURE_LIST_CONTENT = `[]
`;

const PROGRESS_CURRENT_CONTENT = `# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a \`history.md\`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** \`_Sin feature activa._\`
- **Inicio:** \`_Sin sesión activa._\`
- **Agente:** \`_Sin sesión activa._\`

## Plan

_Sin plan activo._

## Bitácora

_Sin entradas._

## Próximo paso

_Nada pendiente._
`;

const CODEX_MD_PATH = "CODEX.md";
const PROGRESS_HISTORY_PATH = ".harness/progress/history.md";
const PROGRESS_README_PATH = ".harness/progress/README.md";
const DOCS_ARCHITECTURE_PATH = ".harness-docs/architecture.md";
const DOCS_CONVENTIONS_PATH = ".harness-docs/conventions.md";
const DOCS_SPECS_PATH = ".harness-docs/specs.md";
const DOCS_SPECS_POLICY_PATH = ".harness-docs/specs_policy.md";
const DOCS_VERIFICATION_PATH = ".harness-docs/verification.md";
const DOCS_MODEL_INTERFACE_PATH = ".harness-docs/model_interface.md";
const DOCS_CONTEXT_MANAGER_PATH = ".harness-docs/context_manager.md";
const DOCS_EXECUTION_ENGINE_PATH = ".harness-docs/execution_engine.md";
const DOCS_MEMORY_SYSTEM_PATH = ".harness-docs/memory_system.md";
const DOCS_ORCHESTRATION_PATH = ".harness-docs/orchestration.md";
const DOCS_TOOL_CATALOG_PATH = ".harness-docs/tool_catalog.md";
const DOCS_OBSERVATION_POLICY_PATH = ".harness-docs/observation_policy.md";
const DOCS_PLANNING_MODEL_PATH = ".harness-docs/planning_model.md";
const DOCS_BUDGETS_PATH = ".harness-docs/budgets.md";
const DOCS_CONTRACT_VERSIONS_PATH = ".harness-docs/contract_versions.md";
const DOCS_FRONTEND_ADAPTERS_PATH = ".harness-docs/frontend_adapters.md";
const DOCS_LOOP_CONTRACT_PATH = ".harness-docs/loop_contract.md";
const CHECKPOINTS_PATH = "CHECKPOINTS.md";

const SCAFFOLD_PROGRESS_README_CONTENT = `# Progress

\`progress/\` guarda estado operativo, no notas libres.

## Archivos

- \`current.md\`: sesión viva
- \`history.md\`: sesiones relevantes append-only
- \`explore_<topic>.md\`: exploración opcional
- \`impl_<feature>.md\`: evidencia de implementación
- \`review_<feature>.md\`: veredicto de review
- \`spec_<feature>.md\`: bloqueo del spec

## Reglas

- \`current.md\` se actualiza en tiempo real y se resetea al cerrar
- \`history.md\` solo agrega al final
- registra en \`history.md\` toda sesión con cambios en código, docs, config o workflow, y toda decisión útil de preservar
- no registres sesiones sin efecto ni exploración descartable que no deje una decisión o cambio concreto
- nombres válidos: \`README.md\`, \`current.md\`, \`history.md\`, \`explore_*.md\`, \`impl_*.md\`, \`review_*.md\`, \`spec_*.md\`
- no agregues headings nuevas a \`current.md\`
- \`explore_*.md\` es opcional
- \`Agente\` en \`history.md\` debe ser real
`;

const SCAFFOLD_ARCHITECTURE_DOC_CONTENT = `# Architecture

Documenta aquí la estructura real del repo: módulos principales, límites entre
capas, puntos de entrada y dependencias que no deben cruzarse.

## Mínimo esperado

- qué carpetas o módulos concentran lógica de producto
- qué capas no deben depender entre sí
- dónde viven tests, scripts y assets
- decisiones estructurales que el reviewer debe proteger
`;

const SCAFFOLD_CONVENTIONS_DOC_CONTENT = `# Conventions

Documenta aquí las reglas locales del repo. Mantén este archivo corto y
accionable.

## Recomendado

- naming, formato y estilo predominante
- cómo se manejan errores y logs
- qué nivel de tests se espera por cambio
- cuándo actualizar README o docs de uso
- reglas de edición del worktree si aplica
`;

const SCAFFOLD_SPECS_DOC_CONTENT = `# Spec Driven Development

## Flujo

\`\`\`text
pending -> spec_ready -> aprobación humana -> in_progress -> done
\`\`\`

No se implementa una feature SDD sin aprobación humana explícita en \`spec_ready\`.

## Archivos obligatorios

\`\`\`text
specs/<feature>/
  requirements.md
  design.md
  tasks.md
  spec_summary.md
\`\`\`

- \`requirements.md\`: \`R<n>\` verificables
- \`design.md\`: archivos, restricciones, decisión principal
- \`tasks.md\`: pasos discretos con \`[ ]\` / \`[x]\`
- \`spec_summary.md\`: una pantalla máximo; usa \`Goal\`, \`Touch\`, \`Constraints\`, \`Verify\`, \`Tasks\`

## EARS mínimo

- \`El sistema DEBE ...\`
- \`CUANDO ..., el sistema DEBE ...\`
- \`MIENTRAS ..., el sistema DEBE ...\`
- \`DONDE ..., el sistema DEBE ...\`
- \`SI ... ENTONCES el sistema DEBE ...\`

## Formato compacto recomendado

- \`requirements.md\`: una línea por \`R<n>\`
- \`tasks.md\`: una línea por \`T<n>\` con cobertura \`R<n>\`
- \`design.md\`: abre con \`Decision\`, \`Touch\`, \`Constraints\`, \`Verify\`
- \`spec_summary.md\`: una sola pantalla

## Regla de uso

Si una feature nueva todavía no tiene \`sdd\` decidido, revisa \`.harness-docs/specs_policy.md\`.
`;

const SCAFFOLD_SPECS_POLICY_DOC_CONTENT = `# Política SDD

Usa \`sdd: true\` si implementar mal la feature cuesta más que escribir el spec.

## Marca \`sdd: true\` cuando la feature:

- cambia comportamiento observable
- toca más de un archivo o más de una capa
- introduce una tool, comando, resource o surface nueva
- cambia contratos, estados, formatos o flujo
- toca seguridad, permisos, escritura, ejecución o boundaries
- tiene ambigüedad de diseño o varias implementaciones razonables

## Normalmente no requiere SDD

- fix local y obvio
- rename mecánico
- doc pequeña
- test faltante
- refactor interno sin cambio observable

## Regla operativa

- \`0\` criterios: no SDD
- \`1\` criterio suave: decide líder o humano
- \`1\` criterio fuerte o \`2\` suaves: \`sdd: true\`
`;

const SCAFFOLD_VERIFICATION_DOC_CONTENT = `# Verificación

No cierres una feature con "parece funcionar". Deja comandos y evidencia
ejecutable.

## Regla

Usa la verificación estándar del repo. Si existe un comando único como
\`verify\`, úsalo. Si no existe, corre el conjunto mínimo relevante para el
cambio: tests, build, lint, typecheck o equivalente del stack.

## Paso documental

Si el cambio modifica comportamiento visible, onboarding, comandos o flujo de
uso:

- actualiza \`README.md\` y/o la doc de uso correspondiente
- si no aplica, deja constancia breve en \`progress/impl_<feature>.md\`

## Paso release

Si el cambio afecta release notes, surface pública, setup, comandos, contrato o
comportamiento que deba aparecer en una publicación:

- actualiza \`CHANGELOG.md\`
- o deja constancia breve en \`progress/impl_<feature>.md\` de por qué no aplica

## Cierre

- documenta en \`progress/impl_<feature>.md\` qué comandos corriste
- confirma que README/docs quedaron alineados o documenta por qué no aplica
- confirma que \`CHANGELOG.md\` quedó alineado si el cambio es release-facing o documenta por qué no aplica
- el reviewer debe poder repetirlos
- una feature no pasa a \`done\` con verificación roja o faltante
`;

const SCAFFOLD_MODEL_INTERFACE_DOC_CONTENT = `# Model Interface

Define el contrato común entre el arnés y cada frontend (\`Codex\`,
\`Claude\`, \`Copilot\`).

## Qué es común

- arranque con \`harness_status({ mode: "brief_minimal" })\`
- uso de \`startup_brief\` como snapshot inicial
- si hay feature activa, \`harness_loop_status\` como estado vivo del intento actual
- \`mem_context\` antes de abrir más archivos
- paths canónicos en \`.harness/\` y \`.harness-docs/\`
- artefactos de salida en \`specs/\` y \`.harness/progress/\`

## Qué puede variar por frontend

- sintaxis de tool call
- formato de prompts/agentes
- integración MCP local
- estilo de respuesta al humano

## Startup contract v2

1. \`startup_brief\`
2. \`harness_loop_status\` si existe feature activa
3. \`mem_context\`
4. paths canónicos del repo
5. solo después, archivos adicionales mínimos

## Regla

El flujo central no depende de un modelo específico. Las diferencias viven en
adapters/prompts, no en el contrato base.
`;

const SCAFFOLD_CONTEXT_MANAGER_DOC_CONTENT = `# Context Manager

Decide qué entra al contexto y cuándo.

## Niveles

1. \`brief\`
   - \`startup_brief\`
   - \`harness_loop_status\` si hay feature activa
   - \`mem_context\`
2. \`summary\`
   - \`spec_summary.md\`
   - \`{{currentPath}}\`
3. \`full\`
   - \`requirements.md\`
   - \`tasks.md\`
   - \`design.md\` solo si hace falta
4. \`code\`
   - archivos tocados
   - verificación relevante

## Regla de escalado

- no abras backlog completo si \`startup_brief\` alcanza
- no abras specs completas si \`harness_loop_status\` ya te dice fase, intento y budget
- no abras \`design.md\` si \`spec_summary.md\` resuelve la tarea
- no abras historial salvo bloqueo o duda real
- si una lectura no cambia la decisión siguiente, no era necesaria

## Qué no se lee por defecto

- \`{{featureHistoryPath}}\`
- \`{{historyPath}}\`
- memoria completa
- specs completas de otras features
`;

const SCAFFOLD_EXECUTION_ENGINE_DOC_CONTENT = `# Execution Engine

Define cómo se ejecutan tools y comandos.

## Principios

- seguridad antes que conveniencia
- resultados estructurados antes que texto libre
- timeouts explícitos
- retries limitados
- si el output no cambia, no seguir insistiendo

## Retry policy v1

- máximo \`2\` reintentos equivalentes
- si un retry falla igual, escala contexto o cambia estrategia
- si tras escalar sigue fallando, marca \`blocked\`

## Blocked policy v1

Marca \`blocked\` cuando:

- falta información esencial
- la verificación relevante sigue roja tras retries razonables
- una tool necesaria falla de forma persistente
- completar la task exige desviarse del spec aprobado

## Observation contract v1

- \`action\`: qué se intentó
- \`result\`: qué pasó
- \`error\`: qué falló, si aplica
- \`next_hint\`: qué probar después
`;

const SCAFFOLD_LOOP_CONTRACT_DOC_CONTENT = `# Loop Contract

Define el loop operativo canónico del arnés. El runtime MCP, \`status\`,
\`doctor\`, \`tui\`, prompts y el modo \`agent\` hablan el mismo loop.

## Loop contract v2

Dentro de una feature \`in_progress\`, el subloop es:

\`\`\`text
leader(plan)
-> implementer(execute attempt N)
-> verify
-> reviewer(review round N)
-> if fail/reject: analyze -> route_back -> implementer(attempt N+1)
-> if success: done
-> if budget exhausted / hard blocker / missing human input: blocked
\`\`\`

## Reglas

- el \`leader\` es el único controller del loop
- \`implementer\` ejecuta un solo intento por handoff
- \`reviewer\` evalúa un solo intento por handoff
- todo retry requiere \`strategy_delta\` explícito
- si se repite el mismo \`error_signature\` sin progreso real, el loop escala a \`blocked\`
- el gate humano sigue viviendo entre \`spec_ready\` e \`in_progress\`

## Estado persistido

Cada feature activa puede tener un loop file en:

\` .harness/metrics/loops/<feature_id>_<feature_slug>.json \`

Campos base:

- \`phase\`
- \`attempt_index\`
- \`review_round\`
- \`next_actor\`
- \`budgets\`
- \`last_error_signature\`
- \`last_strategy_delta\`
- \`no_progress_streak\`
- \`repeated_failure_streak\`
- \`events[]\`

## Budgets por defecto

- \`max_attempts_total = 3\`
- \`max_review_route_backs = 2\`
- \`max_no_progress_rounds = 2\`
- \`require_strategy_delta = true\`
- \`auto_route_back = true\`

## Arranque

- parte desde \`harness_status({ mode: "brief_minimal" })\`
- si hay feature activa, consulta \`harness_loop_status\`
- trae \`mem_context\` solo si hace falta contexto reusable
- abre archivos adicionales solo cuando el brief o el loop no alcanzan

## Cierre

- \`done\` o \`blocked\` cierran el loop y preservan el archivo para trazabilidad
- \`repair\` puede sembrar el loop inicial faltante
- \`repair\` no reescribe historial de intentos ni cierra features por su cuenta
`;

const SCAFFOLD_MEMORY_SYSTEM_DOC_CONTENT = `# Memory System

La memoria existe para recuperar solo contexto relevante, no para guardar toda
la sesión cruda.

## Tipos

- episódica: decisiones y eventos concretos
- semántica: hechos o restricciones estables del repo
- resumen de sesión: cierre compacto de una sesión
- observación puntual: detalle recuperable con \`mem_get_observation\`

## Tools

- \`mem_context\`: snapshot corto para arranque
- \`mem_search\`: búsqueda por relevancia
- \`mem_get_observation\`: detalle puntual
- \`mem_save\`: memoria estructurada (\`what/why/where/learned\`)
- \`mem_session_summary\`: cierre compacto de sesión

## Reglas

- no guardar raw tool spam
- usa \`topic_key\` si el tema evoluciona
- resume antes de duplicar
- si una memoria no ayuda a decidir algo futuro, no la guardes
- prefiere \`mem_session_summary\` para cierres y \`mem_save\` para decisiones puntuales
- no uses memoria como reemplazo de \`progress/\` o del spec actual

## Retrieval contract v1

1. \`mem_context\`
2. \`mem_search\` solo si falta contexto
3. \`mem_get_observation\` solo si hace falta detalle

## Save policy v1

- \`mem_save\`: una decisión, fix o hallazgo reusable
- \`mem_session_summary\`: resumen final de sesión
- \`topic_key\`: cuando actualizas el mismo tema en vez de abrir otro hilo

## Budget

- una memoria debe comprimir, no duplicar
- si el mismo tema ya existe y solo cambió un detalle, actualiza
- si una sesión deja muchas observaciones sueltas, resume y cierra
`;

const SCAFFOLD_ORCHESTRATION_DOC_CONTENT = `# Orchestration

Define cómo se reparten trabajo y responsabilidades entre agentes.

## Roles base

- \`leader\`: decide flujo, mueve estados y controla el loop
- \`spec_author\`: redacta spec
- \`implementer\`: ejecuta un solo intento por handoff
- \`reviewer\`: aprueba o rechaza un solo intento por handoff
- \`inbox_reader\`: convierte input crudo en features
- \`scoper\`: acota el scope de sesión

## Handoff contract v2

- \`spec_author\`
  - output: \`spec_ready -> specs/<name>/\`
- \`implementer\`
  - output: append a \`.harness/progress/impl_<name>.md\`
  - incluye \`## Attempt N\`, hipótesis, cambios, checks, resultado y \`strategy_delta\`
- \`reviewer\`
  - output: append a \`.harness/progress/review_<name>.md\`
  - incluye \`## Review N\`, veredicto y clasificación \`verification_failed | review_rejected | tool_failure | context_gap | external_blocker\`

## Reglas

- una sola feature en \`in_progress\`
- solo \`leader\` cambia \`{{featureListPath}}\`
- solo \`leader\` registra \`route_back\` y terminalidad del loop
- resultados largos viven en archivos, no en chat
- si un handoff no deja artifact, el handoff falló
`;

const SCAFFOLD_TOOL_CATALOG_DOC_CONTENT = `# Tool Catalog

Agrupa las tools del arnés por dominio y riesgo.

## workflow

- \`harness_status\`
- \`harness_loop_status\`
- \`harness_loop_event\`
- \`harness_update\`
- \`harness_add\`
- \`harness_log\`
- \`harness_metrics\`
- \`progress_set_plan\`
- \`progress_next_step\`
- \`history_append\`
- \`inbox_list\`
- \`inbox_consume\`

## memory

- \`mem_context\`
- \`mem_search\`
- \`mem_get_observation\`
- \`mem_save\`
- \`mem_session_summary\`

## repo

- \`read_file\`
- \`list_files\`
- \`search_repo\`
- \`write_file\`

## execution

- \`run_command\`

## resources / diagnostics

- \`harness://health\`
- \`harness://loop/active\`
- \`doctor\`
- \`help\`
- \`tui\` (estado, policy y métricas locales)

## Risk classes v1

- \`R0 read-only\`
- \`R1 local structured mutation\`
- \`R2 local content mutation\`
- \`R3 command execution / external side effect\`

## Regla

- empieza por \`R0\`
- sube de riesgo solo si hace falta
- si una acción \`R2\` o \`R3\` falla sin señal nueva, no la repitas en loop
`;

const SCAFFOLD_OBSERVATION_POLICY_DOC_CONTENT = `# Observation Policy

Define cómo se registra el resultado de una acción para que el loop de trabajo
pueda decidir el siguiente paso.

## Observation contract v1

Toda observación útil responde:

- \`action\`: qué se intentó
- \`result\`: qué pasó
- \`error\`: qué falló, si aplica
- \`next_hint\`: qué conviene intentar después

## Calidad mínima

- concreta, no narrativa
- basada en output real
- comparable con la observación anterior
- corta; si hace falta detalle, va al artifact correspondiente

## Retry guidance

- si la observación nueva es sustancialmente igual a la anterior, no seguir igual
- tras \`2\` retries equivalentes, cambia estrategia o escala contexto
- si el output no mejora tras escalar, marca \`blocked\`

## Dónde vive

- estado vivo: \`{{currentPath}}\`
- evidencia larga: \`.harness/progress/impl_<name>.md\`, \`.harness/progress/review_<name>.md\`
- memoria reusable: \`mem_save\` o \`mem_session_summary\`
`;

const SCAFFOLD_PLANNING_MODEL_DOC_CONTENT = `# Planning Model

El arnés soporta tres modos de planificación.

## 1. simple / reactive

Usa este modo cuando:

- el cambio es local y obvio
- no requiere spec
- una sola persona/agente puede cerrarlo de punta a punta

## 2. SDD

Usa este modo cuando la feature tiene \`sdd: true\`.

Flujo:

\`\`\`text
pending -> spec_ready -> aprobación humana -> in_progress
in_progress -> plan -> execute -> verify -> review -> route_back? -> done|blocked
\`\`\`

Úsalo cuando implementar mal cuesta más que escribir el spec.

## 3. orchestration

Usa este modo cuando hace falta dividir trabajo entre roles:

- \`leader\`
- \`spec_author\`
- \`implementer\`
- \`reviewer\`
- opcionalmente \`inbox_reader\` y \`scoper\`

## Regla de selección

- \`0\` criterios de SDD y cambio local: \`simple\`
- \`sdd: true\`: \`SDD\`
- múltiples roles, handoffs o coordinación explícita: \`orchestration\`

## Regla operativa

No mezclar modos sin decirlo. El modo activo debe ser evidente desde el estado
de la feature, el loop file y los artifacts que produce.
`;

const SCAFFOLD_BUDGETS_DOC_CONTENT = `# Budgets

Los budgets existen para evitar loops ruidosos, inflación de memoria y gasto
innecesario de tokens.

## Action budget v1

- máximo \`2\` retries equivalentes para la misma acción
- máximo \`1\` escalado de contexto antes de decidir
- si una acción \`R2\` o \`R3\` no da señal nueva tras retries razonables, parar
- si el trabajo real requiere más intentos, documenta por qué en \`progress/\`

## Memory budget v1

- una memoria nueva debe comprimir o consolidar
- si el mismo tema ya existe, usar \`topic_key\` y actualizar
- preferir \`mem_session_summary\` al cierre en vez de muchas observaciones sueltas
- no convertir memoria en bitácora cruda del trabajo

## Context budget v1

- arranca con \`brief\`
- sube a \`summary\` o \`full\` solo si la siguiente decisión lo exige
- no abras historial, diseño o memoria larga “por si acaso”
`;

const SCAFFOLD_CONTRACT_VERSIONS_DOC_CONTENT = `# Contract Versions

Versiona los contratos del arnés para evitar drift entre docs, scaffold y
prompts.

## Versiones actuales

- \`startup contract v2\`
- \`handoff contract v2\`
- \`loop contract v2\`
- \`observation contract v1\`
- \`retrieval contract v1\`
- \`retry policy v1\`
- \`blocked policy v1\`
- \`risk classes v1\`

## Regla

Si cambias un contrato de forma incompatible:

1. sube la versión
2. actualiza docs relacionadas
3. actualiza \`src/init.ts\`
4. actualiza \`smoke\` y \`doctor\` si aplica
`;

const SCAFFOLD_FRONTEND_ADAPTERS_DOC_CONTENT = `# Frontend Adapters

Describe qué parte del arnés es común y qué parte depende del cliente.

## Core común

- layout en \`.harness/\` y \`.harness-docs/\`
- \`startup_brief\`
- \`harness_loop_status\` cuando hay feature activa
- \`mem_context\`
- artifacts en \`specs/\` y \`.harness/progress/\`
- contracts versionados del arnés

## Claude

- usa \`CLAUDE.md\`
- roles en \`.claude/agents/\`
- comando corto en \`.claude/commands/harness.md\`

## Codex

- usa \`CODEX.md\`
- mismo flujo central del \`leader\`
- adapta tono/herramientas al runtime Codex

## Copilot

- usa \`.github/copilot-instructions.md\`
- prompts en \`.github/prompts/\`
- mismas transiciones y artifacts que Claude/Codex

## OpenCode

- usa \`.opencode/opencode.json\`
- comando corto en \`.opencode/commands/harness.md\`
- puede usar MCP e instructions del repo
- puede mapear permisos por tool o wildcard
- puede usar agents/subagents según frontend
- billed tokens del provider pueden o no estar expuestos al arnés

## Capability matrix

- MCP: Claude / Codex / Copilot / OpenCode = sí
- startup contract del arnés: sí
- loop contract del arnés: sí
- permission policy local del harness: sí
- metrics de tokens facturados por provider: depende del frontend
`;

const SCAFFOLD_CHECKPOINTS_CONTENT = `# CHECKPOINTS

Un cambio está realmente listo solo si:

- la verificación ejecutable relevante del repo pasó
- requirements observables tienen test automatizado o excepción justificada
- \`tasks.md\` quedó consistente con el estado real
- \`progress/impl_<feature>.md\` existe con trazabilidad \`R<n> -> verificación\`
- \`progress/review_<feature>.md\` existe con checklist y veredicto
- \`{{featureListPath}}\`, \`{{currentPath}}\` y \`{{historyPath}}\` reflejan el estado real
- README/docs quedaron actualizados o se documentó por qué no aplica
- Si el cambio es release-facing, \`CHANGELOG.md\` quedó alineado o se documentó por qué no aplica
`;

const SCAFFOLD_INBOX_README_TEMPLATE = `# inbox/

Carpeta para depositar requerimientos en bruto. El agente \`inbox_reader\` los
procesa y los convierte en features estructuradas.

## Uso

1. Crea un archivo \`.md\` por proyecto o bloque de requerimientos.
2. Usa frontmatter opcional para indicar \`scope\`:

\`\`\`markdown
---
scope: nombre-proyecto
---
# Requerimientos
- El sistema debe hacer X
- Cuando Y, el sistema debe hacer Z
\`\`\`

3. Pide al leader: **"procesa el inbox"**.
4. Los archivos procesados se mueven a \`{{inboxProcessedDir}}/\`.
`;

const SCAFFOLD_CLAUDE_MD_TEMPLATE = `# Instrucciones para Claude

Actúas por defecto como \`leader\`.

## Reglas duras

- No saltes SDD cuando la feature tenga \`"sdd": true\`.
- No saltes la aprobación humana entre \`spec_ready\` e \`in_progress\`.
- No declares \`done\` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y \`CHANGELOG.md\` alineado cuando el cambio sea release-facing.
- No pongas resultados largos en chat si deben quedar en archivos de \`specs/\`
  o \`{{historyPath}}\` / \`{{currentPath}}\`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama \`harness_status\` con \`mode: "brief_minimal"\` y usa \`startup_brief\` como snapshot inicial.
2. Si hay feature activa, llama \`harness_loop_status\` y toma \`phase\`, \`attempt_index\`, \`review_round\`, \`next_actor\` y budgets como estado vivo.
3. Si la tool no quedó cargada, usa \`arufheim-harness status --brief-minimal --json\` como fallback y confirma \`repo_path\`.
4. Si acabas de cambiar bindings o de abrir el repo, recarga el cliente y vuelve a intentar \`harness_status\` antes de mutar estado.
5. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
6. Lee solo los archivos mínimos que falten para el caso actual.
7. Aplica el flujo definido en \`.claude/agents/leader.md\`

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa \`arufheim-harness simulate --flow <startup|activation|loop|triage> --json\`.

## Loop en \`in_progress\`

- \`leader\` controla \`plan -> execute -> verify -> review -> analyze -> route_back\`.
- Si \`verify\` o \`review\` fallan, el route-back es automático dentro de budgets; el humano entra solo en gates existentes o bloqueos reales.
- No repitas un retry equivalente sin \`strategy_delta\`.
`;

const SCAFFOLD_CODEX_MD_TEMPLATE = `# Instrucciones para Codex

Actúas por defecto como \`leader\`.

## Reglas duras

- No saltes SDD cuando la feature tenga \`"sdd": true\`.
- No saltes la aprobación humana entre \`spec_ready\` e \`in_progress\`.
- No declares \`done\` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y \`CHANGELOG.md\` alineado cuando el cambio sea release-facing.
- No pongas resultados largos en chat si deben quedar en archivos de \`specs/\`
  o \`{{historyPath}}\` / \`{{currentPath}}\`.

## Cuándo usar SDD

Si implementar mal la feature cuesta más que escribir el spec, usa SDD.

Disparadores fuertes:

- seguridad o boundaries
- tool, command o resource nueva
- cambio de contrato, estado o flujo
- cambio multiarchivo con comportamiento observable

Si dudas, revisa \`.harness-docs/specs.md\`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama \`harness_status\` con \`mode: "brief_minimal"\` y usa \`startup_brief\` como snapshot inicial.
2. Si hay feature activa, llama \`harness_loop_status\` y toma \`phase\`, \`attempt_index\`, \`review_round\`, \`next_actor\` y budgets como estado vivo.
3. Si la tool no existe en la sesión, usa \`arufheim-harness status --brief-minimal --json\` como fallback operativo y confirma \`repo_path\`.
4. Si acabas de cambiar bindings repo-scoped, reabre el repo o inicia una sesión nueva para que Codex recargue \`.codex/config.toml\`.
5. Verifica que \`repo_path\` y \`config_scope\` apuntan al repo esperado antes de mutar estado.
6. Ejecuta \`./init.sh\`.
7. Lee solo los archivos mínimos que falten para el caso actual.
8. Aplica el flujo definido en \`AGENTS.md\`.

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa \`arufheim-harness simulate --flow <startup|activation|loop|triage> --json\`.

## Loop en \`in_progress\`

- \`leader\` controla \`plan -> execute -> verify -> review -> analyze -> route_back\`.
- Si \`verify\` o \`review\` fallan, el route-back es automático dentro de budgets; el humano entra solo en gates existentes o bloqueos reales.
- No repitas un retry equivalente sin \`strategy_delta\`.

## Cierre

- Si la feature quedó \`done\`, actualiza backlog activo y archívala.
- Si la sesión dejó cambios o decisiones útiles, añade resumen a \`{{historyPath}}\`.
- No registres sesiones sin efecto ni exploración descartable.
`;

const SCAFFOLD_COPILOT_INSTRUCTIONS_TEMPLATE = `# Copilot Instructions — harness

Actúas por defecto como \`leader\`.

## Reglas duras

- No saltes SDD cuando la feature tenga \`"sdd": true\`.
- No saltes la aprobación humana entre \`spec_ready\` e \`in_progress\`.
- No declares \`done\` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y \`CHANGELOG.md\` alineado cuando el cambio sea release-facing.
- No pongas resultados largos en chat si deben quedar en \`specs/\` o
  \`{{historyPath}}\` / \`{{currentPath}}\`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_minimal"\` y usa \`startup_brief\` como snapshot inicial.
2. Si hay feature activa, llama \`mcp_arufheim-harness_harness_loop_status\`.
3. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
4. Lee solo los archivos mínimos que falten para el caso actual.
5. Aplica el flujo definido en \`.github/prompts/leader.prompt.md\`.
`;

const SCAFFOLD_CLAUDE_COMMAND_TEMPLATE = `# Harness

## Arranque

1. Llama \`harness_status\` con \`mode: "brief_minimal"\` y usa \`startup_brief\` como snapshot inicial.
2. Si hay feature activa, llama \`harness_loop_status\` y resume fase, intento y budget restante.
3. Si la tool no cargó, usa \`arufheim-harness status --brief-minimal --json\` como fallback y confirma \`repo_path\`.
4. Si acabas de cambiar bindings o de abrir el repo, recarga el cliente y vuelve a intentar \`harness_status\` antes de mutar estado.
5. Si hay archivos nuevos en \`{{inboxDir}}/\`, procésalos antes del flujo normal.
6. Lee solo los archivos mínimos que falten para el caso actual.
7. Lee \`.harness-docs/verification.md\`.

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa \`arufheim-harness simulate --flow <startup|activation|loop|triage> --json\`.

Resume en pocas líneas: feature activa, próximo paso, inbox pendiente y bloqueo
si existe.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Flujo

- Si la feature tiene \`"sdd": true\`, sigue
  \`pending -> spec_ready -> aprobación humana -> in_progress\`, y dentro de \`in_progress\`
  sigue \`plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked\`.
- Una sola feature puede estar en \`in_progress\`.
- No declares \`done\` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y \`CHANGELOG.md\` alineado cuando el cambio sea release-facing.
- Si te bloqueas, deja el estado en \`{{currentPath}}\` antes de cerrar.
`;

const SCAFFOLD_OPENCODE_COMMAND_TEMPLATE = `# Harness

Arranque de sesión del repo:

1. Llama \`harness_status\` con \`mode: "brief_minimal"\` y usa \`startup_brief\` como snapshot inicial.
2. Si la feature activa existe, llama \`harness_loop_status\` antes de abrir más archivos.
3. Si la tool no cargó, usa \`arufheim-harness status --brief-minimal --json\` como fallback y confirma \`repo_path\`.
4. Si acabas de cambiar bindings o de abrir el repo, recarga el cliente y vuelve a intentar \`harness_status\` antes de mutar estado.
5. Si la feature activa existe, trae \`mem_context\` compacto antes de abrir más archivos.
6. Lee solo los archivos mínimos que falten para el caso actual.

Si necesitas estimar costo local del startup, loop o triage sin tocar métricas reales, usa \`arufheim-harness simulate --flow <startup|activation|loop|triage> --json\`.

Resumen corto esperado:

- feature activa
- próximo paso
- inbox pendiente
- bloqueo, si existe

Reglas:

- no saltes SDD cuando la feature tenga \`"sdd": true\`
- si la feature está \`in_progress\`, sigue el loop \`plan -> execute -> verify -> review -> analyze -> route_back\`
- no declares \`done\` sin verificación ejecutable, README/docs alineados cuando cambie el uso o comportamiento visible, y \`CHANGELOG.md\` alineado cuando el cambio sea release-facing
- si te bloqueas, deja el motivo en \`{{currentPath}}\`
`;

const LEGACY_SCAFFOLD_AGENTS_MD_TEMPLATE = `# AGENTS.md

Mapa operativo del repo.

## Arranque

1. Corre \`./init.sh\`.
2. Lee \`{{currentPath}}\`.
3. Lee \`{{featureListPath}}\`.
4. Lee \`{{progressReadmePath}}\` solo si vas a tocar el flujo de sesión.
5. Si la feature activa tiene \`"sdd": true\`, lee \`.harness-docs/specs.md\`.
6. Si estás decidiendo si una feature nueva usa SDD, lee \`.harness-docs/specs_policy.md\`.

## Leer solo si hace falta

- \`{{featureHistoryPath}}\`: contexto histórico
- \`{{historyPath}}\`: sesiones anteriores
- \`.harness/metrics/loops/\`: estado vivo y trazabilidad del loop por feature
- \`specs/<feature>/\`: implementación SDD
- \`.harness-docs/architecture.md\`: diseño
- \`.harness-docs/conventions.md\`: edición/código
- \`.harness-docs/verification.md\`: cierre
- \`.harness-docs/model_interface.md\`, \`.harness-docs/context_manager.md\`, \`.harness-docs/execution_engine.md\`, \`.harness-docs/memory_system.md\`, \`.harness-docs/orchestration.md\`, \`.harness-docs/tool_catalog.md\`, \`.harness-docs/observation_policy.md\`, \`.harness-docs/planning_model.md\`, \`.harness-docs/loop_contract.md\`: solo si cambias el propio arnés
- \`CHECKPOINTS.md\`: auto-review
- \`{{inboxDir}}/\`: input nuevo
- \`.claude/agents/\`, \`.github/prompts/\`, \`CLAUDE.md\`, \`CODEX.md\`: orquestación

## Reglas duras

- Una sola feature en \`in_progress\`.
- No cierres nada sin \`./init.sh\` verde.
- Toda feature con \`"sdd": true\` pasa por \`pending -> spec_ready -> aprobación humana -> in_progress -> done\`.
- Dentro de \`in_progress\`, el trabajo sigue \`plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked\`.
- Todo retry requiere \`strategy_delta\` explícito.
- Antes de declarar \`done\`, corre la verificación relevante del repo y actualiza README/docs si cambió el uso o comportamiento visible.
- Si el cambio es release-facing, actualiza \`CHANGELOG.md\` o deja constancia explícita de por qué no aplica.
- No inventes estado: actualiza \`{{currentPath}}\`.
- No rompas la plantilla de \`{{currentPath}}\`.
- No escribas logs arbitrarios a \`stdout\`.
- Si te bloqueas, deja evidencia en \`{{currentPath}}\`.

## Flujo

\`\`\`text
[inbox_reader] -> pending
[scoper] -> filtra scope de sesión
pending -> [spec_author] -> spec_ready -> HUMANO -> in_progress
in_progress -> leader(plan) -> implementer(execute) -> verify -> reviewer(review) -> analyze -> route_back -> done|blocked
\`\`\`

\`inbox_reader\` y \`scoper\` son opcionales. SDD es obligatorio para features con \`"sdd": true\`.

## Cierre

1. Corre la verificación estándar del repo o la mínima relevante y deja evidencia
2. Si cambió el uso o comportamiento visible, actualiza README/docs o deja constancia de por qué no aplica
3. Si el cambio es release-facing, actualiza \`CHANGELOG.md\` o deja constancia de por qué no aplica
4. \`./init.sh\`
5. Si la feature quedó \`done\`, actualiza backlog activo y archívala en \`{{featureHistoryPath}}\`
6. Si la sesión dejó cambios o decisiones útiles, añade resumen a \`{{historyPath}}\`
7. Limpia \`{{currentPath}}\`
8. Conserva \`explore_*.md\`, \`impl_*.md\`, \`review_*.md\`, \`spec_*.md\`
`;

const AGENTS_MANAGED_SECTION_TEMPLATE = `${AGENTS_MANAGED_START_MARKER}
${AGENTS_VERSION_MARKER}

## Harness Runtime (managed)

Este bloque lo mantiene el arnés. Puedes agregar instrucciones del repo fuera de esta sección; \`setup --update\` y \`repair\` solo regeneran este bloque.

### Arranque

1. Corre \`./init.sh\`.
2. Lee \`{{currentPath}}\`.
3. Lee \`{{featureListPath}}\`.
4. Lee \`{{progressReadmePath}}\` solo si vas a tocar el flujo de sesión.
5. Si la feature activa tiene \`"sdd": true\`, lee \`.harness-docs/specs.md\`.
6. Si estás decidiendo si una feature nueva usa SDD, lee \`.harness-docs/specs_policy.md\`.

### Reglas duras

- Una sola feature en \`in_progress\`.
- No cierres nada sin \`./init.sh\` verde.
- Toda feature con \`"sdd": true\` pasa por \`pending -> spec_ready -> aprobación humana -> in_progress -> done\`.
- Dentro de \`in_progress\`, el trabajo sigue \`plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked\`.
- Todo retry requiere \`strategy_delta\` explícito.
- Antes de declarar \`done\`, corre la verificación relevante del repo y actualiza README/docs si cambió el uso o comportamiento visible.
- Si el cambio es release-facing, actualiza \`CHANGELOG.md\` o deja constancia explícita de por qué no aplica.
- No inventes estado: actualiza \`{{currentPath}}\`.
- No rompas la plantilla de \`{{currentPath}}\`.
- Si te bloqueas, deja evidencia en \`{{currentPath}}\`.

### Contexto adicional

- \`{{featureHistoryPath}}\`: contexto histórico
- \`{{historyPath}}\`: sesiones anteriores
- \`.harness/metrics/loops/\`: estado vivo y trazabilidad del loop por feature
- \`specs/<feature>/\`: implementación SDD
- \`CHECKPOINTS.md\`: auto-review
- \`{{inboxDir}}/\`: input nuevo
- \`.claude/agents/\`, \`.github/prompts/\`, \`CLAUDE.md\`, \`CODEX.md\`: orquestación si esos adapters existen en este repo

### Cierre

1. Corre la verificación estándar del repo o la mínima relevante y deja evidencia
2. Si cambió el uso o comportamiento visible, actualiza README/docs o deja constancia de por qué no aplica
3. Si el cambio es release-facing, actualiza \`CHANGELOG.md\` o deja constancia de por qué no aplica
4. \`./init.sh\`
5. Si la feature quedó \`done\`, actualiza backlog activo y archívala en \`{{featureHistoryPath}}\`
6. Si la sesión dejó cambios o decisiones útiles, añade resumen a \`{{historyPath}}\`
7. Limpia \`{{currentPath}}\`
${AGENTS_MANAGED_END_MARKER}`;

const SCAFFOLD_AGENTS_MD_TEMPLATE = `# AGENTS.md

Mapa operativo del repo.

${AGENTS_MANAGED_SECTION_TEMPLATE}
`;

const SCAFFOLD_REPO_INIT_SH = `#!/usr/bin/env bash
set -euo pipefail

if [[ -n "\${ARUFHEIM_HARNESS_ENTRY:-}" ]]; then
  node "$ARUFHEIM_HARNESS_ENTRY" doctor --repo-path .
  exit $?
fi

if command -v arufheim-harness >/dev/null 2>&1; then
  arufheim-harness doctor --repo-path .
  exit $?
fi

if command -v npx >/dev/null 2>&1; then
  npx --yes arufheim-harness doctor --repo-path .
  exit $?
fi

echo "[FAIL] arufheim-harness no está disponible en PATH y npx tampoco existe." >&2
exit 1
`;

const SCAFFOLD_LEADER_PROMPT_TEMPLATE = `---
agent: leader
description: Orquestador. Coordina el flujo SDD del repo y delega el trabajo. NUNCA implementa código directamente.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_run_command
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
  - mcp_arufheim-harness_harness_loop_status
  - mcp_arufheim-harness_harness_loop_event
  - mcp_arufheim-harness_harness_update
  - mcp_arufheim-harness_harness_add
  - mcp_arufheim-harness_harness_log
  - mcp_arufheim-harness_progress_set_plan
  - mcp_arufheim-harness_progress_next_step
  - mcp_arufheim-harness_history_append
  - mcp_arufheim-harness_mem_save
  - mcp_arufheim-harness_mem_search
---

<!-- harness-agents-v5 -->

# Agente Líder

Orquestas. No implementas código.

## Protocolo de arranque

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_minimal"\` y usa \`startup_brief\` como snapshot inicial.
2. Si hay feature activa, llama \`mcp_arufheim-harness_harness_loop_status\`.
3. Llama \`mcp_arufheim-harness_mem_context\`.
4. Si falta contexto, lee solo lo mínimo.
5. Si hay input nuevo en \`{{inboxDir}}/\`, considera \`inbox_reader\`.

## Flujo SDD

\`\`\`text
pending -> [spec_author] -> spec_ready -> HUMANO APRUEBA -> in_progress
in_progress -> plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked
\`\`\`

- \`pending\`: lanza \`spec_author\`; si termina bien, pasa a \`spec_ready\` y paras.
- \`spec_ready\` + aprobación humana: pasa a \`in_progress\`, inicializa el loop y arranca en \`plan\`.
- \`plan\`: define \`strategy_delta\` y prepara el siguiente intento.
- \`execute\`: lanza \`implementer\` para un solo intento.
- \`verify\`: exige verificación relevante + README/docs si aplica + CHANGELOG si el cambio es release-facing.
- \`review\`: lanza \`reviewer\`; si rechaza o falla, pasa a \`analyze\`.
- \`analyze\`: si hay retry válido, registra route-back; si no, pasa a \`blocked\`.
- \`spec_ready\` sin aprobación: no continúas.
- \`in_progress\`: reanuda mirando \`{{currentPath}}\` y \`progress/\`.
- \`blocked\`: deja motivo en \`{{currentPath}}\` y paras.

## Reglas duras

- Una sola feature por sesión.
- Solo tú cambias \`{{featureListPath}}\`.
- Solo tú registras \`harness_loop_event\` y cierras el loop.
- No saltas aprobación humana entre \`spec_ready\` e \`in_progress\`.
- No permites retries equivalentes sin \`strategy_delta\`.
- No aceptas resultados largos en chat; van a archivos.
`;

const SCAFFOLD_IMPLEMENTER_PROMPT_TEMPLATE = `---
agent: implementer
description: Trabajador. Implementa una sola feature según su spec aprobado. Escribe código, verificación y evidencia de trazabilidad.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_run_command
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
  - mcp_arufheim-harness_harness_loop_status
  - mcp_arufheim-harness_harness_log
  - mcp_arufheim-harness_progress_set_plan
  - mcp_arufheim-harness_progress_next_step
  - mcp_arufheim-harness_mem_save
  - mcp_arufheim-harness_mem_search
---

<!-- harness-agents-v5 -->

# Agente Implementador

Implementas exactamente una feature aprobada desde \`specs/<name>/\`.

## Precondiciones

- La feature está en \`in_progress\` en \`{{featureListPath}}\`.
- Existe exactamente una feature en \`in_progress\`.
- Existen \`requirements.md\`, \`design.md\`, \`tasks.md\` y \`spec_summary.md\` en \`specs/<name>/\`.
- Si falla algo, paras y dejas evidencia en \`.harness/progress/impl_<name>.md\`.

## Reglas duras

- No cambias \`{{featureListPath}}\`. El líder es el único que mueve estados.
- No inventas requirements ni decisiones fuera del spec aprobado.
- No reviertes cambios ajenos.
- No marcas una task \`[x]\` hasta verificarla.
- Toda requirement observable \`R<n>\` debe quedar cubierta por test automatizado concreto.
- Si una task no puede completarse sin desviarte del spec, paras y reportas.

## Protocolo

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_minimal"\`.
2. Llama \`mcp_arufheim-harness_harness_loop_status\` para conocer \`Attempt N\`, \`strategy_delta\` previo y budget restante.
3. Lee \`.harness-docs/architecture.md\`, \`.harness-docs/conventions.md\`, \`.harness-docs/specs.md\`, \`.harness-docs/verification.md\`.
4. Lee \`specs/<name>/spec_summary.md\` primero.
5. Lee \`requirements.md\` y \`tasks.md\`; abre \`design.md\` solo si hace falta.
6. Actualiza \`{{currentPath}}\`.
7. Ejecuta \`tasks.md\` en orden.

Para cada task \`T<n>\`:

1. Implementa el cambio pedido.
2. Añade o ajusta test si cambia comportamiento observable.
3. Si cambia el uso o comportamiento visible, actualiza README/docs o documenta por qué no aplica.
4. Si el cambio es release-facing, actualiza \`CHANGELOG.md\` o documenta por qué no aplica.
5. Si no corresponde test, documenta verificación y motivo.
6. Corre la verificación mínima relevante.
7. Marca \`[x] T<n>\`.
8. Actualiza \`## Bitácora\` y \`## Próximo paso\`.

## Artifact del intento

Append a \`.harness/progress/impl_<name>.md\` con:

- \`## Attempt N\`
- hipótesis
- cambios
- checks ejecutados
- resultado
- \`strategy_delta\` aplicado

## Verificación final

Corre la verificación estándar del repo. Si falla, documenta bloqueo y paras. Confirma también que README/docs quedaron alineados y que \`CHANGELOG.md\` quedó actualizado si el cambio es release-facing, o explica por qué no aplica.
`;

const SCAFFOLD_REVIEWER_PROMPT_TEMPLATE = `---
agent: reviewer
description: Revisor automático. Aprueba o rechaza el trabajo del implementador contra .harness-docs/, specs/<name>/ y CHECKPOINTS.md.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_run_command
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
  - mcp_arufheim-harness_harness_loop_status
  - mcp_arufheim-harness_mem_search
  - mcp_arufheim-harness_mem_context
---

<!-- harness-agents-v5 -->

# Agente Revisor

Apruebas o rechazas. No editas código ni mueves estados.

## Protocolo

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_minimal"\`.
2. Llama \`mcp_arufheim-harness_harness_loop_status\` para conocer \`Review N\`, \`Attempt N\` y budgets restantes.
3. Lee \`.harness-docs/architecture.md\`, \`.harness-docs/conventions.md\`, \`.harness-docs/specs.md\`, \`.harness-docs/verification.md\` y \`CHECKPOINTS.md\`.
4. Lee \`specs/<name>/spec_summary.md\` primero.
5. Abre \`requirements.md\` y \`tasks.md\`; abre \`design.md\` solo si hace falta.
6. Lee \`.harness/progress/impl_<name>.md\`.
7. Por cada \`R<n>\`, exige test automatizado concreto o excepción justificada con verificación ejecutable.
8. Comprueba que todas las tasks de \`tasks.md\` estén \`[x]\`, salvo justificación válida.
9. Revisa los archivos modificados contra \`.harness-docs/architecture.md\` y
   \`.harness-docs/conventions.md\`.
10. Si cambió el uso o comportamiento visible, exige README/docs actualizados o justificación explícita de no aplicación.
11. Si el cambio es release-facing, exige \`CHANGELOG.md\` actualizado o justificación explícita de no aplicación.
12. Corre la verificación estándar del repo.
13. Recorre \`CHECKPOINTS.md\` y registra cuáles se cumplen.
14. Emite veredicto y clasifica el rechazo si aplica.

## Artifact del review

Append a \`.harness/progress/review_<name>.md\` con:

- \`## Review N\`
- veredicto \`APPROVED\` o \`CHANGES_REQUESTED\`
- clasificación \`verification_failed | review_rejected | tool_failure | context_gap | external_blocker\`
`;

const SCAFFOLD_SPEC_AUTHOR_PROMPT_TEMPLATE = `---
agent: spec_author
description: Redacta specs Kiro-style (requirements/design/tasks) para una feature pending con "sdd": true. NUNCA escribe código de aplicación ni tests.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
  - mcp_arufheim-harness_mem_search
  - mcp_arufheim-harness_mem_context
---

<!-- harness-agents-v5 -->

# Agente Spec Author

Escribes spec para una sola feature \`pending\` con \`"sdd": true\`.

Artifacts:
- \`requirements.md\`
- \`design.md\`
- \`tasks.md\`
- \`spec_summary.md\`

## Protocolo

1. \`mcp_arufheim-harness_harness_status({ mode: "brief_minimal" })\`
2. \`mcp_arufheim-harness_mem_context\`
3. lee \`.harness-docs/architecture.md\`, \`.harness-docs/conventions.md\`, \`.harness-docs/specs.md\`
4. si falta contexto, lee \`{{featureListPath}}\`
5. crea \`specs/<name>/\`
6. escribe \`requirements.md\` en EARS; cada acceptance debe mapear a algún \`R<n>\`
7. mantén \`requirements.md\` compacto: una línea por \`R<n>\` salvo necesidad real
8. escribe \`design.md\` abriendo con \`Decision\`, \`Touch\`, \`Constraints\`, \`Verify\`
9. escribe \`tasks.md\` compacto: una línea por task, en orden, con referencias \`R<n>\`
10. escribe \`spec_summary.md\` en formato ultracorto:
   - \`Goal:\`
   - \`Touch:\`
   - \`Constraints:\`
   - \`Verify:\`
   - \`Tasks:\`
11. no implementas nada
`;

const SCAFFOLD_INBOX_READER_PROMPT_TEMPLATE = `---
agent: inbox_reader
description: Procesa archivos de requerimientos en .harness/inbox/ y los convierte en features en .harness/feature_list.json.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_search_repo
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_add
  - mcp_arufheim-harness_harness_update
  - mcp_arufheim-harness_inbox_list
  - mcp_arufheim-harness_inbox_consume
---

<!-- harness-agents-v5 -->

# Inbox Reader

Tu trabajo es convertir requerimientos en bruto (archivos en \`{{inboxDir}}/\`)
en features estructuradas.

## Proceso

1. Lee \`AGENTS.md\` y \`{{progressReadmePath}}\`.
2. Lista todos los archivos en \`{{inboxDir}}/\` (excluye
   \`{{inboxProcessedDir}}/\` y \`{{inboxReadmePath}}\`).
3. Por cada archivo:
   - extrae \`scope\`
   - identifica funcionalidades discretas
   - asigna \`id\` incremental desde el máximo de \`{{featureListPath}}\`
   - decide si requiere SDD
4. Añade features al array \`features\` de \`{{featureListPath}}\`.
5. Mueve el archivo a \`{{inboxProcessedDir}}/<archivo>\`.
6. Actualiza \`{{currentPath}}\` sin romper la plantilla.
`;

const SCAFFOLD_SCOPER_PROMPT_TEMPLATE = `---
agent: scoper
description: Filtra .harness/feature_list.json por proyecto/scope y define qué trabaja el agente en esta sesión.
tools:
  - mcp_arufheim-harness_read_file
  - mcp_arufheim-harness_list_files
  - mcp_arufheim-harness_write_file
  - mcp_arufheim-harness_harness_status
---

<!-- harness-agents-v5 -->

# Scoper

Tu trabajo es acotar el contexto de trabajo para una sesión.

## Proceso

1. Lee \`AGENTS.md\`, \`{{progressReadmePath}}\` y \`{{featureListPath}}\`.
2. Agrupa features por campo \`scope\`.
3. Presenta resumen al humano.
4. Espera elección.
5. Actualiza \`{{currentPath}}\` sin añadir headings nuevas.
6. Devuelve al leader la lista de ids a procesar.
`;

function featureListTemplate(repoPath: string): string {
  return (
    JSON.stringify(
      {
        project: path.basename(path.resolve(repoPath)) || "project",
        description: "Backlog SDD del repo.",
        rules: {
          one_feature_at_a_time: true,
          require_green_verification_to_close: true,
          require_approved_spec_to_implement: true,
          valid_status: [
            "pending",
            "spec_ready",
            "in_progress",
            "done",
            "blocked",
          ],
          sdd_required_when: 'feature has "sdd": true',
          scope_field: "opcional; usado por scoper para filtrar por proyecto",
        },
        features: [],
      },
      null,
      2,
    ) + "\n"
  );
}

function featureHistoryTemplate(): string {
  return (
    JSON.stringify(
      {
        archived_features: [],
      },
      null,
      2,
    ) + "\n"
  );
}

function progressReadmePathFor(workflowPaths: WorkflowPaths): string {
  return path.posix.join(
    path.posix.dirname(workflowPaths.currentPath),
    "README.md",
  );
}

function inboxReadmePathFor(workflowPaths: WorkflowPaths): string {
  return path.posix.join(workflowPaths.inboxDir, "README.md");
}

function renderWorkflowTemplate(
  template: string,
  workflowPaths: WorkflowPaths,
): string {
  const replacements: Array<[string, string]> = [
    ["{{featureListPath}}", workflowPaths.featureListPath],
    ["{{featureHistoryPath}}", workflowPaths.featureHistoryPath],
    ["{{currentPath}}", workflowPaths.currentPath],
    ["{{historyPath}}", workflowPaths.historyPath],
    ["{{progressReadmePath}}", progressReadmePathFor(workflowPaths)],
    ["{{inboxDir}}", workflowPaths.inboxDir],
    ["{{inboxProcessedDir}}", workflowPaths.inboxProcessedDir],
    ["{{inboxReadmePath}}", inboxReadmePathFor(workflowPaths)],
  ];

  let rendered = template;
  for (const [needle, value] of replacements) {
    rendered = rendered.split(needle).join(value);
  }
  return rendered;
}

export function renderManagedAgentsSection(
  workflowPaths: WorkflowPaths,
): string {
  return renderWorkflowTemplate(AGENTS_MANAGED_SECTION_TEMPLATE, workflowPaths);
}

function renderAgentsFile(workflowPaths: WorkflowPaths): string {
  return (
    renderWorkflowTemplate(SCAFFOLD_AGENTS_MD_TEMPLATE, workflowPaths).trimEnd() +
    "\n"
  );
}

function scaffoldGithubPrompts(
  workflowPaths: WorkflowPaths,
): Array<[string, string]> {
  return [
    [
      "leader.prompt.md",
      renderWorkflowTemplate(SCAFFOLD_LEADER_PROMPT_TEMPLATE, workflowPaths),
    ],
    [
      "implementer.prompt.md",
      renderWorkflowTemplate(
        SCAFFOLD_IMPLEMENTER_PROMPT_TEMPLATE,
        workflowPaths,
      ),
    ],
    [
      "reviewer.prompt.md",
      renderWorkflowTemplate(SCAFFOLD_REVIEWER_PROMPT_TEMPLATE, workflowPaths),
    ],
    [
      "spec_author.prompt.md",
      renderWorkflowTemplate(
        SCAFFOLD_SPEC_AUTHOR_PROMPT_TEMPLATE,
        workflowPaths,
      ),
    ],
    [
      "inbox_reader.prompt.md",
      renderWorkflowTemplate(
        SCAFFOLD_INBOX_READER_PROMPT_TEMPLATE,
        workflowPaths,
      ),
    ],
    [
      "scoper.prompt.md",
      renderWorkflowTemplate(SCAFFOLD_SCOPER_PROMPT_TEMPLATE, workflowPaths),
    ],
  ];
}

function promptBody(renderedPrompt: string): string {
  return renderedPrompt
    .replace(/^---[\s\S]*?---\n\n/, "")
    .replace(/^<!-- harness-agents-v\d+ -->\n\n/, "");
}

function scaffoldClaudeAgents(
  workflowPaths: WorkflowPaths,
): Array<[string, string]> {
  const prompts = {
    leader: renderWorkflowTemplate(
      SCAFFOLD_LEADER_PROMPT_TEMPLATE,
      workflowPaths,
    ),
    implementer: renderWorkflowTemplate(
      SCAFFOLD_IMPLEMENTER_PROMPT_TEMPLATE,
      workflowPaths,
    ),
    reviewer: renderWorkflowTemplate(
      SCAFFOLD_REVIEWER_PROMPT_TEMPLATE,
      workflowPaths,
    ),
    specAuthor: renderWorkflowTemplate(
      SCAFFOLD_SPEC_AUTHOR_PROMPT_TEMPLATE,
      workflowPaths,
    ),
    inboxReader: renderWorkflowTemplate(
      SCAFFOLD_INBOX_READER_PROMPT_TEMPLATE,
      workflowPaths,
    ),
    scoper: renderWorkflowTemplate(
      SCAFFOLD_SCOPER_PROMPT_TEMPLATE,
      workflowPaths,
    ),
  };

  return [
    [
      "leader.md",
      `---
name: leader
description: Orquestador. Coordina el flujo SDD del repo y delega el trabajo. NUNCA implementa código directamente.
tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

<!-- harness-agents-v5 -->

${promptBody(prompts.leader)}`,
    ],
    [
      "implementer.md",
      `---
name: implementer
description: Trabajador. Implementa una sola feature según su spec aprobado. Escribe código, verificación y evidencia de trazabilidad.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v5 -->

${promptBody(prompts.implementer)}`,
    ],
    [
      "reviewer.md",
      `---
name: reviewer
description: Revisor automático. Aprueba o rechaza el trabajo del implementador contra .harness-docs/, specs/<name>/ y CHECKPOINTS.md.
tools: Read, Write, Glob, Grep, Bash
---

<!-- harness-agents-v5 -->

${promptBody(prompts.reviewer)}`,
    ],
    [
      "spec_author.md",
      `---
name: spec_author
description: Redacta specs Kiro-style (requirements/design/tasks) para una feature pending con "sdd": true. NUNCA escribe código de aplicación ni tests.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v5 -->

${promptBody(prompts.specAuthor)}`,
    ],
    [
      "inbox_reader.md",
      `---
name: inbox_reader
description: Procesa archivos de requerimientos en .harness/inbox/ y los convierte en features en .harness/feature_list.json.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v5 -->

${promptBody(prompts.inboxReader)}`,
    ],
    [
      "scoper.md",
      `---
name: scoper
description: Filtra .harness/feature_list.json por proyecto/scope y define qué trabaja el agente en esta sesión.
tools: Read, Write, Edit, Glob, Grep
---

<!-- harness-agents-v5 -->

${promptBody(prompts.scoper)}`,
    ],
  ];
}

// ─── Rutas de config global por cliente MCP ──────────────────────────────────

export function getVSCodeGlobalMcpPath(): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library/Application Support/Code/User/mcp.json");
  }
  if (process.platform === "win32") {
    return path.join(process.env["APPDATA"] ?? home, "Code/User/mcp.json");
  }
  return path.join(home, ".config/Code/User/mcp.json");
}

export function getClaudeDesktopConfigPath(): string {
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

export function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), ".claude.json");
}

export function getCodexConfigPath(): string {
  return path.join(os.homedir(), ".codex", "config.toml");
}

// ─── JSONC parser mínimo (strip comments + trailing commas) ──────────────────

export function parseJsonc(text: string): unknown {
  const withoutComments = stripJsonComments(text);
  const withoutTrailingCommas = stripTrailingCommas(withoutComments);
  return JSON.parse(withoutTrailingCommas);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

class ManagedGlobalConfigError extends Error {
  readonly filePath: string;
  readonly label: string;
  readonly recoverable: boolean;

  constructor(
    label: string,
    filePath: string,
    detail: string,
    options: { recoverable: boolean; forceHint?: boolean },
  ) {
    super(
      options.forceHint
        ? `${label}: ${detail} (${filePath}). Corrígelo manualmente o usa --force-managed-global para que harness haga backup y regenere la entrada gestionada.`
        : `${label}: ${detail} (${filePath}).`,
    );
    this.name = "ManagedGlobalConfigError";
    this.label = label;
    this.filePath = filePath;
    this.recoverable = options.recoverable;
  }
}

function isManagedGlobalConfigError(
  error: unknown,
): error is ManagedGlobalConfigError {
  return error instanceof ManagedGlobalConfigError;
}

function globalConfigValidationError(
  label: string,
  filePath: string,
  detail: string,
): ManagedGlobalConfigError {
  return new ManagedGlobalConfigError(label, filePath, detail, {
    recoverable: true,
    forceHint: true,
  });
}

function globalConfigReadError(
  label: string,
  filePath: string,
  detail: string,
): ManagedGlobalConfigError {
  return new ManagedGlobalConfigError(label, filePath, detail, {
    recoverable: false,
  });
}

async function readOptionalJsoncConfig(
  filePath: string,
  label: string,
  fallback: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseJsonc(raw) as Record<string, unknown>;
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...fallback };
    }
    if (error instanceof SyntaxError) {
      throw globalConfigValidationError(
        label,
        filePath,
        "JSON/JSONC inválido o no parseable",
      );
    }
    if (isManagedGlobalConfigError(error)) {
      throw error;
    }
    const detail =
      error instanceof Error && error.message.length > 0
        ? `no se pudo leer el archivo (${error.message})`
        : "no se pudo leer el archivo";
    throw globalConfigReadError(label, filePath, detail);
  }
}

function isPlausibleTomlLine(line: string): boolean {
  return (
    line.length === 0 ||
    line.startsWith("#") ||
    /^\[[^\]]+\]$/.test(line) ||
    /^[A-Za-z0-9_.-]+\s*=/.test(line) ||
    /^[\]\},]/.test(line) ||
    /^["'{\[]/.test(line) ||
    /^[-+0-9]/.test(line) ||
    /^(true|false)\b/.test(line)
  );
}

function assertPlausibleTomlDocument(
  raw: string,
  filePath: string,
  label: string,
): void {
  const invalidLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => !isPlausibleTomlLine(line));
  if (invalidLine) {
    throw globalConfigValidationError(
      label,
      filePath,
      `TOML inválido o no parseable cerca de '${invalidLine}'`,
    );
  }
}

async function readOptionalCodexGlobalConfig(filePath: string): Promise<string> {
  try {
    const raw = await readFile(filePath, "utf8");
    assertPlausibleTomlDocument(raw, filePath, "Codex global");
    return raw;
  } catch (error) {
    if (isMissingFileError(error)) {
      return "";
    }
    if (isManagedGlobalConfigError(error)) {
      throw error;
    }
    const detail =
      error instanceof Error && error.message.length > 0
        ? `no se pudo leer el archivo (${error.message})`
        : "no se pudo leer el archivo";
    throw globalConfigReadError(
      "Codex global",
      filePath,
      detail,
    );
  }
}

// ─── Escritura a cada cliente ─────────────────────────────────────────────────

const VSCODE_GLOBAL_HARNESS_SERVER_ENTRY = {
  type: "stdio",
  command: "npx",
  args: [
    "arufheim-harness",
    "--repo-path",
    "${workspaceFolder}",
    "--client",
    "vscode",
  ],
};

const CLAUDE_DESKTOP_GLOBAL_HARNESS_SERVER_ENTRY = {
  command: "npx",
  args: ["arufheim-harness", "--repo-path", ".", "--client", "claude-desktop"],
};

const CLAUDE_CODE_GLOBAL_HARNESS_SERVER_ENTRY = {
  command: "npx",
  args: ["arufheim-harness", "--repo-path", ".", "--client", "claude-code"],
};

function renderCodexGlobalMcpBlock(): string {
  return [
    "[mcp_servers.arufheim-harness]",
    'command = "npx"',
    'args = ["--yes", "arufheim-harness", "--repo-path", ".", "--client", "codex"]',
    'cwd = "."',
    "",
  ].join("\n");
}

export interface ManagedGlobalWriteOptions {
  update?: boolean;
  forceManagedGlobal?: boolean;
  preparedConfigs?: Record<string, PreparedGlobalConfig>;
  recoveryBackups?: GlobalConfigBackupRecord[];
}

type ManagedGlobalWriter = (
  options?: ManagedGlobalWriteOptions,
) => Promise<void>;

function ensureManagedGlobalState(
  options: ManagedGlobalWriteOptions,
): Required<Pick<ManagedGlobalWriteOptions, "preparedConfigs" | "recoveryBackups">> {
  options.preparedConfigs ??= {};
  options.recoveryBackups ??= [];
  return {
    preparedConfigs: options.preparedConfigs,
    recoveryBackups: options.recoveryBackups,
  };
}

function formatGlobalBackupSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function backupInvalidGlobalConfig(
  filePath: string,
  label: string,
  options: ManagedGlobalWriteOptions,
): Promise<GlobalConfigBackupRecord> {
  const state = ensureManagedGlobalState(options);
  const existing = state.recoveryBackups.find(
    (backup) => backup.filePath === filePath,
  );
  if (existing) {
    return existing;
  }

  const backupPath = `${filePath}.arufheim-harness.invalid-backup.${formatGlobalBackupSuffix()}`;
  await copyFile(filePath, backupPath);
  const created = { label, filePath, backupPath };
  state.recoveryBackups.push(created);
  return created;
}

async function resolveManagedJsoncConfig(
  filePath: string,
  label: string,
  fallback: Record<string, unknown>,
  options: ManagedGlobalWriteOptions,
): Promise<Record<string, unknown>> {
  const state = ensureManagedGlobalState(options);
  const cached = state.preparedConfigs[filePath];
  if (cached?.kind === "jsonc") {
    return cached.value;
  }

  try {
    const config = await readOptionalJsoncConfig(filePath, label, fallback);
    state.preparedConfigs[filePath] = {
      kind: "jsonc",
      value: config,
    };
    return config;
  } catch (error) {
    if (
      isManagedGlobalConfigError(error) &&
      error.recoverable &&
      options.forceManagedGlobal
    ) {
      await backupInvalidGlobalConfig(filePath, label, options);
      const config = { ...fallback };
      state.preparedConfigs[filePath] = {
        kind: "jsonc",
        value: config,
      };
      return config;
    }
    throw error;
  }
}

async function resolveManagedCodexGlobalConfig(
  filePath: string,
  options: ManagedGlobalWriteOptions,
): Promise<string> {
  const state = ensureManagedGlobalState(options);
  const cached = state.preparedConfigs[filePath];
  if (cached?.kind === "toml") {
    return cached.value;
  }

  try {
    const raw = await readOptionalCodexGlobalConfig(filePath);
    state.preparedConfigs[filePath] = {
      kind: "toml",
      value: raw,
    };
    return raw;
  } catch (error) {
    if (
      isManagedGlobalConfigError(error) &&
      error.recoverable &&
      options.forceManagedGlobal
    ) {
      await backupInvalidGlobalConfig(filePath, "Codex global", options);
      state.preparedConfigs[filePath] = {
        kind: "toml",
        value: "",
      };
      return "";
    }
    throw error;
  }
}

async function addToVSCodeGlobal(
  options: ManagedGlobalWriteOptions = {},
): Promise<void> {
  const mcpPath = getVSCodeGlobalMcpPath();
  const config = await resolveManagedJsoncConfig(
    mcpPath,
    "VS Code global",
    { servers: {} },
    options,
  );

  const servers = (config["servers"] ?? {}) as Record<string, unknown>;
  const existed = Boolean(servers["arufheim-harness"]);
  if (existed && !options.update) {
    console.log(
      `  skip  VS Code global (harness ya configurado en ${mcpPath})`,
    );
    return;
  }

  servers["arufheim-harness"] = VSCODE_GLOBAL_HARNESS_SERVER_ENTRY;
  config["servers"] = servers;

  await mkdir(path.dirname(mcpPath), { recursive: true });
  await writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(
    `  ${existed ? "update" : "create"} VS Code global → ${mcpPath}`,
  );
}

async function addToClaudeDesktop(
  options: ManagedGlobalWriteOptions = {},
): Promise<void> {
  const cfgPath = getClaudeDesktopConfigPath();
  const config = await resolveManagedJsoncConfig(
    cfgPath,
    "Claude Desktop global",
    { mcpServers: {} },
    options,
  );

  const mcpServers = (config["mcpServers"] ?? {}) as Record<string, unknown>;
  const existed = Boolean(mcpServers["arufheim-harness"]);
  if (existed && !options.update) {
    console.log(
      `  skip  Claude Desktop (harness ya configurado en ${cfgPath})`,
    );
    return;
  }

  mcpServers["arufheim-harness"] = CLAUDE_DESKTOP_GLOBAL_HARNESS_SERVER_ENTRY;
  config["mcpServers"] = mcpServers;

  await mkdir(path.dirname(cfgPath), { recursive: true });
  await writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(
    `  ${existed ? "update" : "create"} Claude Desktop → ${cfgPath}`,
  );
}

async function addToClaudeCode(
  options: ManagedGlobalWriteOptions = {},
): Promise<void> {
  const cfgPath = getClaudeCodeConfigPath();
  const config = await resolveManagedJsoncConfig(
    cfgPath,
    "Claude Code global",
    {},
    options,
  );

  const mcpServers = (config["mcpServers"] ?? {}) as Record<string, unknown>;
  const existed = Boolean(mcpServers["arufheim-harness"]);
  if (existed && !options.update) {
    console.log(`  skip  Claude Code (harness ya configurado en ${cfgPath})`);
    return;
  }

  mcpServers["arufheim-harness"] = CLAUDE_CODE_GLOBAL_HARNESS_SERVER_ENTRY;
  config["mcpServers"] = mcpServers;

  await mkdir(path.dirname(cfgPath), { recursive: true });
  await writeFile(cfgPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(
    `  ${existed ? "update" : "create"} Claude Code → ${cfgPath}`,
  );
}

function upsertCodexHarnessBlock(raw: string): { text: string; existed: boolean } {
  const block = renderCodexGlobalMcpBlock();
  const sectionPattern =
    /^\[mcp_servers\.arufheim-harness\][\s\S]*?(?=^\[[^\]]+\]|\s*$)/m;

  if (sectionPattern.test(raw)) {
    const next = raw.replace(sectionPattern, block.trimEnd());
    return {
      text: next.endsWith("\n") ? next : `${next}\n`,
      existed: true,
    };
  }

  const prefix = raw.length > 0 && !raw.endsWith("\n") ? "\n" : "";
  return {
    text: `${raw}${prefix}${block}`,
    existed: false,
  };
}

async function addToCodex(
  options: ManagedGlobalWriteOptions = {},
): Promise<void> {
  const cfgPath = getCodexConfigPath();
  const raw = await resolveManagedCodexGlobalConfig(cfgPath, options);

  const hasSection = raw.includes("[mcp_servers.arufheim-harness]");
  if (hasSection && !options.update) {
    console.log(`  skip  Codex (harness ya configurado en ${cfgPath})`);
    return;
  }

  const next = upsertCodexHarnessBlock(raw);
  await mkdir(path.dirname(cfgPath), { recursive: true });
  await writeFile(cfgPath, next.text, "utf8");
  console.log(`  ${next.existed ? "update" : "create"} Codex → ${cfgPath}`);
}

// ─── Menú interactivo ─────────────────────────────────────────────────────────

const CLIENTS = [
  {
    id: "vscode" as const,
    label: "VS Code (global)",
    fn: addToVSCodeGlobal,
    path: getVSCodeGlobalMcpPath,
  },
  {
    id: "claude-desktop" as const,
    label: "Claude Desktop",
    fn: addToClaudeDesktop,
    path: getClaudeDesktopConfigPath,
  },
  {
    id: "claude-code" as const,
    label: "Claude Code",
    fn: addToClaudeCode,
    path: getClaudeCodeConfigPath,
  },
  { id: "codex" as const, label: "Codex", fn: addToCodex, path: getCodexConfigPath },
] as const;

async function validateGlobalClientConfigs(
  clientIds: GlobalClientId[],
  options: ManagedGlobalWriteOptions = {},
): Promise<void> {
  for (const clientId of clientIds) {
    if (clientId === "vscode") {
      await resolveManagedJsoncConfig(
        getVSCodeGlobalMcpPath(),
        "VS Code global",
        { servers: {} },
        options,
      );
      continue;
    }
    if (clientId === "claude-desktop") {
      await resolveManagedJsoncConfig(
        getClaudeDesktopConfigPath(),
        "Claude Desktop global",
        { mcpServers: {} },
        options,
      );
      continue;
    }
    if (clientId === "claude-code") {
      await resolveManagedJsoncConfig(
        getClaudeCodeConfigPath(),
        "Claude Code global",
        {},
        options,
      );
      continue;
    }
    if (clientId === "codex") {
      await resolveManagedCodexGlobalConfig(getCodexConfigPath(), options);
    }
  }
}

export function renderManagedGlobalRecoverySummary(
  backups: GlobalConfigBackupRecord[] | undefined,
): string[] {
  if (!backups || backups.length === 0) {
    return [];
  }

  return [
    `  recovered_backups: ${backups.length}`,
    ...backups.map(
      (backup) =>
        `  backup: ${backup.label} ${backup.filePath} -> ${backup.backupPath}`,
    ),
  ];
}

export function renderGlobalActivationSteps(
  clientIds: GlobalClientId[],
  options: {
    preferredRepoScopedClients?: Array<Extract<GlobalClientId, "claude-code" | "codex">>;
    repoPath?: string;
  } = {},
): string {
  const preferredRepoScopedClients = new Set(
    options.preferredRepoScopedClients ?? [],
  );
  const lines = ["", "activation", ""];
  if (clientIds.includes("vscode")) {
    lines.push(
      "  VS Code: verified — recarga la ventana, inicia `arufheim-harness` desde el panel MCP y confirma `repo_path`.",
    );
  }
  if (clientIds.includes("claude-desktop")) {
    lines.push(
      "  Claude Desktop: configured_needs_activation — reinicia la app y valida `repo_path` con `harness_status` antes de mutar estado.",
    );
  }
  if (clientIds.includes("claude-code")) {
    if (
      preferredRepoScopedClients.has("claude-code") &&
      options.repoPath
    ) {
      lines.push(
        `  Claude Code: verified — este repo ya quedó con binding repo-scoped en ${options.repoPath}/.mcp.json; úsalo como ruta preferente.`,
      );
    } else {
      lines.push(
        "  Claude Code: configured_needs_activation — reabre la sesión o el repo si cambiaste bindings y confirma `repo_path` al primer `harness_status`.",
      );
    }
  }
  if (clientIds.includes("codex")) {
    if (preferredRepoScopedClients.has("codex") && options.repoPath) {
      lines.push(
        `  Codex: verified — este repo ya quedó con binding repo-scoped en ${options.repoPath}/.codex/config.toml; úsalo como ruta preferente.`,
      );
    } else {
      lines.push(
        "  Codex: configured_needs_activation — reabre el repo si cambiaste bindings y confirma que el arranque usa el repo actual antes de mutar estado.",
      );
    }
  }
  lines.push(
    preferredRepoScopedClients.size > 0
      ? "  Manual check: solo aplica a clientes que sigan usando binding global no repo-scoped."
      : "  Manual check: si un cliente usa binding global no repo-scoped, valida `repo_path` explícitamente en ese frontend.",
  );
  lines.push("");
  return lines.join("\n");
}

export async function runInitGlobalWithClients(
  clientIds: GlobalClientId[],
  options: ManagedGlobalWriteOptions = {},
): Promise<void> {
  const selected = CLIENTS.filter((client) => clientIds.includes(client.id));

  if (selected.length === 0) {
    return;
  }

  await validateGlobalClientConfigs(
    selected.map((client) => client.id),
    options,
  );

  console.log("");
  for (const client of selected) {
    await client.fn(options);
  }
}

async function runInitGlobal(
  update = false,
  forceManagedGlobal = false,
): Promise<void> {
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
  const globalOptions: ManagedGlobalWriteOptions = {
    update,
    forceManagedGlobal,
  };
  if (choice === CLIENTS.length + 1) {
    await runInitGlobalWithClients(
      CLIENTS.map((client) => client.id),
      globalOptions,
    );
  } else {
    await runInitGlobalWithClients([CLIENTS[choice - 1].id], globalOptions);
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
    console.log("  Claude Desktop / Claude Code / Codex:");
    console.log("    1. Cierra y vuelve a abrir la app\n");
  }

  const selectedClientIds =
    choice === CLIENTS.length + 1
      ? CLIENTS.map((client) => client.id)
      : [CLIENTS[choice - 1].id];
  const recoveryLines = renderManagedGlobalRecoverySummary(
    globalOptions.recoveryBackups,
  );
  if (recoveryLines.length > 0) {
    console.log("");
    recoveryLines.forEach((line) => console.log(line));
  }
  console.log(renderGlobalActivationSteps(selectedClientIds));

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
  update?: boolean;
  forceManagedGlobal?: boolean;
  target?: InitTarget;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
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

async function writeExecutableIfAbsent(
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
  await writeFile(filePath, content, { encoding: "utf8", mode: 0o755 });
  await chmod(filePath, 0o755);
  console.log(`  create ${label}`);
}

function normalizeManagedFileContent(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

function isPermissionLikeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EACCES")
  );
}

async function writeManagedFile(
  filePath: string,
  content: string,
  label: string,
  update: boolean,
): Promise<void> {
  if (!(await fileExists(filePath))) {
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, "utf8");
    console.log(`  create ${label}`);
    return;
  }

  if (!update) {
    console.log(`  skip  ${label} (ya existe)`);
    return;
  }

  const current = await readFile(filePath, "utf8");
  if (
    normalizeManagedFileContent(current) ===
    normalizeManagedFileContent(content)
  ) {
    console.log(`  skip  ${label} (managed al día)`);
    return;
  }

  await writeFile(filePath, content, "utf8");
  console.log(`  [updated] ${label} — managed reconciliado`);
}

function expandManagedLocalClients(target: InitTarget): string[] {
  if (target === "all") {
    return [...ALL_LOCAL_CLIENTS];
  }

  return [target];
}

async function reconcileManagedScaffoldClients(
  repoPath: string,
  target: InitTarget,
): Promise<void> {
  const configAbs = path.join(repoPath, harness_CONFIG_NAME);

  try {
    const raw = await readFile(configAbs, "utf8");
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    const requested = expandManagedLocalClients(target);
    const current =
      typeof cfg.scaffold === "object" &&
      cfg.scaffold !== null &&
      Array.isArray((cfg.scaffold as { localClients?: unknown }).localClients)
        ? ((cfg.scaffold as { localClients: unknown[] }).localClients.filter(
            (value): value is string => typeof value === "string",
          ))
        : [];
    const mergedSource =
      target === "all" ? [...ALL_LOCAL_CLIENTS] : [...current, ...requested];
    const merged = Array.from(new Set(mergedSource)).sort((left, right) => {
      return ALL_LOCAL_CLIENTS.indexOf(left as (typeof ALL_LOCAL_CLIENTS)[number]) -
        ALL_LOCAL_CLIENTS.indexOf(right as (typeof ALL_LOCAL_CLIENTS)[number]);
    });
    const nextScaffold = {
      ...(typeof cfg.scaffold === "object" && cfg.scaffold !== null
        ? (cfg.scaffold as Record<string, unknown>)
        : {}),
      localClients: merged,
    };

    const next = {
      ...cfg,
      scaffold: nextScaffold,
    };

    if (JSON.stringify(cfg) === JSON.stringify(next)) {
      return;
    }

    await writeFile(configAbs, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(
      `  [updated] ${harness_CONFIG_NAME} — scaffold.localClients=${merged.join(",")}`,
    );
  } catch {
    // Si config no parsea, doctor lo señalará; setup no pisa config inválida.
  }
}

function renderLocalActivationMessage(target: InitTarget, update: boolean): string {
  if (update) {
    return "\n✓ Actualización completada.\n";
  }

  if (target === "codex") {
    return "\n✓ Listo. Reabre el repo o inicia una sesión nueva en Codex para recargar `.codex/config.toml`.\n";
  }
  if (target === "claude") {
    return "\n✓ Listo. Reabre el repo o la sesión en Claude Code para recargar `.mcp.json`.\n";
  }
  if (target === "opencode") {
    return "\n✓ Listo. Abre el repo en OpenCode y valida que el MCP quedó activo.\n";
  }
  if (target === "copilot") {
    return "\n✓ Listo. Abre el repo en VS Code para activar el MCP.\n";
  }

  return "\n✓ Listo. Abre o recarga el repo en el frontend que corresponda para activar el MCP.\n";
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

function normalizeAgentsContent(content: string): string {
  return content.replace(/\r\n/g, "\n").trim();
}

function replaceManagedAgentsSection(
  content: string,
  managedSection: string,
): string | null {
  const startIndex = content.indexOf(AGENTS_MANAGED_START_MARKER);
  const endIndex = content.indexOf(AGENTS_MANAGED_END_MARKER);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }

  const before = content.slice(0, startIndex).trimEnd();
  const after = content
    .slice(endIndex + AGENTS_MANAGED_END_MARKER.length)
    .trimStart();
  const parts = [before, managedSection, after].filter(
    (part) => part.length > 0,
  );
  return parts.join("\n\n").trimEnd() + "\n";
}

function looksLikeLegacyAgentsScaffold(
  content: string,
  workflowPaths: WorkflowPaths,
): boolean {
  const legacyScaffold = renderWorkflowTemplate(
    LEGACY_SCAFFOLD_AGENTS_MD_TEMPLATE,
    workflowPaths,
  );
  return normalizeAgentsContent(content) === normalizeAgentsContent(legacyScaffold);
}

async function ensureAgentsFile(
  filePath: string,
  workflowPaths: WorkflowPaths,
  update: boolean,
): Promise<void> {
  const renderedManagedSection = renderManagedAgentsSection(workflowPaths);
  const renderedFile = renderAgentsFile(workflowPaths);

  if (!(await fileExists(filePath))) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, renderedFile, "utf8");
    console.log(`  create ${AGENTS_MD_PATH}`);
    return;
  }

  if (!update) {
    console.log(`  skip  ${AGENTS_MD_PATH} (ya existe)`);
    return;
  }

  const current = await readFile(filePath, "utf8");
  if (current.trim().length === 0) {
    await writeFile(filePath, renderedFile, "utf8");
    console.log(`  [updated] ${AGENTS_MD_PATH} — regenerado`);
    return;
  }

  const replaced = replaceManagedAgentsSection(current, renderedManagedSection);
  if (replaced !== null) {
    if (normalizeAgentsContent(replaced) === normalizeAgentsContent(current)) {
      console.log(`  skip  ${AGENTS_MD_PATH} (bloque gestionado al día)`);
      return;
    }
    await writeFile(filePath, replaced, "utf8");
    console.log(`  [updated] ${AGENTS_MD_PATH} — bloque gestionado reconciliado`);
    return;
  }

  if (looksLikeLegacyAgentsScaffold(current, workflowPaths)) {
    await writeFile(filePath, renderedFile, "utf8");
    console.log(`  [updated] ${AGENTS_MD_PATH} — migrado a bloque gestionado`);
    return;
  }

  await writeFile(
    filePath,
    current.trimEnd() + "\n\n" + renderedManagedSection + "\n",
    "utf8",
  );
  console.log(`  patch ${AGENTS_MD_PATH} (bloque gestionado)`);
}

async function copyIfPresent(
  fromPath: string,
  toPath: string,
  label: string,
): Promise<void> {
  if (!(await fileExists(fromPath)) || (await fileExists(toPath))) {
    return;
  }
  await mkdir(path.dirname(toPath), { recursive: true });
  await copyFile(fromPath, toPath);
  console.log(`  migrate ${label}`);
}

async function copyDirContentsIfPresent(
  fromDir: string,
  toDir: string,
  label: string,
): Promise<void> {
  if (!(await pathExists(fromDir))) {
    return;
  }
  await mkdir(toDir, { recursive: true });
  const entries = await readdir(fromDir, { withFileTypes: true });
  for (const entry of entries) {
    const fromPath = path.join(fromDir, entry.name);
    const toPath = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirContentsIfPresent(fromPath, toPath, label);
      continue;
    }
    if (await fileExists(toPath)) {
      continue;
    }
    await copyFile(fromPath, toPath);
  }
  console.log(`  migrate ${label}`);
}

async function ensureVSCodeMcpServer(
  filePath: string,
  update: boolean,
): Promise<void> {
  if (!update || !(await fileExists(filePath))) {
    return;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = parseJsonc(raw) as {
      servers?: Record<string, unknown>;
    };
    const servers = parsed.servers ?? {};
    const next = {
      ...parsed,
      servers: {
        ...servers,
        "arufheim-harness": VSCODE_GLOBAL_HARNESS_SERVER_ENTRY,
      },
    };
    if (
      normalizeManagedFileContent(JSON.stringify(parsed, null, 2)) ===
      normalizeManagedFileContent(JSON.stringify(next, null, 2))
    ) {
      console.log(`  skip  ${VSCODE_MCP_PATH} (managed al día)`);
      return;
    }
    await writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(`  [updated] ${VSCODE_MCP_PATH} — arufheim-harness reconciliado`);
  } catch {
    // Si el archivo no es parseable, doctor lo señalará.
  }
}

async function ensureClaudeProjectMcpServer(
  filePath: string,
  update: boolean,
): Promise<void> {
  if (!update || !(await fileExists(filePath))) {
    return;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as {
      mcpServers?: Record<string, unknown>;
    };
    const mcpServers = parsed.mcpServers ?? {};
    const next = {
      ...parsed,
      mcpServers: {
        ...mcpServers,
        "arufheim-harness":
          DEFAULT_CLAUDE_PROJECT_MCP_JSON.mcpServers["arufheim-harness"],
      },
    };
    if (
      normalizeManagedFileContent(JSON.stringify(parsed, null, 2)) ===
      normalizeManagedFileContent(JSON.stringify(next, null, 2))
    ) {
      console.log(`  skip  ${CLAUDE_PROJECT_MCP_PATH} (managed al día)`);
      return;
    }
    await writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(`  [updated] ${CLAUDE_PROJECT_MCP_PATH} — arufheim-harness reconciliado`);
  } catch (error) {
    if (isPermissionLikeError(error)) {
      throw error;
    }
    // Si el archivo no es parseable, doctor lo señalará.
  }
}

function upsertCodexHarnessSection(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const header = "[mcp_servers.arufheim-harness]";
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) {
    const prefix = normalized.length > 0 && !normalized.endsWith("\n") ? "\n" : "";
    return `${normalized}${prefix}${renderCodexProjectConfigToml()}`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const before = lines.slice(0, start).join("\n").trimEnd();
  const after = lines.slice(end).join("\n").trimStart();
  const section = renderCodexProjectConfigToml().trimEnd();

  return [before, section, after].filter((part) => part.length > 0).join("\n\n") + "\n";
}

async function ensureCodexMcpServer(
  filePath: string,
  update: boolean,
): Promise<void> {
  if (!update || !(await fileExists(filePath))) {
    return;
  }

  const raw = await readFile(filePath, "utf8");
  const next = upsertCodexHarnessSection(raw);
  if (
    normalizeManagedFileContent(raw) ===
    normalizeManagedFileContent(next)
  ) {
    console.log(`  skip  ${CODEX_CONFIG_PATH} (managed al día)`);
    return;
  }
  await writeFile(filePath, next, "utf8");
  console.log(`  [updated] ${CODEX_CONFIG_PATH} — arufheim-harness reconciliado`);
}

async function ensureOpenCodeConfig(
  filePath: string,
  update: boolean,
): Promise<void> {
  if (!update || !(await fileExists(filePath))) {
    return;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as {
      mcp?: Record<string, unknown>;
      permission?: Record<string, unknown>;
    };
    const next = {
      ...parsed,
      mcp: {
        ...(parsed.mcp ?? {}),
        "arufheim-harness": DEFAULT_OPENCODE_JSON.mcp["arufheim-harness"],
      },
      permission: {
        ...(parsed.permission ?? {}),
        ...DEFAULT_OPENCODE_JSON.permission,
      },
    };
    if (
      normalizeManagedFileContent(JSON.stringify(parsed, null, 2)) ===
      normalizeManagedFileContent(JSON.stringify(next, null, 2))
    ) {
      console.log(`  skip  ${OPENCODE_CONFIG_PATH} (managed al día)`);
      return;
    }
    await writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(`  [updated] ${OPENCODE_CONFIG_PATH} — arufheim-harness reconciliado`);
  } catch (error) {
    if (isPermissionLikeError(error)) {
      throw error;
    }
    // Si el archivo no es parseable, doctor lo señalará.
  }
}

async function migrateLegacyRootLayout(repoPath: string): Promise<void> {
  const legacyFeatureListPath = path.join(repoPath, "feature_list.json");
  const hiddenFeatureListPath = path.join(
    repoPath,
    ".harness/feature_list.json",
  );
  if (await fileExists(legacyFeatureListPath)) {
    const raw = await readFile(legacyFeatureListPath, "utf8");
    const normalized = serializeFeatureList(parseFeatureListText(raw));
    if (!(await fileExists(hiddenFeatureListPath))) {
      await mkdir(path.dirname(hiddenFeatureListPath), { recursive: true });
      await writeFile(hiddenFeatureListPath, normalized, "utf8");
      console.log("  migrate feature_list.json -> .harness/feature_list.json");
    }
  }

  const legacyFeatureHistoryPath = path.join(repoPath, "feature_history.json");
  const hiddenFeatureHistoryPath = path.join(
    repoPath,
    ".harness/feature_history.json",
  );
  if (await fileExists(legacyFeatureHistoryPath)) {
    const raw = await readFile(legacyFeatureHistoryPath, "utf8");
    const normalized = serializeFeatureHistory(parseFeatureHistoryText(raw));
    if (!(await fileExists(hiddenFeatureHistoryPath))) {
      await mkdir(path.dirname(hiddenFeatureHistoryPath), { recursive: true });
      await writeFile(hiddenFeatureHistoryPath, normalized, "utf8");
      console.log(
        "  migrate feature_history.json -> .harness/feature_history.json",
      );
    }
  }

  await copyIfPresent(
    path.join(repoPath, "progress/README.md"),
    path.join(repoPath, ".harness/progress/README.md"),
    "progress/README.md -> .harness/progress/README.md",
  );
  await copyIfPresent(
    path.join(repoPath, "progress/current.md"),
    path.join(repoPath, ".harness/progress/current.md"),
    "progress/current.md -> .harness/progress/current.md",
  );
  await copyIfPresent(
    path.join(repoPath, "progress/history.md"),
    path.join(repoPath, ".harness/progress/history.md"),
    "progress/history.md -> .harness/progress/history.md",
  );
  await copyDirContentsIfPresent(
    path.join(repoPath, "inbox"),
    path.join(repoPath, ".harness/inbox"),
    "inbox/ -> .harness/inbox/",
  );

  const docNames = [
    "architecture.md",
    "conventions.md",
    "specs.md",
    "specs_policy.md",
    "verification.md",
    "model_interface.md",
    "context_manager.md",
    "execution_engine.md",
    "memory_system.md",
    "orchestration.md",
    "tool_catalog.md",
    "observation_policy.md",
    "planning_model.md",
    "budgets.md",
    "contract_versions.md",
    "frontend_adapters.md",
    "loop_contract.md",
  ];

  for (const docName of docNames) {
    await copyIfPresent(
      path.join(repoPath, "docs", docName),
      path.join(repoPath, ".harness-docs", docName),
      `docs/${docName} -> .harness-docs/${docName}`,
    );
  }
}

async function runInitLocal(
  repoPath: string,
  update = false,
  target: InitTarget = "all",
): Promise<void> {
  const verb = update ? "Actualizando" : "Inicializando";
  const targetLabel =
    target === "claude"
      ? " [Claude]"
      : target === "copilot"
        ? " [GitHub/Copilot]"
        : target === "opencode"
          ? " [OpenCode]"
          : target === "codex"
            ? " [Codex]"
          : "";
  console.log(`\n${verb} harness${targetLabel} en: ${repoPath}\n`);

  const writeInfra = true;
  const writeGithub = target === "all" || target === "copilot";
  const writeClaude = target === "all" || target === "claude";
  const writeOpenCode = target === "all" || target === "opencode";
  let workflowPaths = await resolveWorkflowPaths(repoPath);
  if (update && workflowPaths.layout === "root-legacy") {
    console.log("  detect legacy layout -> migrando a .harness/");
    await migrateLegacyRootLayout(repoPath);
    workflowPaths = await resolveWorkflowPaths(repoPath);
  }
  const progressReadmePath = progressReadmePathFor(workflowPaths);
  const inboxReadmePath = inboxReadmePathFor(workflowPaths);
  const githubPrompts = scaffoldGithubPrompts(workflowPaths);
  const claudeAgents = scaffoldClaudeAgents(workflowPaths);

  // ── Infrastructure ─────────────────────────────────────────────────────────
  if (writeInfra) {
    await writeIfAbsent(
      path.join(repoPath, harness_CONFIG_NAME),
      JSON.stringify(DEFAULT_harness_CONFIG, null, 2) + "\n",
      harness_CONFIG_NAME,
    );

    // Patch harness.config.json version field if it exists but lacks version
    if (update) {
      const configAbs = path.join(repoPath, harness_CONFIG_NAME);
      try {
        const raw = await readFile(configAbs, "utf8");
        const cfg = JSON.parse(raw) as Record<string, unknown>;
        let touched = false;
        if (cfg["version"] === undefined) {
          cfg["version"] = HARNESS_CONFIG_VERSION;
          touched = true;
        }
        if (cfg["agentRouting"] === undefined) {
          cfg["agentRouting"] = DEFAULT_AGENT_ROUTING_CONFIG;
          touched = true;
        }
        if (touched) {
          await writeFile(
            configAbs,
            JSON.stringify(cfg, null, 2) + "\n",
            "utf8",
          );
          console.log(
            `  [updated] ${harness_CONFIG_NAME} — se completaron campos base (version/agentRouting)`,
          );
        }
      } catch {
        // File missing or invalid JSON — writeIfAbsent above handles it
      }
    }

    await mkdir(path.join(repoPath, HARNESS_DIR), { recursive: true });
    await writeIfAbsent(
      path.join(repoPath, workflowPaths.featureListPath),
      featureListTemplate(repoPath),
      workflowPaths.featureListPath,
    );
    await writeIfAbsent(
      path.join(repoPath, workflowPaths.featureHistoryPath),
      featureHistoryTemplate(),
      workflowPaths.featureHistoryPath,
    );
    await mkdir(path.join(repoPath, path.dirname(workflowPaths.currentPath)), {
      recursive: true,
    });
    await writeIfAbsent(
      path.join(repoPath, progressReadmePath),
      renderWorkflowTemplate(SCAFFOLD_PROGRESS_README_CONTENT, workflowPaths),
      progressReadmePath,
    );
    await writeIfAbsent(
      path.join(repoPath, workflowPaths.currentPath),
      DEFAULT_CURRENT_MD,
      workflowPaths.currentPath,
    );
    await writeIfAbsent(
      path.join(repoPath, workflowPaths.historyPath),
      DEFAULT_HISTORY_MD,
      workflowPaths.historyPath,
    );
    await writeIfAbsent(
      path.join(repoPath, inboxReadmePath),
      renderWorkflowTemplate(SCAFFOLD_INBOX_README_TEMPLATE, workflowPaths),
      `${workflowPaths.inboxDir}/`,
    );
    await mkdir(path.join(repoPath, workflowPaths.inboxProcessedDir), {
      recursive: true,
    });
    await writeIfAbsent(
      path.join(repoPath, DOCS_ARCHITECTURE_PATH),
      SCAFFOLD_ARCHITECTURE_DOC_CONTENT,
      DOCS_ARCHITECTURE_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_CONVENTIONS_PATH),
      SCAFFOLD_CONVENTIONS_DOC_CONTENT,
      DOCS_CONVENTIONS_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_SPECS_PATH),
      renderWorkflowTemplate(SCAFFOLD_SPECS_DOC_CONTENT, workflowPaths),
      DOCS_SPECS_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_SPECS_POLICY_PATH),
      SCAFFOLD_SPECS_POLICY_DOC_CONTENT,
      DOCS_SPECS_POLICY_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_VERIFICATION_PATH),
      SCAFFOLD_VERIFICATION_DOC_CONTENT,
      DOCS_VERIFICATION_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_MODEL_INTERFACE_PATH),
      SCAFFOLD_MODEL_INTERFACE_DOC_CONTENT,
      DOCS_MODEL_INTERFACE_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_CONTEXT_MANAGER_PATH),
      renderWorkflowTemplate(
        SCAFFOLD_CONTEXT_MANAGER_DOC_CONTENT,
        workflowPaths,
      ),
      DOCS_CONTEXT_MANAGER_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_EXECUTION_ENGINE_PATH),
      SCAFFOLD_EXECUTION_ENGINE_DOC_CONTENT,
      DOCS_EXECUTION_ENGINE_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_MEMORY_SYSTEM_PATH),
      SCAFFOLD_MEMORY_SYSTEM_DOC_CONTENT,
      DOCS_MEMORY_SYSTEM_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_ORCHESTRATION_PATH),
      renderWorkflowTemplate(SCAFFOLD_ORCHESTRATION_DOC_CONTENT, workflowPaths),
      DOCS_ORCHESTRATION_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_TOOL_CATALOG_PATH),
      SCAFFOLD_TOOL_CATALOG_DOC_CONTENT,
      DOCS_TOOL_CATALOG_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_OBSERVATION_POLICY_PATH),
      renderWorkflowTemplate(
        SCAFFOLD_OBSERVATION_POLICY_DOC_CONTENT,
        workflowPaths,
      ),
      DOCS_OBSERVATION_POLICY_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_LOOP_CONTRACT_PATH),
      SCAFFOLD_LOOP_CONTRACT_DOC_CONTENT,
      DOCS_LOOP_CONTRACT_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_PLANNING_MODEL_PATH),
      SCAFFOLD_PLANNING_MODEL_DOC_CONTENT,
      DOCS_PLANNING_MODEL_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_BUDGETS_PATH),
      SCAFFOLD_BUDGETS_DOC_CONTENT,
      DOCS_BUDGETS_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_CONTRACT_VERSIONS_PATH),
      SCAFFOLD_CONTRACT_VERSIONS_DOC_CONTENT,
      DOCS_CONTRACT_VERSIONS_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, DOCS_FRONTEND_ADAPTERS_PATH),
      SCAFFOLD_FRONTEND_ADAPTERS_DOC_CONTENT,
      DOCS_FRONTEND_ADAPTERS_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, CHECKPOINTS_PATH),
      renderWorkflowTemplate(SCAFFOLD_CHECKPOINTS_CONTENT, workflowPaths),
      CHECKPOINTS_PATH,
    );
    await writeExecutableIfAbsent(
      path.join(repoPath, REPO_INIT_SCRIPT_PATH),
      SCAFFOLD_REPO_INIT_SH,
      REPO_INIT_SCRIPT_PATH,
    );
    await ensureAgentsFile(
      path.join(repoPath, AGENTS_MD_PATH),
      workflowPaths,
      update,
    );
    await writeManagedFile(
      path.join(repoPath, CODEX_MD_PATH),
      renderWorkflowTemplate(SCAFFOLD_CODEX_MD_TEMPLATE, workflowPaths),
      CODEX_MD_PATH,
      update,
    );
    await writeIfAbsent(
      path.join(repoPath, CODEX_CONFIG_PATH),
      renderCodexProjectConfigToml(),
      CODEX_CONFIG_PATH,
    );
    await ensureCodexMcpServer(
      path.join(repoPath, CODEX_CONFIG_PATH),
      update,
    );
    await reconcileManagedScaffoldClients(repoPath, target);
  }

  // ── GitHub / Copilot ───────────────────────────────────────────────────────
  if (writeGithub) {
    await writeIfAbsent(
      path.join(repoPath, VSCODE_MCP_PATH),
      JSON.stringify(DEFAULT_MCP_JSON, null, 2) + "\n",
      VSCODE_MCP_PATH,
    );
    await ensureVSCodeMcpServer(path.join(repoPath, VSCODE_MCP_PATH), update);
    await writeManagedFile(
      path.join(repoPath, COPILOT_INSTRUCTIONS_PATH),
      renderWorkflowTemplate(
        SCAFFOLD_COPILOT_INSTRUCTIONS_TEMPLATE,
        workflowPaths,
      ),
      COPILOT_INSTRUCTIONS_PATH,
      update,
    );

    // Agent prompts + AGENTS.md
    await mkdir(path.join(repoPath, GITHUB_PROMPTS_DIR), { recursive: true });
    for (const [filename, content] of githubPrompts) {
      const filePath = path.join(repoPath, GITHUB_PROMPTS_DIR, filename);
      const label = `${GITHUB_PROMPTS_DIR}/${filename}`;
      if (await fileExists(filePath)) {
        const existing = await readFile(filePath, "utf8");
        if (!existing.includes(AGENTS_VERSION_MARKER)) {
          await writeFile(filePath, content, "utf8");
          console.log(`  [updated] ${label} — versión de agentes actualizada`);
        } else {
          console.log(`  skip  ${label} (ya tiene ${AGENTS_VERSION_MARKER})`);
        }
      } else {
        await writeFile(filePath, content, "utf8");
        console.log(`  create ${label}`);
      }
    }
  }

  // ── Claude ─────────────────────────────────────────────────────────────────
  if (writeClaude) {
    await writeManagedFile(
      path.join(repoPath, CLAUDE_MD_PATH),
      renderWorkflowTemplate(SCAFFOLD_CLAUDE_MD_TEMPLATE, workflowPaths),
      CLAUDE_MD_PATH,
      update,
    );
    await writeIfAbsent(
      path.join(repoPath, CLAUDE_PROJECT_MCP_PATH),
      JSON.stringify(DEFAULT_CLAUDE_PROJECT_MCP_JSON, null, 2) + "\n",
      CLAUDE_PROJECT_MCP_PATH,
    );
    await ensureClaudeProjectMcpServer(
      path.join(repoPath, CLAUDE_PROJECT_MCP_PATH),
      update,
    );
    await writeManagedFile(
      path.join(repoPath, CLAUDE_COMMAND_PATH),
      renderWorkflowTemplate(SCAFFOLD_CLAUDE_COMMAND_TEMPLATE, workflowPaths),
      CLAUDE_COMMAND_PATH,
      update,
    );

    // Claude subagents
    await mkdir(path.join(repoPath, CLAUDE_AGENTS_DIR), { recursive: true });
    for (const [filename, content] of claudeAgents) {
      const filePath = path.join(repoPath, CLAUDE_AGENTS_DIR, filename);
      const label = `${CLAUDE_AGENTS_DIR}/${filename}`;
      if (await fileExists(filePath)) {
        const existing = await readFile(filePath, "utf8");
        if (!existing.includes(AGENTS_VERSION_MARKER)) {
          await writeFile(filePath, content, "utf8");
          console.log(`  [updated] ${label} — versión de agentes actualizada`);
        } else {
          console.log(`  skip  ${label} (ya tiene ${AGENTS_VERSION_MARKER})`);
        }
      } else {
        await writeFile(filePath, content, "utf8");
        console.log(`  create ${label}`);
      }
    }
  }

  // ── OpenCode ───────────────────────────────────────────────────────────────
  if (writeOpenCode) {
    await writeManagedFile(
      path.join(repoPath, OPENCODE_CONFIG_PATH),
      JSON.stringify(DEFAULT_OPENCODE_JSON, null, 2) + "\n",
      OPENCODE_CONFIG_PATH,
      update,
    );
    await ensureOpenCodeConfig(path.join(repoPath, OPENCODE_CONFIG_PATH), update);
    await writeManagedFile(
      path.join(repoPath, OPENCODE_COMMAND_PATH),
      renderWorkflowTemplate(SCAFFOLD_OPENCODE_COMMAND_TEMPLATE, workflowPaths),
      OPENCODE_COMMAND_PATH,
      update,
    );
  }

  console.log(renderLocalActivationMessage(target, update));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function runInit(options: InitOptions): Promise<void> {
  if (options.global) {
    await runInitGlobal(options.update, options.forceManagedGlobal);
  } else {
    await runInitLocal(
      path.resolve(options.repoPath),
      options.update,
      options.target ?? "all",
    );
  }
}

export function readExplicitInitRepoPath(argv: string[]): string | null {
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
  return null;
}

export function readInitRepoPath(argv: string[]): string {
  return path.resolve(readExplicitInitRepoPath(argv) ?? process.cwd());
}

export function isGlobalInit(argv: string[]): boolean {
  return argv.includes("--global");
}

export function isUpdateInit(argv: string[]): boolean {
  return argv.includes("--update");
}

export function initTarget(argv: string[]): InitTarget {
  if (argv.includes("--claude")) return "claude";
  if (argv.includes("--copilot")) return "copilot";
  if (argv.includes("--opencode")) return "opencode";
  if (argv.includes("--codex")) return "codex";
  return "all";
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
