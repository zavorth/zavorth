# SecretSanitizer Pattern

Zavorth uses a shared `SecretSanitizer` utility to redact sensitive credentials from text output (logs, receipts, AI prompts). All services that handle free-text content MUST route through this utility instead of defining ad-hoc regex patterns.

## Location

- Implementation: `src/services/security/SecretSanitizer.ts`

## API

The `SecretSanitizer` exposes two functions:

1. `sanitizeSecretString(input: string): string` — replaces every detected secret with a `[redacted]` placeholder.
2. `containsSecret(input: string): boolean` — non-destructive predicate for routing decisions.

## Detected Patterns

The sanitizer recognizes these credential formats:

| Pattern | Example |
|---|---|
| `api[_-]?key`, `token`, `secret`, `password` assignments | `api_key="abc123..."` |
| GitHub / GitLab tokens | `ghp_xxx`, `glpat-xxx`, `xoxb-xxx` |
| Credit-card numbers | 13–19 digit groups separated by spaces or dashes |
| File paths containing `.env`, `.ssh`, `.aws`, `secrets*`, `credentials*`, `private_*_key` |

Patterns are strict-typed and unit-tested. Adding a new pattern requires both a regex change and a corresponding test case.

## When to Use

Use `SecretSanitizer` in any of these contexts:

- Writing free-text output that may include user-supplied strings
- Logging or telemetry that may include LLM prompts / responses
- Persistence layers (memory, receipts, audit logs)
- Cross-service payload forwarding

## When NOT to Use

Do NOT sanitize:

- Already-encrypted blobs (sanitization would corrupt them)
- Test fixtures that intentionally include fake secrets
- Configuration objects processed before logging (use schema validation instead)

## Integration Example

```typescript
import { sanitizeSecretString } from '../../services/security/SecretSanitizer.js';

const safePrompt = sanitizeSecretString(rawPrompt);
await logger.info('User prompt received', { prompt: safePrompt });
```

## Migration Checklist

When migrating a service from inline regex to `SecretSanitizer`:

1. Remove the local `SECRET_PATTERNS` array or equivalent.
2. Import `sanitizeSecretString` from `SecretSanitizer`.
3. Replace every `.replace(/...pattern.../g, '[redacted]')` with `sanitizeSecretString(...)`.
4. Verify the existing tests still pass — `SecretSanitizer` recognizes a superset of common patterns.

## Maintenance

- Single source of truth in `src/services/security/SecretSanitizer.ts`.
- Any new credential format recognized by the codebase MUST be added here, not as a local pattern in individual services.
