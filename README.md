# arufheim-harness

`arufheim-harness` es un servidor MCP local para trabajar sobre repositorios con:

- tools seguras de lectura, búsqueda, escritura y ejecución acotada
- tracking de backlog y sesión dentro de `.harness/`
- memoria persistente dentro del repo (`.harness/memory.sqlite`)
- bootstrap de workflow para **Codex**, **Claude Code**, **GitHub Copilot** y **OpenCode**

La idea es simple:

1. instalas `arufheim-harness` una vez
2. haces `setup` dentro de cada repo donde quieres usar el arnés
3. usas `doctor` para inspección y `repair` para autoreparación cuando haga falta
4. trabajas con un flujo ligero, verificable y con menos gasto de contexto

## Qué hace hoy

- inicializa un repo con layout canónico en `.harness/` y `.harness-docs/`
- añade una capa operativa con `setup`, `doctor`, `repair` y `harness://health`
- expone tools MCP para exploración, workflow, loop state, inbox, memoria, métricas y progreso
- mantiene backlog activo, historial de features y estado de sesión
- soporta SDD con `pending -> spec_ready -> aprobación humana -> in_progress`, y dentro de `in_progress` usa un loop `plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked`
- mantiene memoria persistente con SQLite + FTS5
- permite `PermissionPolicy` por repo para controlar mutaciones y comandos
- muestra alertas, health, policy y métricas locales en `tui`
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

## Camino recomendado

### 1. Configurar clientes MCP globales

Si quieres dejar configurados los clientes globales gestionados por el arnés:

```bash
arufheim-harness setup --global
```

Si además quieres dejar listo un repo concreto para los clientes con fallback
global ambiguo:

```bash
arufheim-harness setup --global --repo-path /ruta/al/repo
```

Puedes filtrar clientes concretos:

```bash
arufheim-harness setup --global --clients claude,codex,copilot
```

Si quieres forzar la reconciliación de la entrada gestionada existente:

```bash
arufheim-harness setup --global --update --clients claude,codex,copilot
```

Si un config global gestionado está roto y quieres que el arnés haga backup
antes de regenerar solo la entrada gestionada:

```bash
arufheim-harness repair --global --clients codex --force-managed-global
```

Esto instala o actualiza la configuración MCP global donde corresponda.

Si pasas `--repo-path <ruta>` o ejecutas el comando desde un repo harness ya
detectable, `setup --global` también deja los bindings repo-scoped preferidos
para `Claude Code` y `Codex` en ese repo. Eso evita depender solo del fallback
global con `--repo-path "."`.

### 2. Resolver el repo

Dentro del repo donde quieres usar el workflow:

```bash
cd /ruta/al/repo
arufheim-harness setup
```

Esto crea la estructura base:

- `.harness/feature_list.json`
- `.harness/feature_history.json`
- `.harness/progress/`
- `.harness/inbox/`
- `.harness-docs/`
- `CHECKPOINTS.md`
- `init.sh`
- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `.mcp.json`
- `.codex/config.toml`
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
- validación final de health con resumen legible del repo

Si quieres limitar integraciones cliente sin quitar el core del arnés:

```bash
arufheim-harness setup --clients codex
```

Eso mantiene todo el workflow base, scaffolda solo adapter Codex, guarda
`scaffold.localClients=["codex"]` en `harness.config.json` y hace que `doctor`
no degrade por Claude/Copilot/OpenCode omitidos a propósito.

Si el repo ya existe y quieres forzar la reconciliación de sections/assets gestionados:

```bash
arufheim-harness setup --update
```

### 3. Inspeccionar o reparar

```bash
arufheim-harness doctor
```

Salida estructurada:

```bash
arufheim-harness doctor --json
```

Fallback CLI mínimo del snapshot inicial cuando el frontend no cargó `harness_status`:

```bash
arufheim-harness status --brief-minimal --json
```

Si además necesitas activation/`client_readiness` en el fallback CLI:

```bash
arufheim-harness status --brief --json
```

Si quieres estimar el costo local de un flujo completo sin tocar `session.json`:

```bash
arufheim-harness simulate --flow startup --json
arufheim-harness simulate --flow triage --json
```

