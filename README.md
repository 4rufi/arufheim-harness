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

- inicializa un repo con layout canónico en `.harness/` y wrappers repo-locales mínimos; `thin` es el default para repos nuevos y `full` sigue disponible cuando quieres materializar todo el scaffold largo
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

## Inicio rápido

### 1. Configura la máquina una vez

Instala o actualiza el CLI global y siembra el runtime gestionado:

```bash
npm install -g arufheim-harness@latest
arufheim-harness setup --global-runtime
```

Esto crea un runtime user-local en `~/.config/arufheim-harness/` en macOS/Linux
o `%APPDATA%/arufheim-harness/` en Windows. Los proyectos no necesitan declarar
`arufheim-harness` como dependencia local.

### 2. Configura cada repo

```bash
cd /ruta/al/repo
arufheim-harness setup --repo-path .
arufheim-harness verify --repo-path .
```

`setup` usa `thin` por defecto en repos consumidores. Eso deja visible solo el
estado del repo, wrappers mínimos y bindings cliente; las docs largas viven en
el runtime compartido.

### 3. Abre el cliente

Abre o recarga el repo en Codex, VS Code, Claude Code u OpenCode. En el primer
arranque fuerza una llamada a:

```text
harness_status(mode: "brief_minimal")
```

Confirma que `repo_path` sea el repo abierto antes de mutar estado. Después:

```bash
arufheim-harness verify --repo-path .
```

Si `verify` queda verde, el repo está operativo. Clientes no configurados pueden
aparecer como `missing`; eso no bloquea si no los usas.

## Actualizar un repo existente

```bash
npm install -g arufheim-harness@latest
arufheim-harness setup --global-runtime

cd /ruta/al/repo
arufheim-harness setup --repo-path . --update
arufheim-harness migrate --repo-path . --to thin
arufheim-harness repair --repo-path .
arufheim-harness verify --repo-path .
```

`setup --update` reconcilia el layout actual. `migrate --to thin` es el paso
explícito que baja el ruido del repo.

Si `migrate` reporta `preserved_override`, el harness preservó archivos que
difieren del scaffold gestionado para no borrar contenido humano. Si confirmas
que no necesitas esos overrides, puedes podarlos manualmente:

```bash
mkdir -p /tmp/harness-thin-backup
cp -R .harness-docs CHECKPOINTS.md init.sh /tmp/harness-thin-backup/ 2>/dev/null || true
rm -rf .harness-docs
rm -f CHECKPOINTS.md init.sh
arufheim-harness repair --repo-path .
arufheim-harness verify --repo-path .
```

No borres `harness.config.json`, `.harness/`, `.harness/runtime/launch-global-runtime.mjs`
ni el binding del cliente que usas.

## Elegir clientes

Por defecto `setup` configura todos los clientes soportados cuando corresponde.
Para limitar el ruido a un solo cliente:

```bash
arufheim-harness setup --repo-path . --clients codex
```

Clientes soportados:

- `codex`
- `copilot`
- `claude`
- `opencode`

Si quieres todos explícitamente:

```bash
arufheim-harness setup --repo-path . --clients all
```

## Global clients opcionales

El camino recomendado es repo-scoped: configurar cada repo con `setup`. Usa
bindings globales solo si quieres dejar clientes globales preconfigurados en la
máquina:

```bash
arufheim-harness setup --global
```

Para un repo concreto:

```bash
arufheim-harness setup --global --repo-path /ruta/al/repo
```

Si una config global gestionada está rota:

```bash
arufheim-harness repair --global --clients codex --force-managed-global
```

`setup --global` y `repair --global` fallan cerrado ante configs inválidas por
defecto. Con `--force-managed-global`, el harness crea backup y regenera solo la
entrada gestionada.

## Thin vs full

- `thin`: default para repos consumidores; conserva `.harness/`, wrappers mínimos
  y bindings repo-scoped.
- `full`: materializa `.harness-docs/`, `CHECKPOINTS.md`, `init.sh`, prompts y
  agentes largos dentro del repo.

```bash
arufheim-harness setup --repo-path . --layout full
```

Usa `full` para debugging, inspección, entrenamiento del equipo o desarrollo del
propio harness.

