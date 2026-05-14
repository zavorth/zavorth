# Quickstart

This is the shortest path into Zavorth.

## Requirements

- Node runtime 18 or newer;
- npm;
- a terminal on Windows, macOS or Linux;
- provider credentials only when you decide to enable a remote model.

## From The Published Package

```bash
npm install -g zavorth@latest
zavorth onboard
zavorth onboard doctor
zavorth go
zavorth doctor --simple
```

The long-term product path is a private local runtime/installer. The npm package is the clean developer install path while the protected installer is prepared.

## From This Repository

```bash
npm install
npm run setup
npm run go
npm run doctor
```

`npm run go` starts the local runtime path and opens or prints the Dashboard
URL at `/dashboard`.

## First Run Flow

1. Run `zavorth onboard` to see the unified first-run journey.
2. Open the Dashboard.
3. Pick a guided mission template.
4. Ask for work in normal language.
5. Review approvals when Zavorth wants to write, run commands, use network or
   touch sensitive resources.
6. Read the receipt when the mission finishes or gets blocked.
7. Use `doctor --simple` when something is missing.

Typical prompts:

- `review this repository and list the risks`
- `check whether my channels are ready`
- `use subagents to audit this folder`
- `look at the connected Android device and summarize the screen`
- `schedule a daily status summary`

## Important Commands

```bash
zavorth onboard
zavorth onboard doctor
zavorth onboard templates
zavorth onboard first-mission
zavorth setup
zavorth go
zavorth status
zavorth doctor
zavorth templates
zavorth missions
zavorth receipts
zavorth run "review this repo"
```

`zavorth onboard` is read-only and shows the unified journey. Use
`zavorth onboard apply` or `zavorth setup` only when you want to run the setup
flow.

For a cloned repo:

```bash
npm run setup
npm run go
npm run status
npm run doctor
npm run runtime:check
npm run security:secrets
```

## Data And Secrets

- Raw provider keys should not be pasted into chat.
- Credentials are represented as `SecretRef` metadata.
- Sensitive actions require policy, approval and receipts.
- Raw external SQLite/session history is not imported by default.

## Next

- [CLI](/docs/34-zavorth-cli.md)
- [Web Dashboard](/docs/07-web.md)
- [Operations](/docs/09-operations.md)
- [Security](/docs/05-security.md)
- [Roadmap](/docs/11-roadmap.md)
