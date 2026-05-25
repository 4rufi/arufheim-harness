# arufheim-harness

`arufheim-harness` es un servidor MCP local para trabajar sobre repositorios con:

- tools seguras de lectura, búsqueda, escritura y ejecución acotada
- tracking de backlog y sesión dentro de `.harness/`
- memoria persistente dentro del repo (`.harness/memory.sqlite`)
- bootstrap de workflow para **Codex**, **Claude Code**, **GitHub Copilot** y **OpenCode**

La idea es simple:

1. instalas `arufheim-harness` una vez
2. haces `init` dentro de cada repo donde quieres usar el arnés
3. conectas tu cliente MCP al repo
4. trabajas con un flujo ligero, verificable y con menos gasto de contexto

## Qué hace hoy

- inicializa un repo con layout canónico en `.harness/` y `.harness-docs/`
- expone tools MCP para exploración, workflow, inbox, memoria, métricas y progreso
- mantiene backlog activo, historial de features y estado de sesión
- soporta SDD con `pending -> spec_ready -> aprobación humana -> in_progress -> done`
- mantiene memoria persistente con SQLite + FTS5
- permite `PermissionPolicy` por repo para controlar mutaciones y comandos
- muestra estado, policy y métricas locales en `tui`
- sigue leyendo repos legacy y `init --update` los migra al layout actual

## Requisitos

- Node.js 24+ requerido
- `npm` para instalación global
- `pnpm` solo si vas a desarrollar **este** repo de harness

## Instalación global

Instala el binario una vez:

```bash
npm install -g arufheim-harness
```

Después puedes usar:

```bash
arufheim-harness help
```

## Primer uso

### 1. Configurar clientes MCP globales

Si quieres que el setup global de VS Code, Claude Desktop o Claude Code quede listo:

```bash
arufheim-harness init --global
```

Esto instala o actualiza la configuración MCP global donde corresponda.

### 2. Inicializar un repo

Dentro del repo donde quieres usar el workflow:

```bash
cd /ruta/al/repo
arufheim-harness init
```

Esto crea la estructura base:

