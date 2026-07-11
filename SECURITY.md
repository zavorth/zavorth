# Security Policy

Zavorth is a **local-first, governed agent runtime**. Security is part of the product contract — not an afterthought.

## Supported versions

| Version | Supported |
| --- | --- |
| `2.x` (main) | ✅ |
| Older majors | Best-effort fixes only |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

1. Prefer a private report via GitHub **Security Advisories** on this repository (if enabled for your account).
2. Or contact the maintainers through the organization profile: [github.com/zavorth](https://github.com/zavorth).

Include:

- Description of the issue
- Steps to reproduce
- Impact assessment (what an attacker could do)
- Affected version / commit if known

We will acknowledge receipt as soon as practical and work on a fix before any public disclosure.

## Product security posture

- Sensitive actions go through **preview → approval → execute**
- Credentials stay **local** and must not be serialized into prompts or public logs
- Channel catalogs are **not** treated as live connectivity
- Break-glass paths remain **audited and revocable**

More detail: [docs/security.md](docs/security.md)

## Safe contribution rules

- Never commit API keys, tokens, `.env` files, or private credentials
- Prefer fixtures and redacted traces in tests
- If you find a secret already in history, report it privately — do not amplify it
