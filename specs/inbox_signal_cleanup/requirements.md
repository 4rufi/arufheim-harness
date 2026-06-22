# Requirements

R1. El sistema DEBE tratar `README.md` del inbox como archivo reservado y NO como trabajo pendiente.
R2. El sistema DEBE excluir archivos reservados del conteo y listado de inbox en `inbox_list`.
R3. El sistema DEBE excluir archivos reservados del snapshot de `harness_status`.
R4. El sistema DEBE excluir archivos reservados del `WorkflowBrief` usado por `agent`.
R5. El sistema DEBE excluir archivos reservados del panel Inbox del `tui`.
R6. `inbox_consume` NO DEBE consumir archivos reservados del inbox.
R7. El smoke DEBE verificar que el inbox visible en tools/status excluye `README.md`.
