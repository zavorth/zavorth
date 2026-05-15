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
zavorth daily
zavorth onboard conversation
zavorth onboard doctor
zavorth go
zavorth doctor --simple
zavorth missions guide --intent "organize my day"
zavorth capability-store
zavorth do-it-with-me "help me configure Telegram approvals"
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
2. Run `zavorth onboard conversation` to preview the human calibration questions.
3. Run `zavorth missions guide` or open the Dashboard mission cards.
4. Pick a guided mission template.
5. Ask for work in normal language.
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
zavorth daily
zavorth onboard conversation
zavorth onboard doctor
zavorth onboard templates
zavorth onboard first-mission
zavorth setup
zavorth go
zavorth status
zavorth doctor
zavorth templates
zavorth missions guide
zavorth capability-store --category communication
zavorth do-it-with-me "review this repo safely"
zavorth trust-panel
zavorth autonomy --level conservative
zavorth model-cost "review this repository" --max-cents 100
zavorth visual-receipts
zavorth satellite-approvals
zavorth ask-runtime "which providers are ready?"
zavorth dashboard-home
zavorth cli-home
zavorth experience-certify
zavorth missions
zavorth receipts
zavorth run "review this repo"
```

`zavorth onboard` is read-only and shows the unified journey. `zavorth onboard
conversation` is also read-only by default: it previews agent name, user name,
language, experience profile and first safe mission. Use `zavorth onboard
conversation --apply --confirm-local-profile` only when you want to update local
profile files: `IDENTITY.md`, `USER.md` and `SOUL.md`. Never paste provider
keys or bot tokens there; use SecretRefs/provider setup instead.

`zavorth trust-panel` is read-only and explains what Zavorth can do alone, what
requires approval, what is blocked and what needs setup.
`zavorth autonomy --level <level>` previews Conservative, Balanced, Advanced or
Business autonomy without applying hidden authority or bypassing Policy Broker.
`zavorth model-cost` estimates model cost risk and requires visible budget
boundaries before hosted live model escalation.
`zavorth visual-receipts` turns runtime evidence into readable receipt cards
with impact, rollback state, exports and safe next actions.
`zavorth satellite-approvals` shows the mobile/PWA approval companion contract:
approval cards, receipt previews and governed approve/deny envelopes for
`/satellite`.
`zavorth ask-runtime "<question>"` answers operational questions such as
provider readiness, channel readiness, pending approvals, receipts, setup gaps
and safety boundaries from read-only projections.
`zavorth dashboard-home` previews the simple `/dashboard` home contract with
guided starts and natural runtime questions.
`zavorth daily` or `zavorth cli-home` gives the same gentle start in the
terminal: guided missions, runtime questions, trust, receipts and Satellite
approval shortcuts without hidden execution authority.
`zavorth experience-certify` checks that all Experience Layer pieces are wired
together for daily use without granting hidden execution authority.

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
