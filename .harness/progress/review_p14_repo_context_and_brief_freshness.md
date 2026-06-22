# Review — p14_repo_context_and_brief_freshness

## Resultado

Aprobado.

## Puntos revisados

- [x] Un cwd con solo `feature_list.json` ya no dispara scaffold repo-scoped desde `setup --global`.
- [x] Un repo legacy real sigue siendo detectable para el camino híbrido global + repo-scoped preferido.
- [x] `status --brief` deja de devolver un `ok` stale cuando cambia un binding repo-scoped observado.
- [x] El refresh del brief vuelve a persistir `health.json`, evitando quedarse en un estado “siempre stale”.
- [x] Los smokes nuevos pasaron junto con la suite existente.

## Riesgos residuales

- La detección automática sigue siendo heurística; si un repo custom quiere el camino híbrido sin markers suficientes, debe usar `--repo-path` explícito.
- La firma de inputs prioriza bindings, config y workflow observado; si más adelante health empieza a depender de nuevos archivos con parseo propio, esos archivos deben añadirse a la firma para conservar la misma garantía.
