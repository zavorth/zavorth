# Zavorth Runtime Engines and Z-Canvas

This document defines the runtime rules behind the Control dashboard. The dashboard is a review and approval surface; execution authority stays in the runtime, engine policy and approval layer.

## Engines

- **Lite** handles chat, document questions and API-only work. It does not mutate the host operating system.
- **Velocity** handles fast, low-risk work inside explicitly trusted folders. It can apply accepted diffs only after the trusted workspace policy allows the target path.
- **Shield** handles sensitive, destructive, external, deployment or untrusted work. It requires sandbox review, approval and receipts before host apply.

Enterprise installs can disable Velocity with admin policy. When Velocity is disabled, routing falls back to Shield with a visible reason and a safe next action.

## Trusted Workspaces

Trusted workspaces are folder-scoped. A trusted folder is not a global permission grant.

Velocity allows only simple writes when all of these are true:

- the target path resolves inside a trusted folder;
- the path is not sensitive, such as `.env`, secrets, tokens or credentials;
- the operation is not destructive, bulk deletion, deployment, external network send or transaction-like work;
- the diff is small enough for direct apply;
- the user accepted the diff action.

The policy rejects filesystem roots, home directories, system folders, broad project parents and path traversal.

## Z-Canvas

Z-Canvas is sandbox preview first. A speculative sandbox result creates a Canvas session with:

- sandbox attempts;
- active attempt;
- preview URL;
- file snapshots from the sandbox only;
- diffs;
- operational logs;
- blocked egress events.

Canvas preview never points at the real workspace. Files are exposed only when the attempt sandbox is inside the recorded speculative run root.

Sensitive sandbox files are not rendered in preview even when the sandbox touched them. Examples: `.env`, `.ssh`, `.aws`, credentials, secrets and private-key paths. The diff/receipt can still say that a sensitive file was involved, but the preview must not leak the value.

## Safe Egress

Canvas preview blocks external network by default. Local assets are allowed. External `fetch`, XHR, WebSocket, EventSource, beacon and popup egress are intercepted and recorded as blocked Canvas events.

## Diff Apply

Interactive diff review supports accepting or rejecting files and hunks.

- Velocity can apply accepted diffs directly only inside trusted folders.
- Shield turns accepted diffs into approval-required work.
- Rejecting a hunk or file requires sandbox recomposition before apply.
- Oversized diffs or targets are blocked and promoted to Shield review.

## Glass Box Trace

Glass Box exposes operational trace, not chain-of-thought. Allowed events include engine decisions, express routes, sandbox attempts, commands, build errors, diffs, approvals, receipts, Canvas sync and blocked egress.

Velocity trace is compact. Shield trace is full and audit-oriented. Lite keeps trace hidden by default.

## Attachment Safety

Attachments are treated as context, not instructions. Text extracted from PDFs, documents, spreadsheets, images or audio may contain prompt injection. When attachment text asks Zavorth to ignore instructions, reveal secrets, execute commands or exfiltrate data, the attachment profile marks it as untrusted instruction-injection content. The user request remains the authority; embedded instructions inside files do not change engine policy.

## Operator Checklist

When reviewing runtime and Canvas behavior, validate:

- Inbox request routes through the engine router.
- Visual or UI work recommends Z-Canvas.
- Trusted folder edits generate a diff and apply only after accept.
- The same edit outside trust routes to Shield.
- `.env` and secrets do not render in Canvas preview.
- External iframe/network egress is blocked.
- History tells the story: request, route, preview/diff, approval, apply or block, receipt.
- Mobile keeps the composer primary actions visible and folds secondary actions under the plus menu.
