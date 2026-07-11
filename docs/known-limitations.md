# Known limitations

Honest product limitations for Zavorth 2.x local-first runtime.

## Runtime / product

- **Live LLM chat** requires configured providers; offline home/help/doctor do not invent answers.
- **Channels** (Telegram, Discord, etc.) need operator credentials; factory presence ≠ live send.
- **Desktop installers / signing** are ops/distribution concerns; npm package mode is the default verified path.
- **Retention R2** (day-1 return) is calendar-gated and is not auto-passed by day-0 sessions.
- **Browser preview / design-system** gates may soft-skip when Vite-only paths apply.

## Security

- Classic Control mutations require loopback auth / mutation token; remote exposure is out of default local posture.
- Secret scanning and supply-chain guards block CI; they do not replace human review of new dependencies.

## Testing honesty

- Hermetic dogfood expands ~110 missions to pass / fail / **blocked**.
- Blocked means “needs interactive, live, or calendar input” — not a silent pass.

## Docs drift

If a gate and a prose claim disagree, trust the gate output and update the doc.
