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

## Cierre

```bash
./init.sh
```

Si `./init.sh` falla, no se cierra la feature como `done`.

Si `pnpm` no está en PATH, `./scripts/pnpmw.sh` intenta usar `corepack pnpm`.
Si tampoco hay Corepack, instala `pnpm` con `npm` o `yarn` antes de verificar.
