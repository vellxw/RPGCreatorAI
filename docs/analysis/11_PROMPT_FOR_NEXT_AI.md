# 11 - PROMPT PARA SIGUIENTE IA

## Propósito
Este documento proporciona el prompt completo para que otra IA pueda continuar el trabajo de análisis y solución de los problemas encontrados.

---

## PROMPT MAESTRO

```markdown
# RPGCreatorAI - Análisis y Fix de Bugs

## Contexto

Has sido asignado a continuar el trabajo de análisis exhaustivo del codebase de RPGCreatorAI. Un análisis previo identificó ~85 problemas distribuidos en:
- 10 bugs críticos
- 10 bugs altos
- 6 problemas de arquitectura
- ~40 code smells
- ~50 magic numbers
- 3 memory leaks
- 2 vulnerabilidades de seguridad
- 3 documentos desactualizados

## Archivos de Análisis

Todo el detalle está en `docs/analysis/`:
- `00_INDEX.md` - Índice maestro
- `01_CRITICAL_BUGS.md` - 10 bugs críticos con fix sugeridos
- `02_HIGH_PRIORITY_BUGS.md` - 10 bugs altos
- `03_ARCHITECTURE_ISSUES.md` - 6 problemas de arquitectura
- `04_CODE_SMELLS.md` - Code smells principales
- `05_MAGIC_NUMBERS.md` - Catálogo de magic numbers
- `06_MEMORY_LEAKS.md` - 3 memory leaks
- `07_PATH_TRAVERSAL_SECURITY.md` - 2 vulnerabilidades
- `08_DOCS_OUTDATED.md` - Docs desactualizadas
- `09_FILE_INVENTORY.md` - Inventario de archivos
- `10_QUICK_WINS.md` - 10 fixes rápidos

## Tu Misión

### Fase 1: Verificación (OBLIGATORIO)
Antes de hacer cualquier fix, debes:
1. Leer cada archivo de análisis
2. Ir al código fuente mencionado
3. Verificar que el bug realmente existe
4. Confirmar la línea exacta y el contexto

**NO hagas fixes sin verificar primero.**

### Fase 2: Priorización
Orden de trabajo recomendado:
1. **CRITICAL_BUGS** primero (archivo 01)
2. **QUICK_WINS** segundo (archivo 10) - son rápidos
3. **HIGH_PRIORITY_BUGS** tercero (archivo 02)
4. **DOCS_OUTDATED** cuarto (archivo 08) - muy simple
5. **Arquitaura** y code smells después

### Fase 3: Aplicación de Fixes
Para cada fix:
1. Hacer el cambio en el código
2. Build para verificar que compila
3. Run tests si existen
4. Marcar como completado en el checklist

### Fase 4: Validación
Al finalizar:
1. Ejecutar build completo: `cmake --build build`
2. Si hay errores de compilación, corregir
3. Ejecutar tests: `ctest --output-on-failure`
4. Actualizar los archivos .md con los fixes completados
5. Hacer commit con mensaje descriptivo

## Reglas de Operación

### SIEMPRE:
- Lee el archivo de análisis completo antes de empezar
- Verifica el bug en el código real
- Build después de cada fix o grupo de fixes
- Actualiza el checklist en los archivos .md
- Commit cuando tengas un grupo de fixes completados

### NUNCA:
- No hagas cambios sin leer el análisis primero
- No asumas que el bug existe sin verificar
- No hagas commit de código que no compila
- No mezcles múltiples fixes no relacionados en un commit
- No uses archivos sin leer el contexto

## Estructura de Commits Sugerida

```
fix(critical): prevent integer underflow in EventRunner loop
fix(critical): add path traversal protection in SaveManager
fix(high): add validation for map dimensions in MapLoader
docs: update ROADMAP.md to Phase 12
refactor: extract magic numbers to GameConstants.h
```

## Recursos

- CMakeLists.txt: `CMakePresets.json` tiene las configuraciones de build
- Scripts de dev: `scripts/dev/`
- Tests: `tests/` (usar ctest)
- Validación log: `docs/VALIDATION_LOG.md`

## Verificación de Build

```bash
# Configure
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug

# Build
cmake --build build

# Test
ctest --test-dir build --output-on-failure
```

## Checklist de Progreso

Al terminar, reporta:
1. ¿Cuántos bugs críticos fixaste?
2. ¿Cuántos bugs altos fixaste?
3. ¿Cuántos code smells corregiste?
4. ¿Cuántos magic numbers extrajiste?
5. ¿El build pasa?
6. ¿Los tests pasan?
7. ¿Hiciste commit?
8. ¿Push a origin/main?

## Empezar

Lee `docs/analysis/00_INDEX.md` primero para obtener el panorama completo.
```

---

## PROMPT SIMPLIFICADO (para uso rápido)

```markdown
## Tu Tarea

1. Lee `docs/analysis/00_INDEX.md` para contexto
2. Ve a `docs/analysis/01_CRITICAL_BUGS.md` y aplica los 10 fixes críticos
3. Luego ve a `docs/analysis/10_QUICK_WINS.md` y aplica los 10 quick wins
4. Build y test después de cada grupo
5. Commit cuando esté todo verde

## Validación
```bash
cmake -S . -B build && cmake --build build && ctest --test-dir build
```

## Reglas
- Siempre verificar el bug antes de fix
- Nunca commitear código que no compila
- Actualizar checklists en archivos .md
```

---

## Checklist para Esta IA

- [x] Análisis completado con 12 subagentes
- [x] ~85 problemas identificados
- [x] 11 archivos .md creados en docs/analysis/
- [ ] Siguiente IA ejecuta el plan
- [ ] Bugs críticos fixeados
- [ ] Bugs altos fixeados
- [ ] Build pasando
- [ ] Tests pasando
- [ ] Commit realizado
- [ ] Push a origin/main