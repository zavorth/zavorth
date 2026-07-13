# gmail

First-party Gmail bridge for Plugin OS.

## Capabilities

- `gmail.status` — token presence check
- `gmail.list` — `{ max? }` soft Gmail API list
- `gmail.draft` — `{ to, subject, body }` local draft only
- `gmail.send` — `{ draftId }` requires `approved===true` or permission

Never auto-sends.