## Cuando algo falla

Inspección:

```bash
arufheim-harness doctor
arufheim-harness doctor --json
```

Autoreparación de assets/config gestionados:

```bash
arufheim-harness repair --repo-path .
```

Snapshot CLI cuando el frontend no cargó tools MCP:

```bash
arufheim-harness status --brief-minimal --json
```

Snapshot con activation/client readiness:

```bash
arufheim-harness status --brief --json
```

Docs compartidas en layout `thin`:

```bash
arufheim-harness docs list
arufheim-harness docs show verification
```

Si hay una feature activa, `doctor --json`, `status --json`, `harness_status` y `harness://health`
exponen también `loop_summary`. Para consultar el estado detallado del intento actual
usa `harness_loop_status` o `harness://loop/active`.

## Feedback Rápido y Headroom

El harness formaliza TDD como disciplina parcial por capas dentro del loop, no
como ritual universal.

- `unit-first`: lógica pura, reducers, parsers, policy, loop transitions y helpers
- `contract-first`: salidas públicas estables como `doctor --json`, `status --json`, `simulate --json` y shapes MCP
- `smoke-driven`: `setup`, `repair`, `upgrade`, release, stdio, bindings y cruces entre capas
- `liviano o excepción justificada`: docs, scaffold, prompts y trabajo exploratorio donde el contrato todavía no está claro

Si una requirement observable no tiene test rápido razonable, el flujo correcto
es dejar excepción justificada más verificación ejecutable, no inventar un test
frágil.

`testing.fastCommand` e `integrationCommand` no significan “chequéalos siempre
antes de editar”. Significan “si este cambio necesita feedback rápido o cierre
de integración y el repo ya declara esos comandos, usa el primer comando real
que corresponda”.

En particular, el harness no debería empujar preflights de tooling como
`pnpm --version` o `vitest --version` salvo que estés depurando el propio stack
de testing o el primer comando real haya fallado.

Además, cuando una feature queda `in_progress`, el harness mantiene un artifact
interno corto:

- `.harness/progress/head_<feature>.md`

Ese archivo resume:

- fase, intento y review round
- `R<n>` activas
- capa de test elegida
- comando rápido recomendado
- último `error_signature`
- último `strategy_delta`
- archivos mínimos a abrir
- siguiente acción esperada

`agent`, prompts y adapters lo usan antes de abrir artifacts largos.

Autoreparación de assets/config gestionados por el arnés:

```bash
arufheim-harness repair
```

Verificación estricta del repo consumidor:

```bash
arufheim-harness verify --repo-path .
```

Si el repo está en layout `full`, `./init.sh` sigue existiendo como wrapper
estricto del doctor local. Úsalo solo cuando el binario ya está disponible vía
`ARUFHEIM_HARNESS_ENTRY` o `arufheim-harness` en `PATH`; ese wrapper ya no hace
fallback a `npx`.

Qué valida:

- archivos base del arnés
- shape de `feature_list.json`
- presencia de specs SDD cuando corresponde
- evidencia de implementación/review para features cerradas
- `typecheck`, `test`, `build` y `smoke`

## Primitives avanzadas

`setup` es la entrada recomendada. `init` sigue existiendo como primitive compatible
cuando necesitas bootstrap o migración de más bajo nivel.

Semántica:

- `setup`: converge al estado listo con el menor cambio necesario
- `setup` en repos nuevos usa `thin` por defecto; es el layout recomendado para repos consumidores
- `setup --update`: fuerza reconciliación dentro del layout actual del repo; no migra entre `thin` y `full`
- `migrate --to thin`: migra un repo existente al layout `thin` de forma explícita, segura y con pruning solo de assets gestionados
- `repair`: repara solo assets/config gestionados por el arnés
- `verify`: gate estricto del repo consumidor sin depender de `init.sh`
- `docs list` / `docs show <topic>`: exponen la documentación compartida del harness cuando el repo está en `thin`
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
estado al layout actual sin borrar los archivos legacy. Si luego quieres bajar
ruido del repo, usa la migración explícita:

