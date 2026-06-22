---
name: Apache Spark
description: Spark job management, DataFrame operations, cluster configuration
license: Zavorth-Internal
---

# Apache Spark

Use this native skill when:
- The task requires operations in the 'big-data' domain.
- Performing actions matching: Spark job management, DataFrame operations, cluster configuration.

## Operating Rules

- Tune partition counts based on data size and cluster resources.
- Use broadcast joins for small table joins to avoid shuffles.
- Cache frequently accessed DataFrames with appropriate storage levels.
- Monitor Spark UI for skew, spills, and stage failures.
- Set explicit schemas for structured streaming sources.

## Output

- Spark applications, execution plans, performance metrics, and job logs.
