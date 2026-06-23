# Verificación

En harness no basta con decir “arranca”. Hay que demostrarlo.

## Nivel 1

```bash
./scripts/pnpmw.sh typecheck
```

## Nivel 2

```bash
./scripts/pnpmw.sh test
```

## Nivel 3

```bash
./scripts/pnpmw.sh build
```

## Nivel 4

```bash
./scripts/pnpmw.sh smoke
```

El smoke debe demostrar al menos:

- que el server arranca por `stdio`
- que resuelve la config correcta
- que emite el banner por `stderr`

## Policy TDD parcial

Si el repo usa layout `full`, `./init.sh` es un wrapper offline-first:
resuelve `ARUFHEIM_HARNESS_ENTRY` o `arufheim-harness` en PATH y falla cerrado
si no existe un binario local. No descarga el harness vía `npx`.

La regla no es “test primero siempre”, sino elegir la capa de feedback correcta
para el cambio:

- `unit-first`: lógica pura, transitions, parsers, policy, helpers estables
- `contract-first`: salidas públicas de CLI/MCP como `doctor --json`, `status --json`, `simulate --json`
- `smoke-driven`: setup, repair, upgrade, release, stdio, bindings e integraciones entre capas
- `liviano o excepción justificada`: docs, scaffold, prompts o trabajo exploratorio donde todavía no existe contrato claro

Si una requirement observable no deja test rápido razonable:

- documenta la excepción
- deja verificación ejecutable
- explica por qué `smoke` o verificación manual eran la capa correcta

No conviertas el tooling en un preflight universal:

- si el repo ya declara un comando rápido razonable, usa el primer comando real cuando haga falta
- no gastes pasos en `pnpm --version`, `vitest --version` o equivalentes salvo fallo real del comando o trabajo explícito sobre tooling/testing

## Headroom

Si existe `.harness/progress/head_<feature>.md`, úsalo como resumen corto del
intento activo antes de abrir artifacts largos. Debe decirte:

- foco actual de `R<n>`
- fase / intento / review round
- capa de test elegida
- comando rápido sugerido
- siguiente acción esperada

## Paso documental

Si el cambio modifica comportamiento visible, onboarding, comandos o flujo de uso:

- actualiza `README.md` y/o la doc de uso correspondiente
- si no aplica, deja constancia breve en `progress/impl_<feature>.md`

## Paso release

Si el cambio afecta release notes, surface pública, setup, comandos, contrato o
comportamiento que deba aparecer en una publicación:

- actualiza `CHANGELOG.md`
- o deja constancia breve en `progress/impl_<feature>.md` de por qué no aplica

## Cierre

1. Deja evidencia de la verificación relevante, incluyendo la capa rápida elegida o la excepción.
2. Confirma que README/docs quedaron alineados o documenta por qué no aplica.
3. Confirma que `CHANGELOG.md` quedó alineado si el cambio es release-facing o documenta por qué no aplica.
4. Corre:

```bash
./init.sh
```

Si `./init.sh` falla, no se cierra la feature como `done`.

Si `pnpm` no está en PATH, `./scripts/pnpmw.sh` intenta usar `corepack pnpm`.
Si tampoco hay Corepack, instala `pnpm` con `npm` o `yarn` antes de verificar.