`doctor --json`, `status --json`, `status --brief --json` y `harness_status(mode: "brief_only")` exponen además
`client_readiness`, que resume por cliente si quedó:

- `verified`
- `configured_needs_activation`
- `stale_reverification_required`
- `invalid_manual_fix_required`
- `missing`

Si hay una feature activa, `doctor --json`, `status --json`, `harness_status` y `harness://health`
exponen también `loop_summary`. Para consultar el estado detallado del intento actual
usa `harness_loop_status` o `harness://loop/active`.

Autoreparación de assets/config gestionados por el arnés:

```bash
arufheim-harness repair
```

Verificación estricta dentro del workflow del repo:

```bash
./init.sh
```

Qué valida:

- archivos base del arnés
- shape de `feature_list.json`
- presencia de specs SDD cuando corresponde
- evidencia de implementación/review para features cerradas
- `typecheck`, `build` y `smoke`

## Primitives avanzadas

`setup` es la entrada recomendada. `init` sigue existiendo como primitive compatible
cuando necesitas bootstrap o migración de más bajo nivel.

Semántica:

- `setup`: converge al estado listo con el menor cambio necesario
- `setup --update`: fuerza reconciliación del scaffold y de las entradas gestionadas
- `repair`: repara solo assets/config gestionados por el arnés
- `status --brief-minimal --json`: fallback CLI mínimo del `startup_brief` cuando el MCP no cargó tools
- `status --brief --json`: fallback CLI rico cuando además necesitas activation/`client_readiness`
- `simulate --flow <startup|activation|loop|triage>`: estima bytes/tokens locales por flujo sin contaminar métricas de sesión

Para `AGENTS.md`, el arnés no sobrescribe contenido propio del repo:

- si no existe, lo crea con un bloque gestionado
- si ya existe, `setup`/`repair` solo insertan o regeneran el bloque gestionado del harness
- `doctor` avisa en `warn` cuando el archivo existe pero todavía no tiene ese bloque

Para configs globales de clientes:

- `setup --global` y `repair --global` fallan cerrado ante archivos inválidos o no parseables por defecto
- si un config global está roto y quieres recovery gestionado, usa `--force-managed-global`; el arnés crea un backup junto al archivo original antes de regenerar la entrada gestionada
- los bindings nuevos incluyen `--client`; `setup`/`repair` dejan verificados los bindings determinísticos
- los bindings globales realmente `assumed` siguen requiriendo un arranque real del frontend para pasar a `verified`
- si hay `--repo-path` explícito o un repo harness detectable en cwd, `setup --global` / `repair --global` generan además los bindings repo-scoped preferidos para `Claude Code` y `Codex`
- la UX operativa recomendada vive en `client_readiness`: si ves `configured_needs_activation`, abre o reinicia el cliente y valida `repo_path`; si ves `invalid_manual_fix_required`, aplica el fix sugerido antes de seguir

## Modos de `init`

### Workflow base + Claude + Copilot + OpenCode

```bash
arufheim-harness init
```

### Solo archivos Claude

```bash
arufheim-harness init --claude
```

### Solo binding repo-scoped de Codex

```bash
arufheim-harness init --codex
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
arufheim-harness repair
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
inbox -> pending -> spec_ready -> aprobación humana -> in_progress
in_progress -> plan -> execute -> verify -> review -> analyze -> route_back -> done|blocked
```

Antes de `done`, el flujo espera dos cosas explícitas:

- verificación ejecutable relevante para el cambio
- actualización de README/docs si cambió el uso, el onboarding o el comportamiento visible

Y además, si el cambio es release-facing:

- actualización de `CHANGELOG.md` o constancia explícita de no aplicación

Archivos principales:

