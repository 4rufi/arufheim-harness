import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import * as readline from "node:readline/promises";
import {
  DEFAULT_CURRENT_MD,
  DEFAULT_HISTORY_MD,
  resolveWorkflowPaths,
  type WorkflowPaths,
} from "./workflow.js";

const harness_CONFIG_NAME = "harness.config.json";
const VSCODE_MCP_PATH = ".vscode/mcp.json";
const COPILOT_INSTRUCTIONS_PATH = ".github/copilot-instructions.md";
const CLAUDE_MD_PATH = "CLAUDE.md";
const CLAUDE_AGENTS_DIR = ".claude/agents";
const CLAUDE_COMMAND_PATH = ".claude/commands/harness.md";
const HARNESS_DIR = ".harness";
const FEATURE_LIST_PATH = ".harness/feature_list.json";
const PROGRESS_DIR = ".harness/progress";
const PROGRESS_CURRENT_PATH = ".harness/progress/current.md";
const INBOX_DIR = ".harness/inbox";
const INBOX_README = ".harness/inbox/README.md";
const GITHUB_PROMPTS_DIR = ".github/prompts";
const AGENTS_MD_PATH = "AGENTS.md";
const AGENTS_VERSION_MARKER = "<!-- harness-agents-v1 -->";

const HARNESS_CONFIG_VERSION = 1;

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
4. Al terminar: \`"done"\`, resumen → \`.harness/progress/history.md\`, limpia \`current.md\`

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
4. \`"done"\` + resumen → \`.harness/progress/history.md\`

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

pending → in_progress → done

1. Tarea nueva: añade → \`"pending"\`
2. Arrancar: \`"in_progress"\` + plan en \`.harness/progress/current.md\`
3. Terminar: \`"done"\` + resumen → \`.harness/progress/history.md\` + limpia \`current.md\`

## Reglas

- Una sola \`in_progress\` a la vez
- No implementes sin registrar en \`feature_list.json\`
- No declares \`done\` sin verificación ejecutable
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
pending → in_progress → done
\`\`\`

- Una sola \`in_progress\` a la vez
- No implementes sin registrar en \`feature_list.json\`
- SDD: \`pending → spec_ready → aprobación humana → in_progress → done\`

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

<!-- harness-agents-v1 -->

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
pending → [spec_author] → spec_ready → HUMANO → in_progress → [implementer] → [reviewer] → done
\`\`\`

### pending
1. Lanza \`spec_author\`
2. Si OK → \`spec_ready\` + para, pide revisión humana

### spec_ready + aprobación
1. \`in_progress\`
2. Lanza \`implementer\` → si \`done\` → lanza \`reviewer\`
3. Si \`APPROVED\` → \`done\` + \`history_append\` + limpia \`current.md\`

### spec_ready sin aprobación
No continúas.

### in_progress (sesión interrumpida)
Revisa \`current.md\`, pregunta reanudar o abortar.

### blocked
Mueve feature a \`blocked\`, documenta en \`current.md\`, reporta al humano.

## Flujo simple (sin SDD)

\`\`\`
pending → in_progress → [implementer] → done
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

<!-- harness-agents-v1 -->

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
3. Marca \`[x]\` en \`tasks.md\`
4. Actualiza \`## Bitácora\` y \`## Próximo paso\`

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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
pending → [spec_author] → spec_ready → HUMANO → in_progress → [implementer] → [reviewer] → done
\`\`\`

### pending
1. Lanza \`spec_author\`
2. Si OK → \`spec_ready\` + para, pide revisión humana

### spec_ready + aprobación
1. \`in_progress\`
2. Lanza \`implementer\` → si \`done\` → lanza \`reviewer\`
3. Si \`APPROVED\` → \`done\` + resumen en \`.harness/progress/history.md\` + limpia \`current.md\`

### spec_ready sin aprobación
No continúas.

### in_progress (sesión interrumpida)
Revisa \`current.md\`, pregunta reanudar o abortar.

### blocked
Mueve feature a \`blocked\`, documenta en \`current.md\`, reporta al humano.

## Flujo simple (sin SDD)

\`\`\`
pending → in_progress → [implementer] → done
\`\`\`
`;

