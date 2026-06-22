# Review — flow_release_changelog_step

## Resultado

Aprobado.

## Puntos revisados

- [x] El flujo principal del harness ahora incluye explícitamente `tests+README+CHANGELOG` antes de `done`.
- [x] La regla quedó reflejada en docs vivas, prompts, comandos y templates de `init`.
- [x] `setup --update` podrá propagar el cambio porque el marker de agentes subió a `v3`.
- [x] La compatibilidad de lectura no se rompe: `promptBody()` acepta prompts con markers previos.
- [x] El scaffold de `.harness/progress/current.md` vuelve a coincidir con el contrato documentado del repo.
- [x] `./init.sh` quedó verde después de los cambios.
