# 10 - QUICK WINS

## Resumen
Fixes rápidos que pueden hacerse con mínimo esfuerzo y bajo riesgo.

---

## QW-001: Crear Archivo de Constantes

**Tiempo estimado**: 30 minutos
**Riesgo**: Bajo
**Impacto**: Alto (previene futuros magic numbers)

### Acción
Crear `src/core/GameConstants.h` con las constantes definidas en `05_MAGIC_NUMBERS.md`.

### Beneficio
-Magic numbers centralizados
- Fácil de mantener
- IDE autocomplete

---

## QW-002: Hacer stringToDirection Case-Insensitive

**Tiempo estimado**: 15 minutos
**Riesgo**: Bajo
**Impacto**: Medio (previene bugs de parsing)

### Acción
Modificar `src/types/Direction.h:21-25` según se indica en `04_CODE_SMELLS.md`.

### Beneficio
- JSON con "Up" o "UP" funciona correctamente
- Más robusto

---

## QW-003: Agregar Verification de writeFile

**Tiempo estimado**: 5 minutos
**Riesgo**: Bajo
**Impacto**: Medio (detecta errores de escritura)

### Acción
Modificar `src/platform/FileSystem.cpp:20` para verificar `!file.fail()`.

### Antes
```cpp
file << content;
return true;
```

### Después
```cpp
file << content;
return !file.fail();
```

---

## QW-004: Actualizar ROADMAP.md

**Tiempo estimado**: 5 minutos
**Riesgo**: Mínimo
**Impacto**: Documentación correcta

### Acción
Cambiar `docs/ROADMAP.md` línea 5 de "Phase 11" a "Phase 12".

---

## QW-005: Agregar NULL Check en traceBuffer

**Tiempo estimado**: 10 minutos
**Riesgo**: Bajo
**Impacto**: Alto (previene crash)

### Acción
Modificar `src/events/EventRunner.cpp` según CRIT-004.

### Patrón
```cpp
if (!traceBuffer) return;
// ... código ...
// Capturar referencia antes de usar
auto& entries = traceBuffer->entries();
```

---

## QW-006: Fix Integer Underflow EventRunner Loop

**Tiempo estimado**: 10 minutos
**Riesgo**: Medio
**Impacto**: Alto (previene crash)

### Acción
Modificar `src/events/EventRunner.cpp:42-45`.

### Antes
```cpp
for (size_t index = commands.size(); index > 0; --index) {
```

### Después
```cpp
for (size_t i = commands.size(); i-- > 0; ) {
```

---

## QW-007: Fix BitmapFont measureWidth

**Tiempo estimado**: 5 minutos
**Riesgo**: Bajo
**Impacto**: Medio (visual consistency)

### Acción
Cambiar `src/renderer/BitmapFont.cpp:146` de:
```cpp
return static_cast<int>(text.size()) * (GlyphWidth + 1) * scale;
```
a:
```cpp
return static_cast<int>(text.size()) * (GlyphWidth + colSpace) * scale;
```

---

## QW-008: Agregar Validation Dimensions en MapLoader

**Tiempo estimado**: 15 minutos
**Riesgo**: Bajo
**Impacto**: Alto (previene división por cero)

### Acción
Agregar después de `map.tileSize = j.at("tileSize").get<int>();`:
```cpp
if (map.width <= 0 || map.height <= 0 || map.tileSize <= 0) {
    Logger::error("Invalid map dimensions in " + path);
    return std::nullopt;
}
```

---

## QW-009: Fix PlayerMotion Integer Overflow

**Tiempo estimado**: 10 minutos
**Riesgo**: Medio
**Impacto**: Alto (previene overflow)

### Acción
Cambiar `src/core/PlayerMotion.cpp:10-11, 30-31` de:
```cpp
visualX_ = static_cast<float>(tileX * tileSize_);
```
a:
```cpp
visualX_ = static_cast<float>(tileX) * static_cast<float>(tileSize_);
```

---

## QW-010: Agregar exists() Check en SDL_LoadBMP

**Tiempo estimado**: 10 minutos
**Riesgo**: Bajo
**Impacto**: Medio (mejora logging)

### Acción
Modificar `src/renderer/Renderer2D.cpp:239` según HIGH-010.

---

## Orden Recomendado de Aplicación

1. **QW-004** - ROADMAP.md (5 min, sin riesgo)
2. **QW-003** - writeFile verification (5 min)
3. **QW-006** - EventRunner loop underflow (10 min, crítico)
4. **QW-005** - traceBuffer null check (10 min, crítico)
5. **QW-007** - BitmapFont measureWidth (5 min)
6. **QW-002** - stringToDirection case-insensitive (15 min)
7. **QW-008** - MapLoader validation (15 min)
8. **QW-009** - PlayerMotion overflow (10 min)
9. **QW-010** - SDL_LoadBMP check (10 min)
10. **QW-001** - GameConstants.h (30 min, alto impacto)

**Total estimado**: ~2 horas

---

## Checklist de Quick Wins Completados

- [x] QW-001: GameConstants.h creado
- [x] QW-002: stringToDirection case-insensitive
- [x] QW-003: writeFile verifica success
- [x] QW-004: ROADMAP.md actualizado
- [x] QW-005: traceBuffer null check
- [x] QW-006: EventRunner loop fix
- [x] QW-007: BitmapFont measureWidth
- [x] QW-008: MapLoader validation
- [x] QW-009: PlayerMotion overflow
- [x] QW-010: SDL_LoadBMP exists check