- `.harness/feature_list.json`
- `.harness/feature_history.json`
- `.harness/progress/`
- `.harness/inbox/`
- `.harness-docs/`
- `CHECKPOINTS.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `.claude/agents/`
- `.claude/commands/harness.md`
- `.opencode/opencode.json`
- `.opencode/commands/harness.md`
- `.github/prompts/`
- `.github/copilot-instructions.md`
- `.vscode/mcp.json`

Además deja listo:

- `harness.config.json` con comandos permitidos, ignores y `permissionPolicy`
- `.harness/progress/current.md` y `.harness/progress/history.md`
- `.harness-docs/` con contratos del arnés, reglas SDD, budgets, adapters y loop contract
- entrypoints para Claude, Codex, Copilot y OpenCode

### 3. Verificar el setup del repo

```bash
arufheim-harness doctor
```

o, si ya estás dentro del workflow del repo:

```bash
./init.sh
```

Qué valida:

- archivos base del arnés
- shape de `feature_list.json`
- presencia de specs SDD cuando corresponde
- evidencia de implementación/review para features cerradas
- `typecheck`, `build` y `smoke`

## Modos de `init`

### Workflow base + Claude + Copilot + OpenCode

```bash
arufheim-harness init
```

### Solo archivos Claude

```bash
arufheim-harness init --claude
```

### Solo archivos Copilot

```bash
arufheim-harness init --copilot
```

### Solo archivos OpenCode

```bash
arufheim-harness init --opencode
```

### Completar archivos faltantes sin borrar trabajo existente

```bash
arufheim-harness init --update
```

### Migrar un repo viejo al layout actual

Si ya usabas una versión anterior con archivos como `feature_list.json`,
`progress/` o `docs/` en la raíz:

```bash
arufheim-harness doctor
arufheim-harness init --update
```

El runtime nuevo sigue leyendo esos repos viejos, y `init --update` copia su
estado al layout actual en `.harness/` y `.harness-docs/` sin borrar los
archivos legacy.

`doctor` debería marcar esos repos como:

- compatibles
- desactualizados
- migrables con `arufheim-harness init --update`

## Cómo se usa en un repo

El repo bootstrappeado queda con este flujo:

```text
inbox -> pending -> spec_ready -> aprobación humana -> in_progress -> done
```

Archivos principales:

- `.harness/feature_list.json`: backlog activo
- `.harness/feature_history.json`: features cerradas
- `.harness/progress/current.md`: sesión actual
- `.harness/progress/history.md`: historial de sesiones
- `specs/<feature>/`: spec SDD
- `.harness/inbox/`: requerimientos crudos
- `.harness/memory.sqlite`: memoria persistente
- `.harness/metrics/session.json`: métricas locales de sesión

Artifacts importantes:

- `.harness/progress/impl_<feature>.md`: evidencia del implementer
- `.harness/progress/review_<feature>.md`: veredicto del reviewer
- `.harness/progress/spec_<feature>.md`: bloqueos o faltantes de spec

### Cuándo usar SDD

Usa `sdd: true` si implementar mal la feature cuesta más que escribir el spec.

Disparadores fuertes:

- seguridad o boundaries
- tool, command o resource nueva
- cambio de contrato, estado o flujo
- cambio multiarchivo con comportamiento observable

La política completa vive en `.harness-docs/specs_policy.md` dentro del repo bootstrappeado.

## Contratos del arnés

Dentro de `.harness-docs/` el repo bootstrappeado incluye:

- `specs.md` y `specs_policy.md`: flujo SDD y regla para decidir `sdd: true`
- `model_interface.md`, `context_manager.md`, `execution_engine.md`, `memory_system.md`, `orchestration.md`
- `tool_catalog.md`, `observation_policy.md`, `planning_model.md`
- `budgets.md`, `contract_versions.md`, `frontend_adapters.md`, `loop_contract.md`

No necesitas leer todo eso para usar el arnés día a día. Son el contrato del sistema y sirven sobre todo cuando cambias el propio harness o depuras comportamiento.

## Conectar clientes

### VS Code

El bootstrap ya deja `.vscode/mcp.json` en el repo. Si necesitas escribirlo a mano:

```json
{
  "servers": {
    "harness": {
      "type": "stdio",
      "command": "npx",
      "args": ["arufheim-harness", "--repo-path", "${workspaceFolder}"]
    }
  }
}
```

### OpenCode

El bootstrap ya deja `.opencode/opencode.json` y `.opencode/commands/harness.md`.

- `opencode.json` registra el MCP local `arufheim-harness`
- deja permisos de lectura en `allow`
- deja tools MCP de exploración compacta (`harness_status`, `harness_metrics`, `read_file`, `list_files`, `search_repo`, `mem_*`) en `allow`
- deja el resto en `ask`

Si quieres endurecerlo más, cambia la sección `permission` en `.opencode/opencode.json`.

### Claude Code

Manual:

```bash
claude mcp add harness npx arufheim-harness
```

Apuntando a un repo específico:

```bash
claude mcp add harness npx arufheim-harness -- --repo-path /ruta/al/repo
```

### Codex

El repo bootstrappeado deja `CODEX.md` como punto de entrada operativo.  
Si Codex trabaja desde la raíz del repo, `--repo-path` normalmente no hace falta.

## Configuración por repo

Puedes crear un `harness.config.json` para comandos permitidos e ignores:

```json
{
  "version": 1,
  "allowedCommands": ["pnpm test", "npm test", "yarn test", "ls", "pwd"],
  "ignored": ["node_modules/**", ".git/**", "dist/**"],
  "permissionPolicy": {
    "mode": "always_allow",
    "allowedTools": [],
    "allowedRisk": []
  }
}
```

Notas:

- `repoPath` normalmente se resuelve por `--repo-path` o por el directorio actual
- si pasas `--config`, esa ruta manda
- `permissionPolicy.mode` soporta `always_allow`, `always_ask` y `allow_list`

### PermissionPolicy

Modos:

- `always_allow`: deja pasar tools mutantes y comandos sin gate local adicional
- `always_ask`: bloquea toda acción mutante; requiere cambiar policy o aprobación humana por otro medio
- `allow_list`: solo permite las tools y risk classes declaradas

Risk classes:

- `R0`: lectura
- `R1`: mutación estructurada local
- `R2`: mutación de contenido local
- `R3`: ejecución de comandos / side effects externos

## CLI

| Comando | Qué hace |
| --- | --- |
| `arufheim-harness init` | bootstrap del repo actual |
| `arufheim-harness init --claude` | bootstrap base + archivos Claude |
| `arufheim-harness init --copilot` | bootstrap base + archivos Copilot |
| `arufheim-harness init --opencode` | bootstrap base + archivos OpenCode |
| `arufheim-harness init --global` | configura clientes MCP globales |
| `arufheim-harness init --update` | añade secciones faltantes sin sobreescribir |
| `arufheim-harness doctor` | valida setup del repo |
| `arufheim-harness tui` | dashboard de terminal con estado, policy y métricas |
| `arufheim-harness help` | ayuda rápida |

Flags principales:

- `--repo-path <ruta>`: raíz del repo
- `--config <ruta>`: ruta explícita a `harness.config.json`

## Qué expone el servidor MCP

### Exploración del repo

- `list_files`
- `read_file`
- `write_file`
- `search_repo`
- `run_command`

### Workflow

- `harness_status`
- `harness_update`
- `harness_add`
- `harness_log`
- `harness_metrics`
- `progress_set_plan`
- `progress_next_step`
- `history_append`

### Inbox

- `inbox_list`
- `inbox_consume`

### Memoria

- `mem_save`
- `mem_session_summary`
- `mem_search`
- `mem_context`
- `mem_get`
- `mem_get_observation`

La memoria usa SQLite + FTS5. Si el repo todavía tiene `.harness/memory.jsonl` legacy, el runtime lo importa automáticamente a SQLite.

### Resources

- `harness://config/raw`
- `harness://config/resolved`
- `harness://logs/main`

