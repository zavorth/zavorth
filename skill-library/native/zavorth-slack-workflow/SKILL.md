---
name: Slack Workflow
description: Slack workflow automation, slash commands, app configuration
license: Zavorth-Internal
---

# Slack Workflow

Use this native skill when:
- The task requires operations in the 'channels' domain.
- Performing actions matching: Slack workflow automation, slash commands, app configuration.

## Operating Rules

- Use Socket Mode for development; HTTP endpoints for production.
- Implement proper OAuth scopes with minimal required permissions.
- Handle rate limits with exponential backoff retry logic.
- Use Block Kit for rich, interactive message formatting.
- Validate request signatures for all incoming webhooks.

## Output

- Slack app configurations, workflow automations, and integration logs.
