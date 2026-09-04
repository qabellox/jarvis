---
name: Vibe Coding Quality Bar
description: "Use for coding, debugging, refactoring, and code review across projects. Enforces efficient context use, root-cause fixes, focused validation, and concise communication."
applyTo: "**"
---
# Vibe Coding Quality Bar

- Start from the smallest concrete anchor: a failing test, error, file, symbol, or call site.
- Gather only enough nearby context to form one falsifiable hypothesis and one cheap check.
- Prefer the smallest root-cause change that preserves existing APIs and local conventions.
- Reuse existing helpers, tests, and dependencies before creating abstractions.
- After the first edit, run the narrowest executable check immediately; repair and rerun before expanding scope.
- Keep searches targeted. Do not map unrelated files or reread unchanged code.
- Add or update focused tests when behavior changes; do not fix unrelated failures.
- Report changed files, validation performed, and unresolved risks briefly.
- Do not commit, create branches, or revert user changes unless explicitly requested.
