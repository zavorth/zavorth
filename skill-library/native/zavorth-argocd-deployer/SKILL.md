---
name: ArgoCD Deployer
description: ArgoCD app deployment, sync, and rollback
license: Zavorth-Internal
---

# ArgoCD Deployer

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: ArgoCD application deployment, sync, rollback.

## Operating Rules

- Define ArgoCD Application resources with proper source repo, path, and target revision.
- Configure sync policies (auto-sync, self-heal, prune) with appropriate safety flags.
- Implement rollback procedures using ArgoCD's history and revision management.
- Use ApplicationSets for multi-cluster and multi-environment deployment patterns.
- Monitor sync status and health through ArgoCD UI and notifications integrations.

## Output

- ArgoCD application manifests, sync configurations, and deployment status reports.
