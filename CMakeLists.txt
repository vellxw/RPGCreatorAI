cmake_minimum_required(VERSION 3.15)
project(RPGCreatorRuntime VERSION 0.1 LANGUAGES CXX)

# Force CMake policy compatibility floor for older FetchContent dependencies
# (e.g. SDL2 release-2.28.5, doctest 2.4.11) under CMake 4.x.
# This is set at the build-tool level via CMakePresets.json or scripts; we
# also set it inline as a defensive default if not already provided.
if(NOT DEFINED CACHE{CMAKE_POLICY_VERSION_MINIMUM})
  set(CMAKE_POLICY_VERSION_MINIMUM 3.5 CACHE STRING "Default policy compat for old deps")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED True)
set(CMAKE_CXX_EXTENSIONS OFF)

# Guard: prevent external override of CMAKE_CXX_EXTENSIONS (e.g. -DCMAKE_CXX_EXTENSIONS=ON)
if(DEFINED CACHE{CMAKE_CXX_EXTENSIONS})
  if(NOT "$CACHE{CMAKE_CXX_EXTENSIONS}" STREQUAL "OFF"
     AND NOT "$CACHE{CMAKE_CXX_EXTENSIONS}" STREQUAL "FALSE"
     AND NOT "$CACHE{CMAKE_CXX_EXTENSIONS}" STREQUAL "NO"
     AND NOT "$CACHE{CMAKE_CXX_EXTENSIONS}" STREQUAL "0"
     AND NOT "$CACHE{CMAKE_CXX_EXTENSIONS}" STREQUAL "")
    message(FATAL_ERROR
      "CMAKE_CXX_EXTENSIONS must be OFF. "
      "Detected external override: CMAKE_CXX_EXTENSIONS=$CACHE{CMAKE_CXX_EXTENSIONS}")
  endif()
endif()

include(FetchContent)

# nlohmann/json
FetchContent_Declare(json
  URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)
FetchContent_MakeAvailable(json)

# doctest
FetchContent_Declare(doctest
  URL https://github.com/doctest/doctest/archive/refs/tags/v2.4.11.tar.gz
)
FetchContent_MakeAvailable(doctest)

# SDL2
FetchContent_Declare(
    SDL2
    GIT_REPOSITORY https://github.com/libsdl-org/SDL.git
    GIT_TAG        release-2.28.5
)
set(SDL_SHARED OFF CACHE BOOL "Build SDL shared library")
set(SDL_STATIC ON CACHE BOOL "Build SDL static library")
FetchContent_MakeAvailable(SDL2)

# Verify dependency targets exist after FetchContent
if(NOT TARGET nlohmann_json::nlohmann_json)
  message(FATAL_ERROR "Dependency target nlohmann_json::nlohmann_json not found after FetchContent")
endif()

if(NOT TARGET doctest::doctest)
  message(FATAL_ERROR "Dependency target doctest::doctest not found after FetchContent")
endif()

if(NOT TARGET SDL2-static)
  message(FATAL_ERROR "Dependency target SDL2-static not found after FetchContent")
endif()

# Source files
file(GLOB_RECURSE SRC_CORE "src/core/*.cpp")
file(GLOB_RECURSE SRC_PLATFORM "src/platform/*.cpp")
file(GLOB_RECURSE SRC_RENDERER "src/renderer/*.cpp")
file(GLOB_RECURSE SRC_WORLD "src/world/*.cpp")
file(GLOB_RECURSE SRC_ENTITIES "src/entities/*.cpp")
file(GLOB_RECURSE SRC_EVENTS "src/events/*.cpp")
file(GLOB_RECURSE SRC_DIALOGUE "src/dialogue/*.cpp")
file(GLOB_RECURSE SRC_SAVE "src/save/*.cpp")
file(GLOB_RECURSE SRC_DATABASE "src/database/*.cpp")
file(GLOB_RECURSE SRC_RUNTIME "src/runtime/*.cpp")

set(ALL_SOURCES
    ${SRC_CORE}
    ${SRC_PLATFORM}
    ${SRC_RENDERER}
    ${SRC_WORLD}
    ${SRC_ENTITIES}
    ${SRC_EVENTS}
    ${SRC_DIALOGUE}
    ${SRC_SAVE}
    ${SRC_DATABASE}
    ${SRC_RUNTIME}
)

add_library(RuntimeLib STATIC ${ALL_SOURCES})
target_include_directories(RuntimeLib PUBLIC src)
target_link_libraries(RuntimeLib PUBLIC nlohmann_json::nlohmann_json SDL2-static)

add_executable(rpg_creator_runtime src/main.cpp)
target_link_libraries(rpg_creator_runtime PRIVATE RuntimeLib)

enable_testing()
add_subdirectory(tests)
