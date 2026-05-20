# Design: init_sdd_agents

## Resumen

La feature extiende `init` para dejar prompts SDD listos tanto para Copilot
como para Claude, sin depender de archivos internos del repo de desarrollo.

## Archivos a tocar

- `src/init.ts`
- `README.md`

## Diseño propuesto

### 1. Templates inline versionados

Guardar el contenido de prompts/agentes como templates dentro de `src/init.ts`,
todos con un marcador compartido `<!-- harness-agents-v1 -->`.

### 2. Escritura por target

- `--copilot`: `.github/prompts/*.prompt.md`
- `--claude`: `.claude/agents/*.md`
- ambos: `AGENTS.md`

### 3. Política de update

- si el archivo no existe: crear
- si existe y no contiene el marker esperado: reescribir
- si existe y ya contiene el marker: dejarlo intacto

## Alternativa descartada

Copiar archivos desde el repo fuente en tiempo de ejecución.

Se descarta porque acopla el bootstrap al árbol local del paquete y dificulta
mantener una única versión portable dentro del bin distribuido.
