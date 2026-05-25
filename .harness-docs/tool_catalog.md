# Tool Catalog

Agrupa las tools del arnés por dominio y riesgo.

## workflow

- `harness_status`
- `harness_update`
- `harness_add`
- `harness_log`
- `harness_metrics`
- `progress_set_plan`
- `progress_next_step`
- `history_append`
- `inbox_list`
- `inbox_consume`

## memory

- `mem_context`
- `mem_search`
- `mem_get_observation`
- `mem_save`
- `mem_session_summary`

## repo

- `read_file`
- `list_files`
- `search_repo`
- `write_file`

## execution

- `run_command`

## resources / diagnostics

- `doctor`
- `help`
- `tui` (estado, policy y métricas locales)

## Risk classes v1

- `R0 read-only`
  - ejemplo: `read_file`, `list_files`, `search_repo`, `harness_status`, `mem_context`
- `R1 local structured mutation`
  - ejemplo: `progress_*`, `history_append`, `harness_add`, `harness_update`, `mem_save`
- `R2 local content mutation`
  - ejemplo: `write_file`, `inbox_consume`
- `R3 command execution / external side effect`
  - ejemplo: `run_command`

## Regla

- empieza por `R0`
- sube de riesgo solo si hace falta
- si una acción `R2` o `R3` falla sin señal nueva, no la repitas en loop
