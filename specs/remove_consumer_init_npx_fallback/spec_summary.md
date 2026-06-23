# Goal

Evitar que repos consumidores dependan de `npx`/red para pasar su `init.sh` scaffoldeado.

# Touch

`src/init.ts`, `scripts/smoke-stdio.mjs`, `README.md` y ayuda relacionada.

# Constraints

No tocar el `init.sh` interno del repo harness; solo el scaffold consumidor.

# Verify

`typecheck`, `test`, `build`, `smoke`, `./init.sh`
