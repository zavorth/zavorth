# Self-Modification

Self-modification lets Zavorth propose changes to its own workspace without
turning every chat message into a write operation.

## Rule

Preview first. Apply only after policy and approval.

## Safe Flow

1. The user asks for a change.
2. Zavorth prepares a preview or diff.
3. Policy checks path, file type, risk and workspace scope.
4. The user approves the exact change.
5. Zavorth applies and records a receipt.

## What Should Be Blocked

- writes outside the approved workspace;
- stale previews;
- unsupported file types;
- hidden command execution;
- secret exposure;
- changes that do not match the approved preview.

## Why This Matters

Zavorth can be powerful without being reckless. The user should get help editing
code and docs, but the runtime should keep a clear boundary between suggestion,
preview and mutation.

## Related

- [Security](/docs/05-security.md)
- [Operations](/docs/09-operations.md)
- [Troubleshooting](/docs/10-troubleshooting.md)