const CLAUDE_IMPLEMENTER_CONTENT = `---
name: implementer
description: Trabajador. Implementa una sola feature según su spec aprobado. Escribe código, verificación y evidencia de trazabilidad.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v1 -->

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
3. Marca \`[x]\` en \`tasks.md\`
4. Actualiza \`## Bitácora\` y \`## Próximo paso\`

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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
const CHECKPOINTS_PATH = "CHECKPOINTS.md";

const SCAFFOLD_PROGRESS_README_CONTENT = `# Progress

\`progress/\` guarda estado operativo, no notas libres.

## Archivos

- \`current.md\`: sesión viva
- \`history.md\`: cierre append-only
- \`explore_<topic>.md\`: exploración opcional
- \`impl_<feature>.md\`: evidencia de implementación
- \`review_<feature>.md\`: veredicto de review
- \`spec_<feature>.md\`: bloqueo del spec

## Reglas

- \`current.md\` se actualiza en tiempo real y se resetea al cerrar
- \`history.md\` solo agrega al final
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

## Cierre

- documenta en \`progress/impl_<feature>.md\` qué comandos corriste
- el reviewer debe poder repetirlos
- una feature no pasa a \`done\` con verificación roja o faltante
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
- No declares \`done\` sin verificación ejecutable.
- No pongas resultados largos en chat si deben quedar en archivos de \`specs/\`
  o \`{{historyPath}}\` / \`{{currentPath}}\`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama \`harness_status\` con \`mode: "brief_only"\` y usa \`startup_brief\` como snapshot inicial.
2. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
3. Lee solo los archivos mínimos que falten para el caso actual.
4. Aplica el flujo definido en \`.claude/agents/leader.md\`
`;

const SCAFFOLD_CODEX_MD_TEMPLATE = `# Instrucciones para Codex

Actúas por defecto como \`leader\`.

## Reglas duras

- No saltes SDD cuando la feature tenga \`"sdd": true\`.
- No saltes la aprobación humana entre \`spec_ready\` e \`in_progress\`.
- No declares \`done\` sin verificación ejecutable.
- No pongas resultados largos en chat si deben quedar en archivos de \`specs/\`
  o \`{{historyPath}}\` / \`{{currentPath}}\`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama \`harness_status\` con \`mode: "brief_only"\` y usa \`startup_brief\` como snapshot inicial.
2. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
3. Lee solo los archivos mínimos que falten para el caso actual.
4. Aplica el flujo definido por \`leader\`
`;

const SCAFFOLD_COPILOT_INSTRUCTIONS_TEMPLATE = `# Copilot Instructions — harness

Actúas por defecto como \`leader\`.

## Reglas duras

- No saltes SDD cuando la feature tenga \`"sdd": true\`.
- No saltes la aprobación humana entre \`spec_ready\` e \`in_progress\`.
- No declares \`done\` sin verificación ejecutable.
- No pongas resultados largos en chat si deben quedar en \`specs/\` o
  \`{{historyPath}}\` / \`{{currentPath}}\`.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Protocolo de arranque

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_only"\` y usa \`startup_brief\` como snapshot inicial.
2. Ejecuta la verificación estándar del repo antes de tocar código si el flujo lo exige.
3. Lee solo los archivos mínimos que falten para el caso actual.
4. Aplica el flujo definido en \`.github/prompts/leader.prompt.md\`.
`;

const SCAFFOLD_CLAUDE_COMMAND_TEMPLATE = `# Harness

## Arranque

1. Llama \`harness_status\` con \`mode: "brief_only"\` y usa \`startup_brief\` como snapshot inicial.
2. Si hay archivos nuevos en \`{{inboxDir}}/\`, procésalos antes del flujo normal.
3. Lee solo los archivos mínimos que falten para el caso actual.
4. Lee \`.harness-docs/verification.md\`.

Resume en pocas líneas: feature activa, próximo paso, inbox pendiente y bloqueo
si existe.

## Comunicación

No narres pasos internos. Muestra resultado, no proceso.

## Flujo

- Si la feature tiene \`"sdd": true\`, sigue
  \`pending -> spec_ready -> aprobación humana -> in_progress -> done\`.
- Una sola feature puede estar en \`in_progress\`.
- No declares \`done\` sin verificación ejecutable.
- Si te bloqueas, deja el estado en \`{{currentPath}}\` antes de cerrar.
`;

