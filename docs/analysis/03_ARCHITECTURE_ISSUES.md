# 03 - ARCHITECTURE ISSUES

## Resumen
6 problemas de arquitectura que requieren refactorización planificada.

---

## ARCH-001: RuntimeProjectValidator - 1658 Líneas

**Archivo**: `src/runtime/RuntimeProjectValidator.cpp`
**Líneas**: 1658

### Problema
Un solo archivo con 1658 líneas que hace validación de:
- Audio
- Databases
- Maps
- Commands
- Events comunes
- Paths
- Seguridad

### Por Qué Es Un Problema
- Viola el Principio de Responsabilidad Única (SRP)
- Difícil de mantener y testing
- Cualquier cambio afecta muchas áreas

### Solución Sugerida
Dividir en múltiples archivos por dominio:
```
src/runtime/validators/
├── Validator.h           # Interfaz común
├── AudioValidator.cpp/h
├── DatabaseValidator.cpp/h
├── MapValidator.cpp/h
├── CommandValidator.cpp/h
├── SecurityValidator.cpp/h
└── RuntimeProjectValidator.cpp  # Orchestrator
```

### Prioridad: ALTA

---

## ARCH-002: processCommand() - 310 Líneas con 40+ Branches

**Archivo**: `src/events/EventRunner.cpp`
**Líneas**: 266-577

### Problema
Un solo método con un if/else-if encadenado enorme para procesar ~40 tipos de comandos.

### Por Qué Es Un Problema
- Viola Open/Closed Principle
- Difícil de agregar nuevos comandos
- Difícil de testing individual

### Solución Sugerida
Patrón Command Handler:
```cpp
// En lugar de:
if (type == "showText") { handleShowText(cmd); }
else if (type == "showChoices") { handleShowChoices(cmd); }
// ...

// Usar:
using CommandHandler = std::function<void(std::shared_ptr<EventCommand>)>;
std::unordered_map<std::string, CommandHandler> handlers = {
    {"showText", [this](auto cmd) { handleShowText(cmd); }},
    {"showChoices", [this](auto cmd) { handleShowChoices(cmd); }},
    // ...
};

auto it = handlers.find(type);
if (it != handlers.end()) {
    it->second(cmd);
}
```

### Prioridad: ALTA

---

## ARCH-003: GameState - Demasiadas Responsabilidades

**Archivo**: `src/core/GameState.h`
**Líneas**: 13-105

### Problema
GameState maneja:
- Flags (booleanos)
- Switches
- Self-switches
- Variables (enteros)
- Inventario
- Oro
- Party members
- Quests
- HP de actores
- Posición del jugador

### Por Qué Es Un Problema
- Violación de SRP
- Difícil de testing
- Acoplamiento alto

### Solución Sugerida
Dividir en múltiples clases:
```cpp
class FlagStore { /* flags, switches, self-switches */ };
class InventorySystem { /* items, gold */ };
class QuestManager { /* quests, objectives */ };
class PartyManager { /* actors, HP */ };
class GameState { /* composita las anteriores */ };
```

### Prioridad: MEDIA

---

## ARCH-004: EventRunner - 20+ Miembros Privados

**Archivo**: `src/events/EventRunner.h`
**Líneas**: 69-157

### Problema
La clase tiene más de 20 miembros:
- GameState&, DialogueSystem& (referencias)
- various resolvers (CommonEventResolver, QuestObjectiveResolver, BattleRunner)
- traceBuffer raw pointer
- pendingChoiceCommand
- pendingRequests (transfer, shop, battle, etc.)
- running flag

### Por Qué Es Un Problema
- Demasiado estado mutable
- Difícil de razonar sobre invariantes
- Testing complejo

### Solución Sugerida
Extraer grupos de funcionalidad:
```cpp
class EventRunner {
    CommandProcessor processor_;    // Lógica de procesamiento
    ChoiceHandler choiceHandler_;   // Manejo de elecciones
    RequestQueue requests_;         // Queue de requests
    TraceBuffer* traceBuffer_;      // Solo este queda
    // ...
};
```

### Prioridad: MEDIA

---

## ARCH-005: parseCommand Duplicado

**Archivos**:
- `src/world/MapLoader.cpp` (líneas 33-155)
- `src/database/RpgDatabases.cpp` (líneas 325-437)

### Problema
La misma función `parseCommand` está copiada en ambos archivos con ligeras variaciones.

### Por Qué Es Un Problema
- Viola DRY
- Si el formato de comandos cambia, hay que actualizar en ambos lugares
- Posible desincronización

### Solución Sugerida
Extraer a un lugar común:
```cpp
// src/types/EventCommandParser.h
namespace EventCommandParser {
    std::shared_ptr<EventCommand> parse(const json& j);
}
```

### Prioridad: ALTA

---

## ARCH-006: Índices Hardcodeados MenuSystem

**Archivo**: `src/core/MenuSystem.cpp`
**Líneas**: 180-187, 222, 255

### Problema
```cpp
// En handleInput:
case 0: // Root - Inventory
case 1: // Root - Party
case 2: // Root - Quests
case 3: // Root - Save
case 4: // Root - Load

// Hardcoded:
selectionIndex_ = 3; // Asume Save está en índice 3
```

### Por Qué Es Un Problema
Si el orden de `kRootItems` cambia, los índices se rompen.

### Solución Sugerida
Usar enum o buscar por nombre:
```cpp
enum RootItem { Inventory, Party, Quests, Save, Load };

case RootItem::Save:
    selectionIndex_ = static_cast<int>(RootItem::Save);
    break;
```

O buscar dinámicamente:
```cpp
auto it = std::find(kRootItems.begin(), kRootItems.end(), "Save");
if (it != kRootItems.end()) {
    selectionIndex_ = std::distance(kRootItems.begin(), it);
}
```

### Prioridad: BAJA

---

## Checklist de Refactors Completados

- [ ] ARCH-001: Dividir RuntimeProjectValidator
- [ ] ARCH-002: Command Handler pattern en EventRunner
- [ ] ARCH-003: Split GameState
- [ ] ARCH-004: Reducir miembros EventRunner
- [ ] ARCH-005: Unificar parseCommand
- [ ] ARCH-006: Eliminar índices hardcodeados