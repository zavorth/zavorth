# Troubleshooting

Troubleshooting works best when you identify the layer that is failing before
changing configuration.

## Start Here

```bash
npm run status
npm run doctor
npm run security:secrets
npm run runtime:check
```

Installed CLI users can use:

```bash
zavorth status
zavorth doctor
```

## Common Problems

### Dashboard Does Not Open

- confirm `go` printed a URL;
- check that no other app is using the same port;
- run `doctor`;
- verify local access from the same machine.

### A Task Is Waiting

Look for:

- missing approval;
- insufficient mode or policy;
- missing provider credential;
- channel or device not ready;
- workspace action blocked by policy.

### Provider Is Not Ready

Run the provider live canary check and confirm the required SecretRef exists.
Do not paste provider keys into chat.

### Channel Is Not Sending

Treat channel state explicitly:

- `ready`: live send path is available;
- `needs_setup`: credentials or webhook are missing;
- `outbox_only`: messages are staged locally;
- `blocked`: policy or approval stopped the send;
- `unsupported`: no live connector exists.

### Device Or Browser Inspection Fails

Check host dependencies first. A connected phone may still need USB debugging
authorization; a browser bridge may need a sidecar or supported runtime.

### Self-Modification Is Refused

Use preview first, then approval. The runtime should reject stale previews,
unsupported file types and writes outside allowed workspace policy.

## Useful Focused Checks

```bash
npm run zavorth:provider-live-canary:check
npm run zavorth:subagents:check
npm run zavorth:universal-skill-intake:check
node scripts/zavorth-channel-capability-awareness-check.mjs
node scripts/zavorth-perception-certification-check.mjs
```

## Related

- [Operations](/docs/operations.md)
- [Security](/docs/security.md)
- [Self-Modification](/docs/self-modification.md)
