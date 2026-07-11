# Contributing to Zavorth

Thanks for helping make Zavorth better.

## Ground rules

1. **No secrets** — never commit keys, tokens, `.env`, or private workspaces.
2. **Small PRs** — focused changes review faster and land safer.
3. **Honest status** — don’t claim a channel/provider is live unless it is.
4. **Trust model** — preserve preview / approval / receipt paths for risky work.

## Dev setup

```bash
git clone https://github.com/zavorth/zavorth.git
cd zavorth
npm install
```

Useful checks:

```bash
npm run runtime:check          # TypeScript noEmit
npm run test:ci:security       # security CI group
npm run test:ci:channels       # channels CI group
```

Desktop app (optional):

```bash
cd apps/zavorth-desktop
npm install
npm run dev
```

## Pull requests

- Describe **what** changed and **why**
- Link related issues
- Note how you verified (commands + results)
- Update docs when public CLI / security / UX contracts change

## Issue reports

Use the issue templates when possible:

- Bug report
- Feature request
- Security hardening (non-sensitive suggestions only)

For real vulnerabilities, see [SECURITY.md](SECURITY.md).

## Code style

- TypeScript-first in `src/`
- Prefer clear names over clever abstractions
- Keep public CLI surface documented (`zavorth product commands`)

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
