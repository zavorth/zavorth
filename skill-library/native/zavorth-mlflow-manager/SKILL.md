---
name: MLflow Manager
description: MLflow experiment management and model registry
license: Zavorth-Internal
---

# MLflow Manager

Use this native skill when:
- The task requires operations in the 'ml' domain.
- Performing actions matching: MLflow experiment management, model registry, deployment.

## Operating Rules

- Set up MLflow tracking server with proper backend store and artifact store configuration.
- Log parameters, metrics, and model artifacts using MLflow's tracking API consistently.
- Register models in the Model Registry with proper versioning and stage transitions.
- Use MLflow Projects for reproducible training runs with defined entry points.
- Configure model serving endpoints for registered models in production stages.

## Output

- MLflow experiment configurations, registered model versions, and deployment artifacts.
