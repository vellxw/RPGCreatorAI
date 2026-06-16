# 07 - PATH TRAVERSAL SECURITY

## Resumen
2 vulnerabilidades de seguridad relacionadas con path traversal.

---

## SEC-001: Path Traversal en SaveManager::getSavePath

**Archivo**: `src/save/SaveManager.cpp`
**Línea**: 123

### Vulnerabilidad
```cpp
static std::string getSavePath(const std::string& slotId) {
    return "saves/" + slotId + ".json";
}
```

### Ataque Posible
```cpp
// Usuario malicioso pasa:
slotId = "../../../etc/passwd"
// Resultado: "saves/../../../etc/passwd.json"
// Puede escribir fuera del directorio del juego!
```

### Fix Requerido
```cpp
static std::string getSavePath(const std::string& slotId) {
    // 1. Verificar que no esté vacío
    if (slotId.empty()) {
        return "";
    }

    // 2. Verificar que no contenga path traversal
    if (slotId.find("..") != std::string::npos ||
        slotId.find('/') != std::string::npos ||
        slotId.find('\\') != std::string::npos) {
        return "";
    }

    // 3. Verificar que solo contenga caracteres seguros
    for (char c : slotId) {
        if (!std::isalnum(static_cast<unsigned char>(c)) && c != '_' && c != '-') {
            return "";
        }
    }

    return "saves/" + slotId + ".json";
}
```

### Validación Adicional
También verificar en `SaveManager::listSlots()` que los paths de archivos encontrados están dentro del directorio `saves/`.

---

## SEC-002: RuntimeProjectValidator::isSafeProjectRelativePath Incompleto

**Archivo**: `src/runtime/RuntimeProjectValidator.cpp`
**Líneas**: 86-88

### Vulnerabilidad
```cpp
bool isSafeProjectRelativePath(const std::string& path) {
    if (path.empty()) return false;
    if (path[0] == '/') return false;  // Absolute Unix
    if (path[1] == ':') return false;  // Absolute Windows
    if (path.find("..") != std::string::npos) return false;
    return true;
}
```

### Problemas
1. No verifica paths Windows relativos con drive letter (`C:data\file`)
2. No verifica `~` (home directory)
3. No verifica variables de entorno (`$HOME`, `%APPDATA%`)
4. No verifica devices Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`)

### Fix Sugerido
```cpp
bool isSafeProjectRelativePath(const std::string& path) {
    if (path.empty()) return false;

    // 1. Verificar no es absoluto
    if (path[0] == '/') return false;  // Unix absolute
    if (path.size() >= 2 && path[1] == ':') return false;  // Windows absolute

    // 2. Verificar no contiene traversal
    if (path.find("..") != std::string::npos) return false;

    // 3. Verificar no empieza con ~
    if (path[0] == '~') return false;

    // 4. Verificar no contiene variables de entorno
    if (path.find('$') != std::string::npos) return false;
    if (path.find('%') != std::string::npos) return false;

    // 5. Verificar no es device Windows
    std::string upper = path;
    std::transform(upper.begin(), upper.end(), upper.begin(), ::toupper);
    if (upper == "CON" || upper == "PRN" || upper == "AUX" || upper == "NUL" ||
        upper.substr(0, 4) == "COM" || upper.substr(0, 4) == "LPT") {
        return false;
    }

    // 6. Normalizar y verificar que está dentro del proyecto
    // (Esto se hace en el llamador con fs::absolute y lexically_normal)

    return true;
}
```

---

## Nota sobre Validación de Archivos

Además de path traversal, considerar:
1. **Verificar contenido real** no solo extensión (ver CRIT-010)
2. **Limitar tamaño de archivos** para evitar DoS
3. **Validar estructura JSON** antes de procesar

---

## Checklist de Fix Aplicados

- [ ] SEC-001: Sanitizar slotId en getSavePath
- [ ] SEC-002: Mejorar isSafeProjectRelativePath