```bash
arufheim-harness migrate --to thin
```

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
- `.harness/progress/head_<feature>.md`: resumen corto y reescribible del intento activo

### Cuándo usar SDD

Usa `sdd: true` si implementar mal la feature cuesta más que escribir el spec.

Disparadores fuertes:

- seguridad o boundaries
- tool, command o resource nueva
- cambio de contrato, estado o flujo
- cambio multiarchivo con comportamiento observable

La política completa vive en `specs_policy`, accesible como archivo local en
layout `full` o vía `arufheim-harness docs show specs_policy` en layout `thin`.

## Contratos del arnés

En layout `full`, el repo bootstrappeado materializa `.harness-docs/` con:

- `specs.md` y `specs_policy.md`: flujo SDD y regla para decidir `sdd: true`
- `model_interface.md`, `context_manager.md`, `execution_engine.md`, `memory_system.md`, `orchestration.md`
- `tool_catalog.md`, `observation_policy.md`, `planning_model.md`
- `budgets.md`, `contract_versions.md`, `frontend_adapters.md`, `loop_contract.md`

En layout `thin`, esos mismos contratos viven en el runtime compartido del
harness y se consultan con:

```bash
arufheim-harness docs list
arufheim-harness docs show verification
```

Ese layout `thin` es el default recomendado para repos consumidores: mantiene
el contrato accesible, baja el ruido del repo y evita duplicar documentación
interna del harness por proyecto.

No necesitas leer todo eso para usar el arnés día a día. Son el contrato del
sistema y sirven sobre todo cuando cambias el propio harness o depuras
comportamiento.

## Conectar clientes

### VS Code

El bootstrap ya deja `.vscode/mcp.json` en el repo. Si necesitas escribirlo a mano:

```json
{
  "servers": {
    "arufheim-harness": {
      "type": "stdio",
      "command": "node",
      "args": [".harness/runtime/launch-global-runtime.mjs", "--repo-path", "${workspaceFolder}", "--client", "vscode"]
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
claude mcp add --scope project harness -- node .harness/runtime/launch-global-runtime.mjs --repo-path . --client claude-code
```

Manual apuntando a un repo específico:

```bash
claude mcp add --scope project harness -- node /ruta/al/repo/.harness/runtime/launch-global-runtime.mjs --repo-path /ruta/al/repo --client claude-code
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

- puede escribir `~/.codex/config.toml` con un server MCP explícito apuntando al shim global gestionado
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
  "testing": {
    "fastCommand": "pnpm test:unit",
    "integrationCommand": "pnpm smoke"
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
- `testing.fastCommand` y `testing.integrationCommand` permiten fijar la capa rápida e integración sin depender de autodetección
- si no configuras `testing.*`, `setup`/`repair` intentan autodetectar scripts/configs del repo y solo recomiendan `Vitest` cuando detectan un repo JS/TS sin suite rápida
- `agentRouting` define defaults del leader para el modo `agent` (provider, effort y fast/deep models)

Ejemplos CLI:

```bash
arufheim-harness config set permissionPolicy.mode always_ask --repo
arufheim-harness config set allowedCommands '["pnpm test","npm test","ls"]' --repo
arufheim-harness config set permissionPolicy.allowedRisk '["R1","R2"]' --repo
arufheim-harness config set ignored '["node_modules/**",".git/**","dist/**"]' --repo
arufheim-harness config set testing.fastCommand "pnpm test:unit" --repo
arufheim-harness config set testing.integrationCommand "pnpm smoke" --repo
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
pnpm test
pnpm smoke
pnpm verify
```

`npm` o `yarn` aquí sirven para instalar `pnpm`; el workflow de desarrollo de este repo usa `pnpm`.
`pnpm verify` corre `typecheck -> test -> build -> smoke`.

## Antes de publicar

Checklist corto:

```bash
npm run release:check
```

`release:check` exige worktree limpio por defecto y usa cache temporal para
empaquetar, instalar el tarball en un repo temporal y validar `setup`, `status`,
`repair`, `doctor` y `docs show` desde el artefacto real. Además retira el
paquete sembrador antes de ejecutar el shim global, así que comprueba que el
runtime bundle siga siendo autocontenido de verdad.
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
