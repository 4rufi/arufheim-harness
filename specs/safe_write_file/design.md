# Design: safe_write_file

## Resumen

La feature añade una tool MCP `write_file` para escritura de texto dentro del
repo. Reusa el logger existente y el boundary centralizado de seguridad.

## Archivos a tocar

- `src/index.ts`
- `src/tools/write-file.ts`
- `src/safety.ts`
- `scripts/smoke-stdio.mjs`
- `README.md`

## Diseño propuesto

### 1. Tool MCP explícita

Registrar `write_file` en el servidor con:

- `path`
- `content`
- `append?`

### 2. Boundary de seguridad

- Solo rutas relativas
- Validación léxica de descenso desde `repoPath`
- Validación canónica del directorio padre
- Rechazo explícito de symlinks en el inode final del destino

### 3. Logging

Cada escritura deja el patrón estándar:

- `tool_call_started`
- `tool_call_finished`

### 4. Verificación

- smoke de escritura normal
- smoke de rechazo a symlink externo
- `typecheck`, `build`, `smoke`

## Alternativa descartada

Permitir escritura arbitraria con solo `path.resolve()`.

Se descarta porque no protege contra symlinks ya existentes ni garantiza que el
destino final permanezca dentro de `repoPath`.
