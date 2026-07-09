# ERROR-HANDLING.md - Error Recovery Strategies

How the agent should handle different types of failures.

## Strategies

- **api-failure:** retry-explain
- **ambiguous-input:** ask-user
- **tool-failure:** suggest-alternatives
- **knowledge-gap:** ask-user
- **permission-denied:** escalate
- **timeout:** retry-silent
- **unknown:** log-continue

## Default Strategy

- **Default:** ask-user

## Configuration

- **Max retries:** 1
- **Fallback strategy:** explain and suggest alternatives

## File boundary

What belongs here:
- error recovery strategies per category
- retry limits and fallback behaviors

What does not belong here:
- runtime error logs
- tool permission policies (TOOL-POLICY.md)

## Maintenance rule

When a strategy proves ineffective, adjust it.
When new error categories emerge, add them here.
- **Default error handling:** ask-user
