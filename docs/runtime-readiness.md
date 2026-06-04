# Runtime Readiness

Runtime readiness is the operator-facing answer to a simple question: can
Zavorth safely do useful work right now?

The readiness view should be honest. It can say a capability is available,
missing setup, waiting for credentials, outbox-only, approval-required or
blocked. It must not claim live provider, channel or sandbox behavior until the
runtime has the required configuration and a recent receipt.

## What Readiness Covers

- provider and model availability;
- channel setup and allowlists;
- approvals waiting for the user;
- receipts and recent runtime activity;
- sandbox posture;
- memory and learning state;
- connected companion or node surfaces;
- blocked actions and the reason.

## What Good Looks Like

A healthy runtime can:

- answer a normal prompt with the selected provider or local model;
- show the active profile, provider and model without exposing secrets;
- preview risky actions before they mutate files, send messages or call tools;
- require approval for sensitive actions;
- record receipts for important work;
- show missing setup in plain language.

## Live Credentials

Some integrations need real credentials or local services before they can be
considered live. Missing credentials are not a product failure by themselves.
The important rule is that Zavorth should clearly say what is missing and never
pretend that a dry-run is a live provider, live channel or live sandbox.

## Related

- [Install](/docs/install.md)
- [Operations](/docs/operations.md)
- [Provider Mesh](/docs/provider-mesh.md)
- [Channel Mesh](/docs/channel-mesh.md)
- [Security](/docs/security.md)
