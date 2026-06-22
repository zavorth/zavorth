---
name: ETL Pipeline
description: ETL pipeline design, data transformation, workflow orchestration
license: Zavorth-Internal
---

# ETL Pipeline

Use this native skill when:
- The task requires operations in the 'data' domain.
- Performing actions matching: ETL pipeline design, data transformation, workflow orchestration.

## Operating Rules

- Design pipelines with idempotent steps for safe reruns.
- Implement data quality checks at each transformation stage.
- Log row counts and checksums before and after each step.
- Use incremental loading over full refresh where possible.
- Define clear schemas and contracts between pipeline stages.

## Output

- Pipeline definitions, transformation scripts, data quality reports, and orchestration configs.
