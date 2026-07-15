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
- changes that do not match the approved preview;
- free-text chat that tries to apply without a structured command.

## Why This Matters

Zavorth can be powerful without being reckless. The user should get help editing
code and docs, but the runtime should keep a clear boundary between suggestion,
preview and mutation.

## Commands

- `preview` is the default mode and never writes to the file:
 `/selfmod <relative_file> -- <instruction>`
- `goal` specifies a self-modification goal to perform:
 `/selfmod goal -- <goal>`
- `apply` is explicit and only applies a proposal previously reviewed by `preview_id`:
 `/selfmod apply <preview_id>`
- `rollback` reverts a change by `change_id`:
 `/selfmod rollback <change_id>`

## Multi-file preview

Structured multi-file / multi-hunk packs share **one** `preview_id` and an atomic
rollback plan (reverse-order restore of previous contents).

API (programmatic / agent tool surface):

```ts
await selfmod.createMultiFilePreview({
 requestedBy: 'operator',
 summary: 'Add skill pack files via selfmod',
 files: [
 { relativePath: 'skills/my-pack/SKILL.md', content: '...' },
 { relativePath: 'skills/my-pack/manifest.json', content: '...' },
 ],
 // optional apply gate:
 validationCommands: ['npm run test -- --testPathPattern=Skill'],
});
// review diffs → /selfmod apply <preview_id>
// optional: /selfmod rollback <change_id>
```

### Golden path: add a skill pack via selfmod

1. Prepare contents for `skills/<id>/SKILL.md` (+ optional `manifest.json`).
2. `createMultiFilePreview({ files: [...] })` → note `preview_id`.
3. Review `diffSummary` / shadow workspace under `tmp/selfmod-shadow-workspaces/`.
4. `/selfmod apply <preview_id>` (owner/trusted only).
5. Receipt under `data/runtime/selfmod-history/<change_id>.json`.
6. Optional promote for _learned drafts_: `zavorth learn promote <id> --kind skill`
 (never auto-promote). Apply success may include a promote hint when paths are under `skills/` or `plugins/`.

## Path policy

Config: `config/selfmod-path-policy.json`

| Paths | Tier | Notes |
| ----------------------------------------------------------------------------------------------- | -------- | ------------------------------------------- |
| `skills/**`, `plugins/**`, `docs/**`, `config/**` (incl. `*sources*`), `tests/**`, `scripts/**` | standard | Default allow |
| `src/**` | core | Requires **BUILD** mode + **owner/trusted** |
| `node_modules/**`, `.env*`, `data/secrets/**`, `dist/**` | blocked | Always denied |

Standard-tier previews skip the full project `npm run build` deep validation so
skill/plugin packs stay fast; core `src/` still runs deep validation when previewed.

## Validation gate on apply

Optional `validationCommands[]` on the multi-file preview (or policy
`requireValidationCommandsOnApply` + `validationCommands` in config).

- Run **before** any disk mutation.
- Allowlisted binaries only: `node`, `npm`, `npx`, `pnpm`, `yarn`.
- Failure blocks apply; no partial writes.

## Policy & Security

- `apply` and `rollback` are restricted to `owner` or `trusted` users.
- Self-modification requires a private chat and requires `BUILD` mode.
- Free-text chat does **not** apply; only structured `/selfmod apply <preview_id>`.

## Receipts

Every successful apply writes a history receipt:

`data/runtime/selfmod-history/<change_id>.json`

Fields include `previewId`, `changes[]` (previous/next content hashes), and enough
data for `/selfmod rollback <change_id>`.

## Related

- [Security](/docs/security.md)
- [Operations](/docs/operations.md)
- [Troubleshooting](/docs/troubleshooting.md)
- [Ecosystem waves](/docs/product/ecosystem-extension-waves.md)
- [Experience skill promote](/docs/product/experience-skill-learning-loop.md)
