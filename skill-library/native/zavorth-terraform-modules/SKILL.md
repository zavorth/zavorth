---
name: Terraform Modules
description: Terraform module dev, state, and drift detection
license: Zavorth-Internal
---

# Terraform Modules

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: Terraform module development, state management, drift detection.

## Operating Rules

- Write reusable modules with clear input variables, outputs, and documentation in README.
- Use remote state backends (S3, GCS, Terraform Cloud) with state locking enabled.
- Implement drift detection with terraform plan scheduled runs and alerting on changes.
- Apply proper resource naming conventions and tagging strategies across modules.
- Use workspaces or directory-based separation for multi-environment deployments.

## Output

- Terraform modules, state configurations, CI/CD pipelines, and drift detection reports.
