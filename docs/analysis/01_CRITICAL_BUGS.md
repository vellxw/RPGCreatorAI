# 01 - CRITICAL BUGS - Requiere Fix Inmediato

## Resumen
10 bugs críticos que pueden causar crashes, memory leaks, o comportamiento incorrecto severo.

---

## CRIT-001: Integer Underflow en EventRunner Loop

**Archivo**: `src/events/EventRunner.cpp`
**Líneas**: 42-45

### Código Problemático
```cpp
for (size_t index = commands.size(); index > 0; --index) {
    // ...
}
```

### Problema
Si `commands.size()` es 0, `index` (tipo `size_t`, unsigned) hará underflow a `SIZE_MAX` (~18 quintillones) y el loop se ejecutará esa cantidad de veces, causando crash o comportamiento indefinido.

### Fix Sugerido
```cpp
for (size_t i = commands.size(); i-- > 0; ) {
    // ...
}
```
O usar tipo signed:
```cpp
for (int64_t index = static_cast<int64_t>(commands.size()) - 1; index >= 0; --index) {
    // ...
}
```

### Severidad: CRÍTICA

---

## CRIT-002: Path Traversal en SaveManager

**Archivo**: `src/save/SaveManager.cpp`
**Línea**: 123

### Código Problemático
```cpp
static std::string getSavePath(const std::string& slotId) {
    return "saves/" + slotId + ".json";
}
```

### Problema
Si `slotId` contiene `../` o es un path absoluto (ej: `../../etc/passwd`), se puede escribir fuera del directorio `saves/`.

### Fix Sugerido
```cpp
static std::string getSavePath(const std::string& slotId) {
    // Verificar que slotId no contiene path traversal
    if (slotId.find("..") != std::string::npos ||
        slotId.find("/") != std::string::npos ||
        slotId.find("\\") != std::string::npos ||
        slotId.empty()) {
        return ""; // Invalid slotId
    }
    return "saves/" + slotId + ".json";
}
```

### Severidad: CRÍTICA (Security)

---

## CRIT-003: Memory Leak en AudioSystem

**Archivo**: `src/platform/AudioSystem.cpp`
**Líneas**: 95-96

### Código Problemático
```cpp
cvt.buf = static_cast<Uint8*>(SDL_malloc(cvt.len * cvt.len_mult));
// ... si SDL_ConvertAudio falla, cvt.buf no se libera
```

### Problema
Si `SDL_ConvertAudio` falla después de allocar `cvt.buf`, hay memory leak.

### Fix Sugerido
Usar smart pointer o agregar cleanup:
```cpp
std::unique_ptr<Uint8, decltype(SDL_free)*> bufferGuard(cvt.buf, SDL_free);
if (SDL_ConvertAudio(&cvt) != 0) {
    return false; // buffer se libera automáticamente
}
// ...
```

### Severidad: CRÍTICA

---

## CRIT-004: Null Pointer Dereference traceBuffer

**Archivo**: `src/events/EventRunner.cpp`
**Líneas**: 253-254

### Código Problemático
```cpp
if (!traceBuffer) return;
// ... más código ...
traceCommandType(cmd ? cmd->type : "unknown", commandPath, action, result);
if (!traceBuffer->entries().empty()) { // <-- traceBuffer pudo ser null
```

### Problema
Después del check `if (!traceBuffer) return;`, `traceBuffer` puede ser null en la línea siguiente si hubo race condition o si el código se reorganizó.

### Fix Sugerido
Reorganizar para evitar acceso después del check:
```cpp
if (!traceBuffer) return;

traceCommandType(cmd ? cmd->type : "unknown", commandPath, action, result);

auto& entries = traceBuffer->entries(); // Capture reference
if (!entries.empty()) {
    // ...
}
```

### Severidad: CRÍTICA

---

## CRIT-005: Dangling Pointer AudioSystem

**Archivo**: `src/core/Game.h`
**Línea**: 124

### Código Problemático
```cpp
rpg::AudioSystem* audioSystem = nullptr;
```

### Problema
Game guarda un raw pointer a AudioSystem que es propiedad de Application. Si Application se destruye antes que Game, el pointer queda dangling.

### Fix Sugerido
Opciones:
1. Usar `std::weak_ptr<AudioSystem>`
2. Hacer que Game sea dueño del AudioSystem
3. Pasar referencia en lugar de puntero
4. Verificar lifetime en initialize()

