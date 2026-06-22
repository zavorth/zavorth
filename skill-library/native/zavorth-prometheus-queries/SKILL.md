---
name: Prometheus Queries
description: PromQL query writing, metric exploration, alert rules
license: Zavorth-Internal
---

# Prometheus Queries

Use this native skill when:
- The task requires operations in the 'monitoring' domain.
- Performing actions matching: PromQL query writing, metric exploration, alert rules.

## Operating Rules

- Use rate() for counter metrics to avoid spike misinterpretation.
- Label matchers should be specific to avoid high-cardinality results.
- Document recording rules with clear naming conventions.
- Test queries with Prometheus expression browser before deployment.
- Use appropriate time ranges for instant vs range queries.

## Output

- PromQL expressions, recording rules, alert rules, and metric documentation.