## Métricas y observabilidad

### `harness_metrics`

Devuelve:

- `estimated_local_tokens`
- conteo de lecturas y escrituras
- conteo de commands
- tools llamadas en la sesión
- resumen de `PermissionPolicy`

Importante:

- `estimated_local_tokens` es estimación local por bytes/contexto leído
- no son tokens facturados por Claude, Codex, Copilot u OpenCode

### `tui`

`arufheim-harness tui` muestra:

- features
- próximo paso
- inbox
- memoria reciente
- policy activa
- métricas locales de sesión

## Seguridad

El servidor está diseñado para operar dentro de un `repoPath`:

- bloquea path traversal
- bloquea symlinks que salgan del repo
- `run_command` usa allowlist de comandos
- `run_command` falla como error MCP si el comando falla
- ignores por defecto para `.git`, `node_modules`, `dist`, `.harness`
- logs en `.harness/logs/harness.jsonl`

Además:

- `write_file` respeta `PermissionPolicy`
- `harness_update`, `harness_add`, `harness_log`, `progress_*`, `history_append` e `inbox_consume` también respetan `PermissionPolicy`
- el loop del arnés está acotado por `action budget`, `retry policy` y `blocked policy`

## Desarrollo de este repo

Para desarrollar **arufheim-harness**:

```bash
corepack enable
corepack prepare pnpm@10.33.4 --activate
```

o:

```bash
npm install -g pnpm
```

o:

```bash
yarn global add pnpm
```

Luego:

```bash
pnpm install
./init.sh
```

`npm` o `yarn` aquí sirven para instalar `pnpm`; el workflow de desarrollo de este repo usa `pnpm`.

## Antes de publicar

Checklist corto:

```bash
./init.sh
npm pack --dry-run
```

Si vienes de una versión anterior y quieres probar el upgrade:

```bash
arufheim-harness doctor
arufheim-harness init --update
arufheim-harness doctor
```

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · `fast-glob` · `zod`

## Apoya el proyecto

Si te fue útil, puedes invitarme un café ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S0C01ZWS43)
