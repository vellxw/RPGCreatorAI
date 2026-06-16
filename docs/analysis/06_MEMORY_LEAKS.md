# 06 - MEMORY LEAKS

## Resumen
3 memory leaks identificados en el codebase.

---

## LEAK-001: AudioSystem Buffer sin Cleanup en Error

**Archivo**: `src/platform/AudioSystem.cpp`
**Líneas**: 95-96

### Código Problemático
```cpp
cvt.buf = static_cast<Uint8*>(SDL_malloc(cvt.len * cvt.len_mult));
if (!cvt.buf) {
    Logger::warning("AudioSystem: failed to allocate audio conversion buffer");
    return false;
}

if (SDL_ConvertAudio(&cvt) != 0) {
    // cvt.buf no se libera aquí
    Logger::warning("AudioSystem: audio conversion failed");
    return false;
}
```

### Problema
Si `SDL_ConvertAudio` falla, `cvt.buf` quedaallocated pero no se libera.

### Fix Sugerido
```cpp
std::unique_ptr<Uint8, decltype(SDL_free)*> bufferGuard(cvt.buf, SDL_free);
cvt.buf = nullptr; // Transfer ownership to unique_ptr

if (SDL_ConvertAudio(&cvt) != 0) {
    Logger::warning("AudioSystem: audio conversion failed");
    return false; // bufferGuard cleans up automatically
}

// En éxito, la queue consume el buffer, así que no liberamos aquí
bufferGuard.release();
```

### Alternativa Más Simple
```cpp
Uint8* buffer = static_cast<Uint8*>(SDL_malloc(cvt.len * cvt.len_mult));
if (!buffer) return false;

bool success = (SDL_ConvertAudio(&cvt) == 0);
SDL_free(buffer); // Siempre liberamos

if (!success) {
    Logger::warning("AudioSystem: audio conversion failed");
    return false;
}
```

---

## LEAK-002: Textures No Liberadas si shutdown() No es Llamado

**Archivo**: `src/renderer/Renderer2D.cpp`
**Líneas**: 228-231

### Código
```cpp
Renderer2D::~Renderer2D() {
    for (auto& [_, texture] : textures) {
        if (texture) SDL_DestroyTexture(texture);
    }
    textures.clear();
}
```

### Problema
Si `shutdown()` no es llamado (ej: excepción antes), los `SDL_Texture*` se pierden.

### Fix Sugerido
El código actual del destructor ya maneja esto. El problema es si alguien olvida llamar `shutdown()`.

Asegurar que `initialize()` y `shutdown()` sean llamados correctamente en el orden apropiado en Application.

---

## LEAK-003: requestedIds_ Crece Sin Límite

**Archivo**: `src/platform/AudioSystem.h`
**Línea**: 58

### Código
```cpp
std::vector<std::string> requestedIds_;
```

### Problema
Cada llamada a `playSound()` o `playBgm()` hace `push_back` pero nunca se limpia. En un juego largo, esto consume memoria indefinidamente.

### Fix Sugerido
```cpp
// Opción 1: Usar circular buffer
class AudioSystem {
    static constexpr size_t kMaxRequestHistory = 100;
    std::vector<std::string> requestedIds_;
    // En push: si size() > kMaxRequestHistory, erase oldest
};

// Opción 2: Clear periódico
void AudioSystem::clearRequestHistory() {
    requestedIds_.clear();
}

// Opción 3: No guardar historial si no es necesario
// (revisar si realmente se usa requestedIds_)
```

---

## Checklist de Fix Aplicados

- [ ] LEAK-001: AudioSystem buffer cleanup
- [ ] LEAK-002: N/A (ya manejado por destructor)
- [ ] LEAK-003: requestedIds_ bounded