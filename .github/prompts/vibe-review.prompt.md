---
name: Vibe Review
description: Review code for bugs, regressions, security risks, missing tests, and maintainability problems with high signal and minimal context.
argument-hint: Describe the change or select the code to review
agent: agent
---
Review the requested code or change as a senior engineer.

Prioritize findings over summary. For each finding include severity, why it is wrong or risky, a precise file reference, and a focused fix direction.

Check only the relevant execution path, nearby tests, and public contracts. Look for incorrect edge cases, error handling gaps, unsafe input or data flow, unintended API changes, and missing regression coverage. Do not report style preferences unless they affect correctness. End with test gaps and a brief summary.