- `.harness/feature_list.json`: backlog activo
- `.harness/feature_history.json`: features cerradas
- `.harness/progress/current.md`: sesión actual
- `.harness/progress/history.md`: historial de sesiones
- `specs/<feature>/`: spec SDD
- `.harness/inbox/`: requerimientos crudos
- `.harness/memory.sqlite`: memoria persistente
- `.harness/metrics/session.json`: métricas locales de sesión
- `.harness/metrics/loops/<feature>.json`: loop persistido por feature activa o cerrada

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
    "arufheim-harness": {
      "type": "stdio",
      "command": "npx",
      "args": ["arufheim-harness", "--repo-path", "${workspaceFolder}", "--client", "vscode"]
    }
  }
}
```

Después del setup global:

- recarga la ventana
- abre el panel MCP y arranca `arufheim-harness`
- fuerza una llamada a `harness_status(mode: "brief_minimal")` y confirma que `repo_path` coincide con el workspace abierto
- `setup` deja `client_readiness.vscode.state=verified`; el arranque real solo confirma el repo observado

### OpenCode

El bootstrap ya deja `.opencode/opencode.json` y `.opencode/commands/harness.md`.

- `opencode.json` registra el MCP local `arufheim-harness`
- deja permisos de lectura en `allow`
- deja tools MCP de exploración compacta (`harness_status`, `harness_metrics`, `read_file`, `list_files`, `search_repo`, `mem_*`) en `allow`
- deja el resto en `ask`

Si quieres endurecerlo más, cambia la sección `permission` en `.opencode/opencode.json`.

### Claude Code

El bootstrap deja `.mcp.json` en el repo para scope de proyecto.

Manual por proyecto:

```bash
claude mcp add --scope project harness -- npx --yes arufheim-harness --repo-path . --client claude-code
```

Manual apuntando a un repo específico:

```bash
claude mcp add --scope project harness -- npx --yes arufheim-harness --repo-path /ruta/al/repo --client claude-code
```

Si usas binding global en Claude Desktop o Claude Code:

- reinicia el cliente después de escribir la config
- trata `--repo-path "."` como binding asumido hasta el primer arranque verificado
- confirma `repo_path` con `harness_status` antes de mutar estado
- revisa `client_readiness.claude_desktop` o `client_readiness.claude_code`; cuando quede en `verified`, `doctor` deja de degradar por ese binding

### Codex

El repo bootstrappeado deja `CODEX.md` y `.codex/config.toml`.
La configuración repo-scoped de Codex fija `arufheim-harness` con `--repo-path`
explícito para evitar arrastrar bindings de otro workspace.

Qué esperar:

- Codex arranca con `harness_status(mode: "brief_minimal")` para ahorrar contexto
- `harness_status` expone `repo_path`, `config_path`, `config_scope`, `workflow_layout`, `client_verification` y `client_readiness`
- usa `CODEX.md` como contrato principal de arranque, cierre y uso de SDD
- comparte el mismo flujo operativo que Claude y Copilot: backlog activo, `current.md`, `history.md`, memoria y artifacts SDD

Qué hace `init --global` para Codex:

- puede escribir `~/.codex/config.toml` con un server MCP explícito
- el camino preferente sigue siendo la config repo-scoped en `.codex/config.toml`

En la práctica, para Codex normalmente basta con:

```bash
cd /ruta/al/repo
arufheim-harness setup
```

y luego abrir el repo en Codex y comprobar que `repo_path` coincide con el repo
actual antes de mutar estado.

Si usas el binding global de Codex:

- el arnés lo considera una ruta de fallback, no el camino preferente
- `doctor` degrada mientras el binding siga en estado `assumed`
- el primer arranque correcto deja `client_readiness.codex=verified` mientras la config no cambie
- valida `repo_path` manualmente en el arranque o usa `.codex/config.toml` repo-scoped

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
  },
  "agentRouting": {
    "defaultProvider": "anthropic",
    "effort": "auto",
    "complexityThreshold": 5,
    "autoProviderRouting": true,
    "showRouting": true,
    "costStrategy": "quality_first",
    "models": {
      "anthropic": {
        "fast": "claude-3-5-haiku-latest",
        "deep": "claude-3-7-sonnet-latest"
      },
      "openai": {
        "fast": "gpt-4.1",
        "deep": "gpt-4.1"
      },
      "openai-codex": {
        "fast": "gpt-5.5-codex",
        "deep": "gpt-5.5"
      },
      "claude-code": {
        "fast": "claude-haiku-4.5",
        "deep": "claude-sonnet-4.6"
      },
      "copilot-cli": {
        "fast": "gpt-4.1",
        "deep": "claude-3-7-sonnet-latest"
      },
      "gemini-cli": {
        "fast": "gemini-3-flash",
        "deep": "gemini-3-pro"
      },
      "gemini-code-assist": {
        "fast": "gemini-3-flash",
        "deep": "gemini-3-pro"
      }
    },
    "taskRouting": {
      "architecture": "deep",
      "reasoning": "deep",
      "refactor": "deep",
      "review": "deep",
      "tooling": "fast",
      "frontend": "deep",
      "debug": "deep",
      "pr": "deep",
      "execution": "auto",
      "long_context": "deep",
      "general": "auto"
    }
  }
}
```