const SCAFFOLD_AGENTS_MD_TEMPLATE = `# AGENTS.md

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
- \`specs/<feature>/\`: implementación SDD
- \`.harness-docs/architecture.md\`: diseño
- \`.harness-docs/conventions.md\`: edición/código
- \`.harness-docs/verification.md\`: cierre
- \`CHECKPOINTS.md\`: auto-review
- \`{{inboxDir}}/\`: input nuevo
- \`.claude/agents/\`, \`.github/prompts/\`, \`CLAUDE.md\`, \`CODEX.md\`: orquestación

## Reglas duras

- Una sola feature en \`in_progress\`.
- No cierres nada sin \`./init.sh\` verde.
- Toda feature con \`"sdd": true\` pasa por \`pending -> spec_ready -> aprobación humana -> in_progress -> done\`.
- No inventes estado: actualiza \`{{currentPath}}\`.
- No rompas la plantilla de \`{{currentPath}}\`.
- No escribas logs arbitrarios a \`stdout\`.
- Si te bloqueas, deja evidencia en \`{{currentPath}}\`.

## Flujo

\`\`\`text
[inbox_reader] -> pending
[scoper] -> filtra scope de sesión
pending -> [spec_author] -> spec_ready -> HUMANO -> in_progress -> [implementer -> reviewer] -> done
\`\`\`

\`inbox_reader\` y \`scoper\` son opcionales. SDD es obligatorio para features con \`"sdd": true\`.

## Cierre

1. \`./init.sh\`
2. Si acabaste la feature, actualiza backlog activo y archívala en \`{{featureHistoryPath}}\`
3. Añade resumen a \`{{historyPath}}\`
4. Limpia \`{{currentPath}}\`
5. Conserva \`explore_*.md\`, \`impl_*.md\`, \`review_*.md\`, \`spec_*.md\`
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
  - mcp_arufheim-harness_harness_update
  - mcp_arufheim-harness_harness_add
  - mcp_arufheim-harness_harness_log
  - mcp_arufheim-harness_progress_set_plan
  - mcp_arufheim-harness_progress_next_step
  - mcp_arufheim-harness_history_append
  - mcp_arufheim-harness_mem_save
  - mcp_arufheim-harness_mem_search
---

<!-- harness-agents-v1 -->

# Agente Líder

Orquestas. No implementas código.

## Protocolo de arranque

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_only"\` y usa \`startup_brief\` como snapshot inicial.
2. Llama \`mcp_arufheim-harness_mem_context\`.
3. Si falta contexto, lee solo lo mínimo.
4. Si hay input nuevo en \`{{inboxDir}}/\`, considera \`inbox_reader\`.

## Flujo SDD

\`\`\`text
pending -> [spec_author] -> spec_ready -> HUMANO APRUEBA -> in_progress -> [implementer] -> [reviewer] -> done
\`\`\`

- \`pending\`: lanza \`spec_author\`; si termina bien, pasa a \`spec_ready\` y paras.
- \`spec_ready\` + aprobación humana: pasa a \`in_progress\`, lanza \`implementer\`, luego \`reviewer\`; si aprueba, cierra en \`done\`, archiva y resume.
- \`spec_ready\` sin aprobación: no continúas.
- \`in_progress\`: reanuda mirando \`{{currentPath}}\` y \`progress/\`.
- \`blocked\`: deja motivo en \`{{currentPath}}\` y paras.

## Reglas duras

- Una sola feature por sesión.
- Solo tú cambias \`{{featureListPath}}\`.
- No saltas aprobación humana entre \`spec_ready\` e \`in_progress\`.
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
  - mcp_arufheim-harness_harness_log
  - mcp_arufheim-harness_progress_set_plan
  - mcp_arufheim-harness_progress_next_step
  - mcp_arufheim-harness_mem_save
  - mcp_arufheim-harness_mem_search
---

<!-- harness-agents-v1 -->

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

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_only"\`.
2. Lee \`.harness-docs/architecture.md\`, \`.harness-docs/conventions.md\`, \`.harness-docs/specs.md\`, \`.harness-docs/verification.md\`.
3. Lee \`specs/<name>/spec_summary.md\` primero.
4. Lee \`requirements.md\` y \`tasks.md\`; abre \`design.md\` solo si hace falta.
5. Actualiza \`{{currentPath}}\`.
6. Ejecuta \`tasks.md\` en orden.

Para cada task \`T<n>\`:

1. Implementa el cambio pedido.
2. Añade o ajusta test si cambia comportamiento observable.
3. Si no corresponde test, documenta verificación y motivo.
4. Corre la verificación mínima relevante.
5. Marca \`[x] T<n>\`.
6. Actualiza \`## Bitácora\` y \`## Próximo paso\`.

## Verificación final

Corre la verificación estándar del repo. Si falla, documenta bloqueo y paras.
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
  - mcp_arufheim-harness_mem_search
  - mcp_arufheim-harness_mem_context
---

<!-- harness-agents-v1 -->

# Agente Revisor

Apruebas o rechazas. No editas código ni mueves estados.

## Protocolo

1. Llama \`mcp_arufheim-harness_harness_status\` con \`mode: "brief_only"\`.
2. Lee \`.harness-docs/architecture.md\`, \`.harness-docs/conventions.md\`, \`.harness-docs/specs.md\`, \`.harness-docs/verification.md\` y \`CHECKPOINTS.md\`.
3. Lee \`specs/<name>/spec_summary.md\` primero.
4. Abre \`requirements.md\` y \`tasks.md\`; abre \`design.md\` solo si hace falta.
5. Lee \`.harness/progress/impl_<name>.md\`.
6. Por cada \`R<n>\`, exige test automatizado concreto o excepción justificada con verificación ejecutable.
7. Comprueba que todas las tasks de \`tasks.md\` estén \`[x]\`, salvo justificación válida.
8. Revisa los archivos modificados contra \`.harness-docs/architecture.md\` y
   \`.harness-docs/conventions.md\`.
9. Corre la verificación estándar del repo.
10. Recorre \`CHECKPOINTS.md\` y registra cuáles se cumplen.
11. Emite veredicto.
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

<!-- harness-agents-v1 -->

# Agente Spec Author

Escribes spec para una sola feature \`pending\` con \`"sdd": true\`.

Artifacts:
- \`requirements.md\`
- \`design.md\`
- \`tasks.md\`
- \`spec_summary.md\`

## Protocolo

1. \`mcp_arufheim-harness_harness_status({ mode: "brief_only" })\`
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

<!-- harness-agents-v1 -->

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

<!-- harness-agents-v1 -->

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
    .replace(/^<!-- harness-agents-v1 -->\n\n/, "");
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

<!-- harness-agents-v1 -->

${promptBody(prompts.leader)}`,
    ],
    [
      "implementer.md",
      `---
name: implementer
description: Trabajador. Implementa una sola feature según su spec aprobado. Escribe código, verificación y evidencia de trazabilidad.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v1 -->

${promptBody(prompts.implementer)}`,
    ],
    [
      "reviewer.md",
      `---
name: reviewer
description: Revisor automático. Aprueba o rechaza el trabajo del implementador contra .harness-docs/, specs/<name>/ y CHECKPOINTS.md.
tools: Read, Write, Glob, Grep, Bash
---

<!-- harness-agents-v1 -->

${promptBody(prompts.reviewer)}`,
    ],
    [
      "spec_author.md",
      `---
name: spec_author
description: Redacta specs Kiro-style (requirements/design/tasks) para una feature pending con "sdd": true. NUNCA escribe código de aplicación ni tests.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v1 -->

${promptBody(prompts.specAuthor)}`,
    ],
    [
      "inbox_reader.md",
      `---
name: inbox_reader
description: Procesa archivos de requerimientos en .harness/inbox/ y los convierte en features en .harness/feature_list.json.
tools: Read, Write, Edit, Glob, Grep, Bash
---

<!-- harness-agents-v1 -->

${promptBody(prompts.inboxReader)}`,
    ],
    [
      "scoper.md",
      `---
name: scoper
description: Filtra .harness/feature_list.json por proyecto/scope y define qué trabaja el agente en esta sesión.
tools: Read, Write, Edit, Glob, Grep
---

<!-- harness-agents-v1 -->

${promptBody(prompts.scoper)}`,
    ],
  ];
}

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
  update?: boolean;
  target?: "all" | "claude" | "copilot";
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

