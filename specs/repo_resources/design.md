# Design: repo_resources

## Resumen

La feature añade dos resources MCP estáticos al servidor existente:

- un resource para la config resuelta de Hermess
- un resource para el log JSONL de Hermess

No cambia el transporte, no añade tools nuevas y no modifica la semántica de las tools actuales.

## Archivos a tocar

- `src/index.ts`
- `src/logger.ts`
- `src/safety.ts`
- `README.md`
- opcionalmente `src/resources.ts` o `src/resources/*.ts` si conviene aislar el registro

## Diseño propuesto

### 1. URIs estáticas de resource

Registrar dos resources estáticos con `server.registerResource(...)`.

URIs candidatas:

- `hermess://config/resolved`
- `hermess://logs/main`

La elección de URIs estáticas evita introducir templates o variables antes de necesitarlas.

### 2. Lectura de contenido

#### Config

- Reusar `config.configPath`
- Leer el archivo actual desde disco en cada `read`
- Devolver contenido de texto UTF-8

#### Logs

- Reusar `logger.logFilePath`
- Si el archivo existe, devolver el contenido actual
- Si no existe, devolver texto vacío y metadata de “not found yet” sin fallar

### 3. Logging

Cada lectura de resource deja dos eventos:

- `resource_read_started`
- `resource_read_finished`

Payload mínima:

- `resource`
- `uri`
- `ok`
- `durationMs`
- `exists` cuando aplique

Esto preserva simetría con las tools sin inventar un subsistema nuevo de observabilidad.

### 4. Seguridad

- La ruta de config ya queda fijada en `config.configPath`
- La ruta del log sale de `logger.logFilePath`
- Antes de leer desde disco, ambas rutas deben validarse con helper de confinamiento a `repoPath`
- No se exponen resources parametrizados ni rutas arbitrarias del filesystem

## Firmas nuevas

Una de estas dos opciones es suficiente:

### Opción A

Agregar en `src/index.ts` el registro inline de ambos resources.

### Opción B

Crear helper explícito:

```ts
registerRepoResources(server: McpServer, config: ResolvedHermessConfig, logger: JsonlLogger): void
```

La opción B es preferible porque mantiene `src/index.ts` pequeño y deja el patrón listo para futuros resources.

## Restricciones

- No tocar `stdout` fuera del protocolo MCP
- No añadir endpoints HTTP
- No añadir config nueva al usuario para esta feature
- No introducir dependencia circular entre `config`, `logger` y resources

## Alternativa descartada

Exponer una tool `read_log` y otra `read_config`.

Se descarta porque:

- ya existe el concepto MCP adecuado: resources
- resources comunican mejor que son de solo lectura
- evita inflar el namespace de tools con operaciones pasivas

## Verificación prevista

- `pnpm typecheck`
- `pnpm build`
- `pnpm smoke`
- prueba manual con Inspector o cliente MCP listando resources
- lectura manual de `hermess://config/resolved`
- lectura manual de `hermess://logs/main` con y sin archivo existente