Notas:

- `repoPath` se resuelve por `--repo-path` o por la ubicación de `harness.config.json`; el fallback implícito a `cwd` ya no se usa cuando solo existe config global
- si pasas `--config`, esa ruta manda
- `permissionPolicy.mode` soporta `always_allow`, `always_ask` y `allow_list`
- `agentRouting` define defaults del leader para el modo `agent` (provider, effort y fast/deep models)

Ejemplos CLI:

```bash
arufheim-harness config set permissionPolicy.mode always_ask --repo
arufheim-harness config set allowedCommands '["pnpm test","npm test","ls"]' --repo
arufheim-harness config set permissionPolicy.allowedRisk '["R1","R2"]' --repo
arufheim-harness config set ignored '["node_modules/**",".git/**","dist/**"]' --repo
```

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

| Comando                            | Qué hace                                            |
| ---------------------------------- | --------------------------------------------------- |
| `arufheim-harness setup`           | camino recomendado: reconcilia scaffold + health    |
| `arufheim-harness setup --update`  | fuerza reconciliación del scaffold gestionado       |
| `arufheim-harness setup --global`  | configura clientes MCP globales soportados          |
| `arufheim-harness repair`          | autorepara assets/config gestionados por el arnés   |
| `arufheim-harness init`            | bootstrap del repo actual                           |
| `arufheim-harness init --codex`    | bootstrap base + binding repo-scoped de Codex       |
| `arufheim-harness init --claude`   | bootstrap base + archivos Claude                    |
| `arufheim-harness init --copilot`  | bootstrap base + archivos Copilot                   |
| `arufheim-harness init --opencode` | bootstrap base + archivos OpenCode                  |
| `arufheim-harness init --global`   | configura clientes MCP globales (VS Code, Claude, Codex) |
| `arufheim-harness init --update`   | añade secciones faltantes sin sobreescribir         |
| `arufheim-harness doctor`          | valida setup del repo                               |
| `arufheim-harness doctor --json`   | snapshot estructurado estable de health             |
| `arufheim-harness status --brief-minimal --json` | fallback CLI mínimo del startup brief     |
| `arufheim-harness status --brief --json` | fallback CLI rico del startup brief           |
| `arufheim-harness simulate --flow startup --json` | estima costo local del flujo sin tocar `session.json` |
| `arufheim-harness agent ...`       | ejecuta modo agente con proveedor externo           |
| `arufheim-harness tui`             | dashboard de terminal con estado, policy y métricas |
| `arufheim-harness help`            | ayuda rápida                                        |

Flags principales:

- `--repo-path <ruta>`: raíz del repo; obligatoria si no existe `harness.config.json` local
- `--config <ruta>`: ruta explícita a `harness.config.json`

### Modo agente por API

Además del servidor MCP por `stdio`, puedes usar un modo CLI de agente para
resolver una consulta vía provider externo, reutilizando el contexto del
workflow (`.harness/feature_list.json`, `.harness/progress/current.md`, inbox).

Ejemplos:

```bash
# Anthropic / Claude API
ANTHROPIC_API_KEY=... arufheim-harness agent \
  --provider anthropic \
  --model claude-3-7-sonnet-latest \
  --prompt "Resume el siguiente paso de la feature activa"

# OpenAI API
OPENAI_API_KEY=... arufheim-harness agent \
  --provider openai \
  --model gpt-4.1 \
  --prompt "Propón plan técnico para la feature en progreso"

# Copilot CLI (gh copilot)
arufheim-harness agent \
  --provider copilot-cli \
  --prompt "Genera checklist de verificación para la sesión"
```

Flags útiles:

- `--prompt` o `--prompt-file`
- `--system` o `--system-file`
- `--model`, `--base-url`, `--api-key`
- `--temperature`, `--max-tokens`, `--timeout-ms`
- `--with-workflow-context=false` para desactivar contexto del arnés

