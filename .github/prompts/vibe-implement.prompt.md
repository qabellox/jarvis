---
name: Vibe Implement
description: Implement a coding task with minimal context usage, root-cause reasoning, focused edits, and executable validation.
argument-hint: Describe the feature, bug, or change to implement
agent: agent
---
Implement the requested change end to end.

1. Identify the smallest concrete code anchor and inspect only its nearby implementation, callers, and tests.
2. State one falsifiable local hypothesis and the cheapest check that could disconfirm it.
3. Make the smallest focused edit consistent with existing patterns.
4. Immediately run the narrowest relevant test, typecheck, lint, or build command.
5. If validation fails, repair the same slice and rerun it before exploring further.
6. Finish with a concise summary of changes, validation, and remaining risk.

Do not perform unrelated refactors, broad repository exploration, or git operations unless requested.
