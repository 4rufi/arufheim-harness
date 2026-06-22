# Verificación

En harness no basta con decir “arranca”. Hay que demostrarlo.

## Nivel 1

```bash
./scripts/pnpmw.sh typecheck
```

## Nivel 2

```bash
./scripts/pnpmw.sh build
```

## Nivel 3

```bash
./scripts/pnpmw.sh smoke
```

El smoke debe demostrar al menos:

- que el server arranca por `stdio`
- que resuelve la config correcta
- que emite el banner por `stderr`

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

1. Deja evidencia de la verificación relevante.
2. Confirma que README/docs quedaron alineados o documenta por qué no aplica.
3. Confirma que `CHANGELOG.md` quedó alineado si el cambio es release-facing o documenta por qué no aplica.
4. Corre:

```bash
./init.sh
```

Si `./init.sh` falla, no se cierra la feature como `done`.

Si `pnpm` no está en PATH, `./scripts/pnpmw.sh` intenta usar `corepack pnpm`.
Si tampoco hay Corepack, instala `pnpm` con `npm` o `yarn` antes de verificar.