### Routing de 2 modelos (leader)

El modo `agent` soporta dos lanes:

- `fast`: bajo razonamiento / menor costo para tareas simples
- `deep`: mayor razonamiento para tareas complejas

El leader decide automáticamente en `--effort auto` usando complejidad del
prompt + señales del workflow (blocked/spec_ready/pending). También puedes
forzar comportamiento:

- `--effort low` → usa `fast`
- `--effort high` → usa `deep`
- `--model` → override total del modelo
- `--fast-model` / `--deep-model` → modelos por lane
- `--complexity-threshold <n>` → umbral para pasar a `deep` (default: `3`)

Hints dentro del prompt:

- `@mode:fast` o `#fast`
- `@mode:deep` o `#deep`

Ejemplo:

```bash
ANTHROPIC_API_KEY=... arufheim-harness agent \
  --provider anthropic \
  --fast-model claude-3-5-haiku-latest \
  --deep-model claude-3-7-sonnet-latest \
  --effort auto \
  --complexity-threshold 3 \
  --prompt "Diseña plan de migración de auth y propone rollback #deep"
```

## Qué expone el servidor MCP

### Exploración del repo

- `list_files`
- `read_file`
- `write_file`
- `search_repo`
- `run_command`

### Workflow

- `harness_status`
- `harness_loop_status`
- `harness_loop_event`
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
- `harness://health`
- `harness://loop/active`
- `harness://logs/main`

## Métricas y observabilidad

### `harness_metrics`

Devuelve:

- `estimated_local_tokens`
- `response_output_bytes` / `response_output_tokens`
- conteo de lecturas y escrituras
- conteo de commands
- tools llamadas en la sesión
- breakdown por surface en `response_output_*_by_surface`
- resumen de `PermissionPolicy`

Importante:

- `estimated_local_tokens` es estimación local por bytes leídos y bytes devueltos por surfaces del arnés
- `response_output_*` refleja salida real devuelta por `harness_status`, `status` y otras surfaces que el runtime mida localmente
- no son tokens facturados por Claude, Codex, Copilot u OpenCode
- `arufheim-harness simulate --flow ... --json` sirve para estimar el costo de un flujo candidato sin escribir en `.harness/metrics/session.json`

### `tui`

`arufheim-harness tui` muestra:

- alertas activas
- features
- loop activo
- próximo paso
- inbox
- memoria reciente
- health y binding status
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
npm run release:check
```

`release:check` exige worktree limpio por defecto y usa cache temporal para
empaquetar, instalar el tarball en un repo temporal y validar `setup`, `status`,
`repair` y `doctor` desde el artefacto real, así que no depende de `~/.npm`.
En CI se puede correr con `HARNESS_RELEASE_ALLOW_DIRTY=1` para saltar solo el
gate de worktree limpio sin relajar el resto del chequeo.

Publish real:

1. deja worktree limpio
2. corre `npm run release:check`
3. corre [`manual-release-checklist.md`](./manual-release-checklist.md) si tocaste integraciones cliente o vas a publicar una release importante
4. marca el resultado real en [`release-readiness.json`](./release-readiness.json)
5. corre `npm run release:publish-check`

`release-readiness.json` distingue checks `required` de checks opcionales.
Los opcionales no bloquean publish, pero si decides cubrir uno para la release
debe quedar validado con evidencia real antes de marcarlo como completado.

Si solo quieres depurarlo dentro de una sesión con cambios locales:

```bash
HARNESS_RELEASE_ALLOW_DIRTY=1 npm run release:check
```

Si vienes de una versión anterior y quieres probar el upgrade:

```bash
arufheim-harness doctor
arufheim-harness repair
arufheim-harness doctor
```

Además de `release:check`, la validación de release por clientes vive en
[`manual-release-checklist.md`](./manual-release-checklist.md) y su evidencia
machine-readable en [`release-readiness.json`](./release-readiness.json).
`release:publish-check` exige ambas cosas alineadas antes de publicar.

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · `fast-glob` · `zod`

## Apoya el proyecto

Si te fue útil, puedes invitarme un café ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S0C01ZWS43)
