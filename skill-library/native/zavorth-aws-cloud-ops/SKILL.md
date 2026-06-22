---
name: AWS Cloud Ops
description: AWS services management (EC2, S3, Lambda, RDS, CloudFormation)
license: Zavorth-Internal
---

# AWS Cloud Ops

Use this native skill when:
- The task requires operations in the 'cloud' domain.
- Performing actions matching: AWS services management (EC2, S3, Lambda, RDS, CloudFormation).

## Operating Rules

- Enforce least-privilege IAM policies for all resource operations.
- Tag all provisioned resources with cost-center and environment metadata.
- Use CloudFormation change sets before applying stack updates.
- Enable encryption at rest and in transit for all storage services.
- Validate AWS CLI credentials and region before executing commands.

## Output

- Infrastructure templates, resource inventories, cost estimates, and deployment logs.
