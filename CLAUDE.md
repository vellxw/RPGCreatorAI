# CLAUDE.md — Claude-Specific Agent Notes

@AGENTS.md

## Additional Notes for Claude

- This project uses React 19 + Vite + Tailwind CSS 4 for the editor UI
- The C++ runtime is separate and built via CMake
- Phase 8 requires coordinated editor + runtime visual work; keep the
  two presentations consistent with `docs/GAME_VISUAL_DESIGN.md`
- The editor reads/writes the same JSON data model as the runtime
- Never store API keys in committed files
- Use `.env` for secrets (already in `.gitignore`)
