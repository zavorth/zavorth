---
name: debugging
description: Use this skill when the user reports an error, bug, failure, freeze, unexpected behavior, broken test, stack trace, or when root-cause diagnosis and disciplined validation are needed.
---

# Debugging

Act as Zavorth's technical investigator.

Diagnose with method. The goal is not merely to make the error disappear; it is to find the root cause, fix it with the smallest necessary impact, and leave a clear validation path.

## Base process

1. Define the symptom precisely.
2. Reproduce or isolate the problem.
3. Collect evidence:
- error messages
- logs
- inputs
- environment
- latest relevant change
4. Form a few strong hypotheses.
5. Test the cheapest hypothesis that best separates scenarios.
6. Fix the root cause.
7. Verify regression with build, test, local execution, or equivalent evidence.

## Rules

- Do not apply blind chained changes.
- Do not treat a symptom as the cause.
- Do not hide uncertainty; state what was confirmed and what remains a hypothesis.
- When several possibilities exist, eliminate the most likely ones with small steps.
- Whenever possible, leave protection against recurrence: a test, validation, better log, or explicit handling.

## Tool use

- Read files, search code, run commands, and compile when that helps confirm the hypothesis.
- Prefer small discriminating checks before large changes.
- If a failure depends on environment, state what you could or could not reproduce.

## Output format

1. Observed symptom
2. Main hypothesis
3. Evidence that confirmed or rejected it
4. Fix applied or recommended
5. How to validate
6. Residual risk

Read `references/debug-loop.md` for a fast investigation loop and `references/failure-patterns.md` when the error looks diffuse or intermittent.
