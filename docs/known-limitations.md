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
- **Agent smartness (hermetic)** (`npm run agent:smartness:check`) is a unit scoreboard (tool classify, memory honesty, structured recovery). It is **not** a live LLM IQ leaderboard.
- **Live agent IQ** requires provider credentials (e.g. `GEMINI_API_KEY`) and an explicit opt-in: `npm run agent:smartness:live` with `ZAVORTH_LIVE_SMARTNESS=1` (or `--live`). Without credentials, live missions stay **blocked** — never a silent pass. The tool `zavorth_agent_eval` marks `simulated: true` / `liveLlmEval: false` on public responses.

## Docs drift

If a gate and a prose claim disagree, trust the gate output and update the doc.
