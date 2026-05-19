# Verificación

En Hermess no basta con decir “arranca”. Hay que demostrarlo.

## Nivel 1

```bash
pnpm typecheck
```

## Nivel 2

```bash
pnpm build
```

## Nivel 3

```bash
pnpm smoke
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

