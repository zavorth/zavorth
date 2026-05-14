# Security Audit Playbook for ZavorthBridge

## Goal
Audit a Next.js or React codebase for common security issues, with extra attention to AI-assisted application patterns such as LLM endpoints, agent flows, tool execution, and prompt injection risks.

## Inputs
- the repository currently open in the IDE
- optional scope from the user, such as a folder, route group, PR diff, or branch comparison
- optional prior report for before/after comparison

## Outputs
Produce a markdown report with these sections:
1. Executive summary
2. Scope and framework detection
3. Findings grouped by severity
4. Manual review items
5. Remediation roadmap
6. Before/after deltas if a baseline exists

Each finding must include:
- title
- severity: critical | high | medium | low
- confidence: high | medium | low
- status: confirmed | probable | manual-review
- evidence
- impact
- affected files
- recommended fix

## Workflow

1. Detect framework and project shape.
   - If `app/` and `next.config.*` exist, inspect App Router paths.
   - If `pages/` exists, inspect Pages Router paths.
   - If `src/`, `public/`, `vite.config.*`, `react-scripts`, or `index.html` exist without Next.js markers, inspect as React SPA.
   - In monorepos, identify the active app package before scanning.

2. Prioritize high-risk surfaces.
   - API routes and route handlers
   - auth and session code
   - database access and raw queries
   - LLM, tool, and agent endpoints
   - upload handlers, webhooks, admin routes
   - client storage of tokens or secrets

3. Run deterministic scan.
   - Execute `node scripts/security-audit.js .`
   - Review the JSON findings
   - Do not present raw script output without checking context

4. Validate findings against source context.
   - Confirm whether the evidence really indicates a vulnerability
   - Downgrade noisy heuristics to probable or manual-review
   - Prefer confirmed findings only when code evidence is strong

5. Produce report.
   - Use `templates/security-report.md`
   - Keep the report concise, actionable, and evidence-based

6. If asked for fixes, propose minimally invasive remediations.
   - Prefer framework-native solutions
   - For Next.js, consider middleware, route handlers, server-only boundaries, secure cookies, and validation at the server boundary
   - For React SPA, prefer backend token storage, CSP, input sanitization, route guards, and safe rendering

## Coverage

### Next.js Pages Router
Inspect:
- `pages/api/**/*`
- `pages/**/*`
- `lib/**/*`
- `middleware.*`
- `next.config.*`

### Next.js App Router
Inspect:
- `app/api/**/route.*`
- `app/**/*`
- server actions
- `middleware.*`
- `next.config.*`
- `src/app/**/*`

### React SPA
Inspect:
- `src/**/*`
- `public/**/*`
- `vite.config.*`
- `webpack.config.*`
- `index.html`
- API client wrappers and auth state management

## Security priorities

### Critical
- confirmed exposed secrets
- raw SQL with direct user interpolation
- unsafe privileged tool execution from user-controlled prompt or input
- authentication bypass in admin or privileged routes
- unsigned or unverified webhook processing for sensitive actions

### High
- missing validation on server boundary
- prompt injection exposure in LLM endpoints
- SSRF patterns in server-side fetches
- token persistence in localStorage or sessionStorage
- dangerous HTML rendering with untrusted input

### Medium
- missing rate limiting on auth or expensive endpoints
- weak cookie flags
- permissive CORS for sensitive routes
- missing CSRF controls where cookie auth is used
- overexposed `NEXT_PUBLIC_*` or client config leakage

### Low
- missing security headers
- weak logging hygiene
- best-practice gaps without direct exploit path

## Guardrails
- Never claim a finding is confirmed without source evidence.
- Separate severity from confidence.
- If a pattern might be framework-supported elsewhere, mark manual-review.
- Do not treat the existence of `.env` as critical by itself; only escalate if it appears tracked, exposed, copied to client code, or committed.
- For React projects, assume browser code is untrusted and prioritize secret exposure and token handling.

## Common manual review prompts
- Verify whether admin routes are protected by upstream middleware.
- Verify whether a raw query builder safely parameterizes values.
- Verify whether sanitization exists in a shared utility instead of the local file.
- Verify whether LLM tool calls enforce allowlists, authz, and argument validation.

## Example agent request
"Audit this repository using ZAVORTH_BRIDGE.md. Start with API, auth, secrets, and AI integration surfaces. Run the scanner, review the top findings manually, and generate SECURITY_AUDIT_REPORT.md."
