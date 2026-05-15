# CLAUDE.md — Claude-Specific Agent Notes

@AGENTS.md

## Additional Notes for Claude

- This project uses React 19 + Vite + Tailwind CSS 4 for the editor UI
- The C++ runtime is separate and built via CMake
- Phase 3 is the Visual Editor MVP — do not modify the C++ runtime
- The editor reads/writes the same JSON data model as the runtime
- Never store API keys in committed files
- Use `.env` for secrets (already in `.gitignore`)
