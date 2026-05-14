# Severity Rubric

## Critical

Use when evidence supports likely compromise with high business impact, such as:

- hardcoded production secrets or signing keys
- confirmed SQL injection or command injection
- confirmed auth bypass on privileged functions
- webhook signature verification missing on sensitive handlers
- secret exposure to client bundles

## High

Use when exploitation could expose data, enable privileged actions, or meaningfully weaken the trust boundary, such as:

- missing authorization on sensitive route handlers
- prompt injection path that can invoke tools or access sensitive context
- sensitive tokens in browser storage
- SSRF-capable server fetch from user-controlled input
- broad CORS on sensitive endpoints

## Medium

Use for important but narrower or more conditional issues, such as:

- missing rate limiting
- missing CSRF for cookie-authenticated state-changing requests
- incomplete security headers
- overexposed error messages or debug logs
- unsafe markdown rendering with partial mitigations

## Low

Use for defense-in-depth or hygiene improvements, such as:

- missing non-critical headers
- unnecessary information disclosure with low sensitivity
- incomplete hardening guidance

## Confidence rubric

### High confidence
- direct code or config evidence supports the claim

### Medium confidence
- strong indicators exist, but key enforcement points were not visible

### Low confidence
- pattern suggests risk, but evidence is incomplete and requires manual review
