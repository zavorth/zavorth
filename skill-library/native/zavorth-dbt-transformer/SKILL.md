---
name: dbt Transformer
description: dbt model development, testing, and documentation
license: Zavorth-Internal
---

# dbt Transformer

Use this native skill when:
- The task requires operations in the 'data-engineering' domain.
- Performing actions matching: dbt model development, testing, documentation.

## Operating Rules

- Write modular SQL models using ref() for dependency management and lineage tracking.
- Apply materializations (view, table, incremental, ephemeral) based on model usage patterns.
- Define schema tests (unique, not_null, accepted_values, relationships) for data quality.
- Use dbt packages (dbt_utils, dbt_expectations) for reusable macros and tests.
- Generate and maintain documentation with dbt docs generate for team accessibility.

## Output

- dbt models, schema YAML files, documentation, and test configurations.
