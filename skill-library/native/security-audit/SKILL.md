---
name: Security Audit
description: Review code, runtime, policies, prompts, channels, and tools for security risks with evidence-first findings.
license: Zavorth-Internal
---

# Security Audit

Use this native skill for security review of Zavorth surfaces or user projects.

## Operating Rules

- Prioritize exploitable behavior over style.
- Cite concrete files, routes, settings, or policy decisions.
- Separate confirmed findings from hypotheses.
- Check data exfiltration, prompt injection, SSRF, unsafe tools, secrets, and approval bypass.
- Do not expose raw secrets in the answer.

## Output

Return findings ordered by severity, residual risk, and focused remediation steps.
