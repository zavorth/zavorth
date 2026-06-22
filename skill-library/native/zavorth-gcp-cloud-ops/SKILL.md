---
name: GCP Cloud Ops
description: GCP services management (GCE, GCS, Cloud Functions, BigQuery)
license: Zavorth-Internal
---

# GCP Cloud Ops

Use this native skill when:
- The task requires operations in the 'cloud' domain.
- Performing actions matching: GCP services management (GCE, GCS, Cloud Functions, BigQuery).

## Operating Rules

- Use service accounts with minimal IAM roles for all operations.
- Enable audit logging for all GCP resource access.
- Apply labels to all resources for cost tracking and organization.
- Use deployment manager or Terraform for reproducible infrastructure.
- Validate project ID and zone configuration before executing commands.

## Output

- Infrastructure configurations, resource reports, query results, and deployment summaries.
