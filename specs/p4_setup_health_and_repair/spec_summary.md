Goal: volver `arufheim-harness` una infra resuelta y observable con `setup`, `repair` y health compartido sin quitar backlog, memoria, SDD ni bindings.
Touch: CLI (`index`, `init`, `doctor`, `help`), `harness_status`, `harness://health`, TUI, banner, smoke y README.
Constraints: compatibilidad hidden/legacy, `init.sh` sigue gate fuerte, `repair` solo toca assets/config del arnés, binding peligroso sigue fail-closed.
Verify: `npm run typecheck`, `npm run build`, `npm run smoke`, `./init.sh`.
Tasks: T1 spec; T2 health model + doctor estructurado; T3 setup/repair; T4 status/resource/TUI/banner; T5 docs+smoke; T6 verificación+cierre.
