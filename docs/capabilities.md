# Zavorth Capabilities

Capabilities are the things Zavorth can use when a request needs more than a plain chat reply: tools, adapters, skills, channels, provider routes or other runtime abilities.

A capability becoming visible does not mean it can act silently. Anything that can change files, call tools, send data, activate a connector or touch external state still goes through preview, approval and receipts.

## Where To See Capabilities

- Dashboard: open `Ferramentas` and look for verified capabilities.
- Terminal: run `zavorth tui` and open the Capability actions panel.
- Setup: run `zavorth setup` to see what is available during First Light.
- CLI: use `zavorth actions lookup capabilities` for a compact list.

## How To Use One

1. Ask Zavorth naturally for the task you want.
2. If a first-class capability exists, Zavorth routes the request through the Action Harness.
3. Review the preview before anything important happens.
4. Approve only the scoped action you actually want.
5. Read the receipt after the action finishes.

## Useful Commands

- List capabilities: `zavorth actions lookup capabilities`
- Find a route: `zavorth actions lookup <what you want to do>`
- Preview an action: `zavorth actions preview <action-id>`
- Approve a request: `zavorth approve <approval-id>`
- Read receipts: `zavorth actions receipts --action <action-id>`
- Review local usage signals: `zavorth actions usage`
- Review lifecycle decisions: `zavorth actions lifecycle`

## Current Verified Actions

No verified capability action is exposed yet.

When Zavorth verifies a new adapter and exposes it through the Action Harness, it appears in the dashboard, the terminal TUI and this generated list.

## Safety Rules

- A visible capability is not automatic permission.
- Secrets should stay in local environment configuration or SecretRefs, not in chat.
- New or sensitive abilities start with preview.
- Risky work requires explicit approval.
- Every approved action should leave a receipt.

## Local Usage Signals

Zavorth can keep local usage signals for capabilities: whether a route was shown, previewed, approved, blocked, abandoned or completed successfully.

These signals stay on the machine. They do not include prompt text, raw secrets, message content or external analytics. Zavorth uses the aggregate pattern to decide what should be promoted, kept learning, inspected or archived.

## Lifecycle Decisions

Zavorth can turn local usage signals into lifecycle decisions: promote a capability, keep it learning, inspect it, or archive it from daily suggestions.

Promotion and archive decisions are reversible and approval-aware. They do not delete files, activate a live connector, send data or bypass the Action Harness.

## Troubleshooting

- If the dashboard shows `0 available`, run `zavorth actions lookup capabilities` to confirm the runtime view.
- If a capability is missing, run `zavorth doctor` and check provider, channel or connector setup.
- If a preview is blocked, read the reason before changing policy.

## Related

- [Security](/docs/security.md)
- [Effect Boundary](/docs/effect-boundary.md)
- [Provider Mesh](/docs/provider-mesh.md)
- [Channel Mesh](/docs/channel-mesh.md)
- [CLI](/docs/zavorth-cli.md)
