# arufheim-harness

`arufheim-harness` es un servidor MCP local para trabajar sobre repositorios con:

- tools seguras de lectura, búsqueda, escritura y ejecución acotada
- tracking de backlog y sesión dentro de `.harness/`
- memoria persistente dentro del repo
- bootstrap de workflow para **Codex**, **Claude Code** y **GitHub Copilot**

La idea es simple:

1. instalas `arufheim-harness` una vez
2. haces `init` dentro de cada repo donde quieres usar el arnés
3. conectas tu cliente MCP al repo
4. trabajas con un flujo ligero, verificable y con menos gasto de contexto

## Requisitos

- Node.js 20+ recomendado
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
- `.github/prompts/`
- `.github/copilot-instructions.md`
- `.vscode/mcp.json`

### 3. Verificar el setup del repo

```bash
arufheim-harness doctor
```

o, si ya estás dentro del workflow del repo:

```bash
./init.sh
```

## Modos de `init`

### Workflow base + Claude + Copilot

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

### Completar archivos faltantes sin borrar trabajo existente

```bash
arufheim-harness init --update
```

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

### Cuándo usar SDD

Usa `sdd: true` si implementar mal la feature cuesta más que escribir el spec.

Disparadores fuertes:

- seguridad o boundaries
- tool, command o resource nueva
- cambio de contrato, estado o flujo
- cambio multiarchivo con comportamiento observable

La política completa vive en `.harness-docs/specs_policy.md` dentro del repo bootstrappeado.

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
  "allowedCommands": ["pnpm test", "npm test", "yarn test", "ls", "pwd"],
  "ignored": ["node_modules/**", ".git/**", "dist/**"]
}
```

Notas:

- `repoPath` normalmente se resuelve por `--repo-path` o por el directorio actual
- si pasas `--config`, esa ruta manda

## CLI

| Comando | Qué hace |
| --- | --- |
| `arufheim-harness init` | bootstrap del repo actual |
| `arufheim-harness init --claude` | bootstrap base + archivos Claude |
| `arufheim-harness init --copilot` | bootstrap base + archivos Copilot |
| `arufheim-harness init --global` | configura clientes MCP globales |
| `arufheim-harness init --update` | añade secciones faltantes sin sobreescribir |
| `arufheim-harness doctor` | valida setup del repo |
| `arufheim-harness tui` | dashboard de terminal |
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

### Resources

- `harness://config/raw`
- `harness://config/resolved`
- `harness://logs/main`

## Seguridad

El servidor está diseñado para operar dentro de un `repoPath`:

- bloquea path traversal
- bloquea symlinks que salgan del repo
- `run_command` usa allowlist de comandos
- `run_command` falla como error MCP si el comando falla
- ignores por defecto para `.git`, `node_modules`, `dist`, `.harness`
- logs en `.harness/logs/harness.jsonl`

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

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · `fast-glob` · `zod`
