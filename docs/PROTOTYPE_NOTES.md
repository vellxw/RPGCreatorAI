# Prototype Notes

**¡IMPORTANTE!** Este documento define el contexto temporal de este proyecto actual.

## 1. Naturaleza del Prototipo
Este proyecto fue creado como una **prueba rápida en Google AI Studio**.
Dado que AI Studio ejecuta entornos web (Node.js/React/Vite), el dashboard visual actual construido en React está pensado pura y exclusivamente para poder "ver" algo en la pantalla o en un celular, validando que el modelo de datos tiene sentido.

## 2. El Dashboard Web es TEMPORAL
- El dashboard React/Vite es **solo para visualización temporal** y actúa como un "laboratorio visual".
- **NO DEBE CONSIDERARSE ARQUITECTURA FINAL.** Ninguna decisión visual, de layout, tipografía, CSS o hooks de React dicta cómo será el engine final.
- Su único rol actual es ayudar a inspeccionar mapas, eventos, variables, estado del jugador, inventarios y el flujo lógico de los JSONs.

## 3. Runtime Definitivo (C++)
- El runtime definitivo y verdadero será construido desde cero (o utilizando el código C++ ya generado aquí como base) utilizando **Claude Opus**.
- La arquitectura final será un ejecutable nativo en C++20 (usando CMake, SDL2/3, nlohmann/json).

## 4. ¿Qué es lo que verdaderamente importa y debemos conservar?
Lo valioso de este experimento no es el código de UI, sino la **arquitectura de datos y la lógica**:
- El formato y esquema de los **archivos JSON** (`project.json`, `maps/*.json`, `items.json`).
- El **Modelo de Eventos** (comandos `showText`, `transferMap`, condicionales `ifFlag`).
- El modelo conceptual del **GameState** (manejo centralizado de flags, posición, inventario separando estado de vista).
- Las **reglas del runtime** (cómo funciona la colisión por tile, sistema de grid, transferencias entre mapas).