async function runInitLocal(
  repoPath: string,
  update = false,
  target: "all" | "claude" | "copilot" = "all",
): Promise<void> {
  const verb = update ? "Actualizando" : "Inicializando";
  const targetLabel =
    target === "claude"
      ? " [Claude]"
      : target === "copilot"
        ? " [GitHub/Copilot]"
        : "";
  console.log(`\n${verb} harness${targetLabel} en: ${repoPath}\n`);

  const writeInfra = true;
  const writeGithub = target === "all" || target === "copilot";
  const writeClaude = target === "all" || target === "claude";
  const workflowPaths = await resolveWorkflowPaths(repoPath);
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
        if (cfg["version"] === undefined) {
          cfg["version"] = HARNESS_CONFIG_VERSION;
          await writeFile(
            configAbs,
            JSON.stringify(cfg, null, 2) + "\n",
            "utf8",
          );
          console.log(
            `  [updated] ${harness_CONFIG_NAME} — agregado version: ${HARNESS_CONFIG_VERSION}`,
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
      path.join(repoPath, CHECKPOINTS_PATH),
      renderWorkflowTemplate(SCAFFOLD_CHECKPOINTS_CONTENT, workflowPaths),
      CHECKPOINTS_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, AGENTS_MD_PATH),
      renderWorkflowTemplate(SCAFFOLD_AGENTS_MD_TEMPLATE, workflowPaths),
      AGENTS_MD_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, CODEX_MD_PATH),
      renderWorkflowTemplate(SCAFFOLD_CODEX_MD_TEMPLATE, workflowPaths),
      CODEX_MD_PATH,
    );
  }

  // ── GitHub / Copilot ───────────────────────────────────────────────────────
  if (writeGithub) {
    await writeIfAbsent(
      path.join(repoPath, VSCODE_MCP_PATH),
      JSON.stringify(DEFAULT_MCP_JSON, null, 2) + "\n",
      VSCODE_MCP_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, COPILOT_INSTRUCTIONS_PATH),
      renderWorkflowTemplate(
        SCAFFOLD_COPILOT_INSTRUCTIONS_TEMPLATE,
        workflowPaths,
      ),
      COPILOT_INSTRUCTIONS_PATH,
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
    await writeIfAbsent(
      path.join(repoPath, CLAUDE_MD_PATH),
      renderWorkflowTemplate(SCAFFOLD_CLAUDE_MD_TEMPLATE, workflowPaths),
      CLAUDE_MD_PATH,
    );
    await writeIfAbsent(
      path.join(repoPath, CLAUDE_COMMAND_PATH),
      renderWorkflowTemplate(SCAFFOLD_CLAUDE_COMMAND_TEMPLATE, workflowPaths),
      CLAUDE_COMMAND_PATH,
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

  if (update) {
    console.log("\n✓ Actualización completada.\n");
  } else {
    console.log("\n✓ Listo. Abre el repo en VS Code para activar el MCP.\n");
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function runInit(options: InitOptions): Promise<void> {
  if (options.global) {
    await runInitGlobal();
  } else {
    await runInitLocal(
      options.repoPath,
      options.update,
      options.target ?? "all",
    );
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

export function isUpdateInit(argv: string[]): boolean {
  return argv.includes("--update");
}

export function initTarget(argv: string[]): "all" | "claude" | "copilot" {
  if (argv.includes("--claude")) return "claude";
  if (argv.includes("--copilot")) return "copilot";
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
