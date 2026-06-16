# 08 - DOCUMENTACIÓN DESACTUALIZADA

## Resumen
3 documentos que necesitan actualización urgente.

---

## DOC-001: ROADMAP.md - Contradice Phase Actual

**Archivo**: `docs/ROADMAP.md`
**Línea**: 5

### Problema
```
Phase 11 (Current)
```

Debería decir:
```
Phase 12 (Current) - Product UX And AI Studio
```

### Fuentes de Verdad
- `docs/GOAL_STACK.md` línea 5: "Phase 12 — Product UX And AI Studio — ACTIVE"
- `AGENTS.md`: "Current Phase: Phase 12"
- `docs/PHASE_12_ROADMAP_SUCCESS_METRICS.md`: Existe y está actualizado

### Acción Requerida
Actualizar ROADMAP.md para reflejar Phase 12.

---

## DOC-002: LINEAR_MVP_CODEX_GOAL_PROMPT.md - Obsoleto

**Archivo**: `docs/agent_prompts/LINEAR_MVP_CODEX_GOAL_PROMPT.md`

### Problema
- Diseñado para proyecto "RPGCreatorAI Usable MVP" (FRA-5 a FRA-35)
- Esas issues ya fueron completadas en Phase 10-11
- No hay equivalente para Phase 12 (PX-001 a PX-250)

### Acción Requerida
1. Archivar el archivo con nota "Obsoleto - para referencia histórica"
2. Crear nuevo prompt equivalente para Phase 12 si es necesario

---

## DOC-003: PHASE_2_AUTONOMOUS_IMPLEMENTATION.md - Desactualizado

**Archivo**: `docs/agent_prompts/PHASE_2_AUTONOMOUS_IMPLEMENTATION.md`

### Problema
- Protocolo de Phase 2 (Visible Playable RPG Runtime MVP)
- Contiene reglas operacionales antiguas
- No refleja el estado actual de Phase 12

### Comparación
| Tema | Phase 2 Prompt | AGENTS.md (Actual) |
|------|----------------|-------------------|
| AI | "future layer" | AI Studio en Phase 12 |
| ECS | "Do not introduce" | Mantenido |
| Scripting | "Do not introduce" | Mantenido |

### Acción Requerida
1. Archivar con nota de obsolescencia
2. O actualizar si hay reglas útiles que aún aplican

---

## Documentos que Podrían Mejorarse

### AI_WORKFLOWS.md
- No menciona AI Studio como nuevo workspace de Phase 12
- Podría beneficiarse de una sección sobre AI Studio

### BUILD_AND_RUN.md
- No lista el script `smoke-packaged-executable-launch.ps1` creado en PX-012

### VALIDATION_LOG.md
- Muy largo (1500+ líneas) sin índice
- Difícil de navegar

---

## Checklist de Docs Actualizadas

- [ ] DOC-001: Actualizar ROADMAP.md a Phase 12
- [ ] DOC-002: Archivar LINEAR_MVP_CODEX_GOAL_PROMPT.md
- [ ] DOC-003: Archivar PHASE_2_AUTONOMOUS_IMPLEMENTATION.md
- [ ] Opcional: Actualizar AI_WORKFLOWS.md con AI Studio
- [ ] Opcional: Agregar script a BUILD_AND_RUN.md
- [ ] Opcional: Crear índice para VALIDATION_LOG.md