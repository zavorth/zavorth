---
name: Airflow Orchestrator
description: Apache Airflow DAG management and scheduling
license: Zavorth-Internal
---

# Airflow Orchestrator

Use this native skill when:
- The task requires operations in the 'data-engineering' domain.
- Performing actions matching: Apache Airflow DAG management, task scheduling, monitoring.

## Operating Rules

- Define DAGs with clear task dependencies, retries, and failure callbacks for reliability.
- Use TaskFlow API for Python-based DAGs and proper XCom usage for data passing.
- Configure appropriate executors (LocalExecutor, CeleryExecutor, KubernetesExecutor) per workload.
- Implement idempotent tasks that can safely rerun without side effects.
- Apply proper SLA configurations and alerting for time-sensitive pipeline tasks.

## Output

- Airflow DAG files, task configurations, and pipeline monitoring dashboards.
