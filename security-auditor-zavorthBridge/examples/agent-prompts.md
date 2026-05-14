# Example prompts for ZavorthBridge

- Audit this repository using `ZAVORTH_BRIDGE.md`. Start with API routes, auth, secrets, and AI integration paths. Generate `SECURITY_AUDIT_REPORT.md`.
- Compare this branch against the last audit and produce a before/after delta.
- Review only the React client app for token storage, XSS, exposed public config, and dangerous HTML rendering.
- Review only the Next.js server surfaces for raw queries, route authz, SSRF, webhooks, and LLM tool execution risks.
