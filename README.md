# arufheim-hermess

Servidor MCP local que expone herramientas seguras sobre cualquier repositorio. Se integra con **GitHub Copilot**, **Claude Code** y cualquier cliente compatible con MCP.

## Instalación

```bash
npm install -g arufheim-hermess
```

## Desarrollo del repo

Este repo usa `pnpm` como package manager de desarrollo.

Si `pnpm` no está instalado en tu máquina, puedes bootstrapearlo de cualquiera
de estas formas:

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

`npm` y `yarn` sirven para instalar `pnpm`, pero no reemplazan el lockfile ni
el flujo de verificación de este repo.

## Configuración inicial

Después de instalar, configura los clientes MCP de forma global:

```bash
arufheim-hermess init --global
```

El asistente detecta qué clientes tienes instalados (VS Code, Claude Desktop, Claude Code) y los configura automáticamente.

Para inicializar un repo en particular (crea `.vscode/mcp.json` e `inbox/` de forma local):

```bash
cd /ruta/al/repo
arufheim-hermess init
```

## Configuración por repo (equipo)

Para que VS Code apunte al repo correcto, agrega este archivo en la raíz del proyecto:

**`.vscode/mcp.json`**

```json
{
  "servers": {
    "hermess": {
      "type": "stdio",
      "command": "npx",
      "args": ["arufheim-hermess", "--repo-path", "${workspaceFolder}"]
    }
  }
}
```

`${workspaceFolder}` lo resuelve VS Code al abrir el proyecto. Para Claude Desktop y Claude Code el servidor usa el directorio de trabajo actual como raíz del repo.

## Configuración opcional por repo

Para personalizar los comandos permitidos o los archivos ignorados, agrega un `hermess.config.json` en la raíz del repo:

```json
{
  "allowedCommands": ["pnpm test", "npm test", "yarn test", "ls", "pwd"],
  "ignored": ["node_modules/**", ".git/**", "dist/**"]
}
```

> `repoPath` no es necesario cuando se usa `--repo-path`; si existe en el config, se ignora.

## Argumentos CLI

| Argumento            | Env var             | Descripción                                                             |
| -------------------- | ------------------- | ----------------------------------------------------------------------- |
| `--repo-path <ruta>` | `HERMESS_REPO_PATH` | Raíz del repo a operar. Si se omite, usa el directorio de trabajo.      |
| `--config <ruta>`    | `HERMESS_CONFIG`    | Ruta explícita al `hermess.config.json`.                                |
| `init`               | —                   | Inicializa un repo local.                                               |
| `init --global`      | —                   | Configura clientes MCP globales (VS Code, Claude Desktop, Claude Code). |

## Herramientas disponibles

| Herramienta   | Descripción                                               |
| ------------- | --------------------------------------------------------- |
| `list_files`  | Lista archivos del repo respetando los patrones ignorados |
| `read_file`   | Lee un archivo dentro del repo                            |
| `search_repo` | Búsqueda de texto en el repo                              |
| `run_command` | Ejecuta un comando de la allowlist                        |

## Resources disponibles

| URI                         | Descripción                              |
| --------------------------- | ---------------------------------------- |
| `hermess://config/raw`      | Contenido del `hermess.config.json` o texto vacío si no existe |
| `hermess://config/resolved` | Config efectivo tras resolución de paths |
| `hermess://logs/main`       | Últimas líneas del log JSONL             |

## Seguridad

- Todas las rutas se validan dentro de `repoPath` — sin path traversal
- Symlinks que apunten fuera de `repoPath` quedan bloqueados
- `run_command` solo ejecuta comandos presentes en `allowedCommands`
- `run_command` devuelve error MCP si el comando termina con `exitCode != 0`
- `node_modules`, `.git`, `dist` y `.hermess` se ignoran por defecto
- Timeout de 30 s y `maxBuffer` limitado en comandos
- Logs en `.hermess/logs/hermess.jsonl`

## Conectar a Claude Code de forma manual

```bash
claude mcp add hermess npx arufheim-hermess
```

Para apuntar a un repo específico:

```bash
claude mcp add hermess npx arufheim-hermess -- --repo-path /ruta/al/repo
```

## Stack

TypeScript · Node.js · `@modelcontextprotocol/sdk` · `fast-glob` · `zod`