### Severidad: CRÍTICA

---

## CRIT-006: BitmapFont measureWidth inconsistency

**Archivo**: `src/renderer/BitmapFont.cpp`
**Línea**: 146

### Código Problemático
```cpp
// En measureWidth (línea 144-146):
return static_cast<int>(text.size()) * (GlyphWidth + 1) * scale;

// En drawText (línea 140):
cursor += (GlyphWidth + colSpace) * scale;
```

### Problema
`measureWidth` usa `GlyphWidth + 1 = 6` pero `drawText` usa `(GlyphWidth + colSpace) * scale` donde `colSpace = 1`. Para `scale > 1`, los cálculos difieren.

### Fix Sugerido
```cpp
// En measureWidth, usar colSpace:
return static_cast<int>(text.size()) * (GlyphWidth + colSpace) * scale;
```

### Severidad: CRÍTICA (visual bugs)

---

## CRIT-007: Division by Zero AnimationDatabase

**Archivo**: `src/database/AnimationDatabase.cpp`
**Línea**: 38

### Código Problemático
```cpp
clip.anchor.x = anchor.value("x", clip.frameSize.width / 2);
clip.anchor.y = anchor.value("y", clip.frameSize.height);
```

### Problema
Si `clip.frameSize.width` es 0, hay división por cero en el default evaluation.

### Fix Sugerido
```cpp
clip.anchor.x = anchor.value("x", clip.frameSize.width > 0 ? clip.frameSize.width / 2 : 32);
clip.anchor.y = anchor.value("y", clip.frameSize.height > 0 ? clip.frameSize.height : 32);
```

### Severidad: CRÍTICA

---

## CRIT-008: Integer Overflow PlayerMotion

**Archivo**: `src/core/PlayerMotion.cpp`
**Líneas**: 10-11, 30-31

### Código Problemático
```cpp
visualX_ = static_cast<float>(tileX * tileSize_);
visualY_ = static_cast<float>(tileY * tileSize_);
```

### Problema
La multiplicación `tileX * tileSize_` ocurre como `int` ANTES del cast. Para mapas grandes (tileX > 67,000 con tileSize=32), hay overflow.

### Fix Sugerido
```cpp
visualX_ = static_cast<float>(tileX) * static_cast<float>(tileSize_);
visualY_ = static_cast<float>(tileY) * static_cast<float>(tileSize_);
```

### Severidad: CRÍTICA

---

## CRIT-009: Integer Overflow MapLoader

**Archivo**: `src/world/MapLoader.cpp`
**Línea**: 285

### Código Problemático
```cpp
const int expected = map.width * map.height;
```

### Problema
`map.width * map.height` puede overflow si ambos son valores grandes (ej: 50000 * 50000 = 2.5 trillones > INT_MAX).

### Fix Sugerido
```cpp
const int64_t expected = static_cast<int64_t>(map.width) * static_cast<int64_t>(map.height);
if (expected > INT_MAX || expected < 0) {
    Logger::error("Map dimensions too large: " + path);
    return std::nullopt;
}
```

### Severidad: CRÍTICA

---

## CRIT-010: Integer Overflow Renderer2D

**Archivo**: `src/renderer/Renderer2D.cpp`
**Línea**: 82

### Código Problemático
```cpp
const int index = y * width + x;
```

### Problema
`y * width` puede overflow para mapas grandes (similar a CRIT-009).

### Fix Sugerido
```cpp
const int64_t index64 = static_cast<int64_t>(y) * static_cast<int64_t>(width) + static_cast<int64_t>(x);
if (index64 < 0 || index64 > INT_MAX) return 0; // or handle error
const int index = static_cast<int>(index64);
```

### Severidad: CRÍTICA

---

## Checklist de Fix Aplicados

- [x] CRIT-001: EventRunner loop underflow
- [x] CRIT-002: Path traversal SaveManager
- [x] CRIT-003: Memory leak AudioSystem
- [x] CRIT-004: Null pointer traceBuffer
- [x] CRIT-005: Dangling pointer AudioSystem
- [x] CRIT-006: BitmapFont measureWidth
- [x] CRIT-007: Division by zero AnimationDatabase
- [x] CRIT-008: Integer overflow PlayerMotion
- [x] CRIT-009: Integer overflow MapLoader
- [x] CRIT-010: Integer overflow Renderer2D