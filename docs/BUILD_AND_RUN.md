# Build and Run Instructions

## Requirements
- A modern C++ compiler (C++20 support or higher).
- CMake 3.15+
- SDL2 (can be installed locally or fetched via CMake fetch content; our script uses FetchContent to ensure ease of building).

## Building on Windows (MSVC)
```bash
# Generate project files
cmake -S . -B build

# Build the project
cmake --build build --config Debug

# Run the runtime
./build/Debug/rpg_creator_runtime.exe

# Run the tests
ctest --test-dir build --output-on-failure
```

## Setup using Ninja
```bash
cmake -S . -B build -G Ninja
cmake --build build
./build/rpg_creator_runtime
ctest --test-dir build --output-on-failure
```
