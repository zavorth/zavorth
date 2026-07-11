# Support

## Self-serve first

1. Run `zavorth doctor` and fix reported blockers.
2. Read [product guided troubleshooting](./product/guided-troubleshooting.md).
3. Check [known limitations](./known-limitations.md).
4. Review [honesty readiness](./product/honesty-readiness.md) if a surface looks “down”.

## Report a bug

Use the GitHub issue templates under `.github/ISSUE_TEMPLATE/`:

- Bug report
- Feature request
- Security hardening

Include: OS, Node version, `zavorth --version`, doctor output (redact secrets), and the dogfood mission ID if relevant.

## Security

Do not open public issues for active exploit details. Prefer private coordinated disclosure and the security template/workflow.

## What support is not

- Live store signing or enterprise SLA is not implied by this repo’s hermetic gates.
- Channel credentials are operator-owned; maintainers cannot “certify live” without your tokens.
