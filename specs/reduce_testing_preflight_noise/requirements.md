# Requirements

- R1. El harness DEBE enseñar que la suite rápida es feedback contextual del repo y del cambio, no un preflight universal antes de editar.
- R2. Los prompts del implementer y templates gestionados NO DEBEN sugerir chequeos de versión/binario como `pnpm --version` o `vitest --version` salvo que falle el primer comando real o el cambio toque tooling/testing.
- R3. La guidance derivada de `testing.fastCommand` / `testing.integrationCommand` DEBE decir explícitamente que esos comandos se usan cuando el repo ya los declara o cuando el cambio necesita feedback rápido.
- R4. El headroom interno DEBE reducir la presión sobre `Vitest`/`pnpm` y expresar la siguiente acción en términos de “usa el comando real si aplica”, no “verifica primero si existe”.
- R5. README, docs y checkpoints DEBEN mantener la policy de TDD parcial por capas sin introducir ruido operativo innecesario para repos que no usan `pnpm` o no requieren test rápido inmediato.
