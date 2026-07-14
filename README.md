<p align="center">
  <img src="assets/brand/zavorth-hero-banner.png" alt="Zavorth — governed AI agent runtime" width="100%">
</p>

<p align="center">
  <img src="assets/brand/zavorth-mascot.svg" alt="Zavorth mascot" width="96" height="96">
</p>

<h1 align="center">Zavorth</h1>

<p align="center">
  <strong>Your AI that does things — and proves it.</strong><br>
  Ask naturally. Approve only real risk. Keep receipts for every completed run.
</p>

<p align="center">
  <a href="https://github.com/zavorth/zavorth/actions"><img src="https://img.shields.io/github/actions/workflow/status/zavorth/zavorth/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="MIT License"></a>
  <a href="docs/security.md"><img src="https://img.shields.io/badge/security-governed-0f766e?style=flat-square" alt="Governed security"></a>
</p>

Zavorth is a local-first agent runtime for useful work with visible plans, scoped approvals, controlled memory, and verifiable execution. It connects the same governed agent to Desktop, Zavorth Control, CLI/TUI, and channels without turning natural language into hidden shell shortcuts.

## Start Fast

Requires Node.js 18 or newer; Node.js 20+ is recommended.

```bash
npm install
npx zavorth setup
npx zavorth start
npx zavorth open
```

`zavorth open` launches the official Control experience. The runtime also exposes it at `/control`; `/zavorthControl` remains a compatible product route.

Start a terminal conversation at any time:

```bash
zavorth chat
```

For a fresh workspace, follow [BOOTSTRAP.md](BOOTSTRAP.md). For every CLI command and TUI workflow, see [docs/zavorth-cli.md](docs/zavorth-cli.md).

## How it works

```text
you ask → Zavorth plans → you approve sensitive steps → it executes → you receive proof
```

- Natural requests stay with the agent planner instead of regex routing.
- Tool parameters cross runtime schemas and policy gates before execution.
- Sensitive changes require explicit, scoped, expiring approvals.
- Receipts record what ran, when it ran, and what changed.
- Memory is workspace-scoped, consent-aware, inspectable, and removable.
- Desktop, Control, CLI/TUI, and channels share the same runtime truth.

## Surfaces

| Surface | Best for |
|---|---|
| Desktop | Daily chat, files, workboard, automations, approvals, receipts, and settings |
| Zavorth Control | Runtime operations, providers, channels, sessions, nodes, and diagnostics |
| CLI/TUI | Fast setup, repair, scripting, and keyboard-first work |
| Channels | Governed remote interaction through Telegram and supported integrations |

The Desktop keeps terminal and logs inside a deliberate workspace rail. They do not float over unrelated user sessions. Runtime readiness is shown as a compact status control with guided repair instead of a blocking alert.

## Trust model

Zavorth treats model output, tool output, retrieved content, and channel input as untrusted until validated. High-risk execution uses the strongest available sandbox and fails closed when a required MicroVM is unavailable. Secrets remain in secure configuration, not in prompts, receipts, or client bundles.

Useful commands:

```bash
zavorth status
zavorth doctor
zavorth providers
zavorth capabilities
zavorth approvals
zavorth receipts
```

## Controlled self-modification

Self-change is preview-first. A proposal does not write until an authorized user explicitly applies the reviewed preview.

```text
/selfmod <relative_file> -- <instruction>
/selfmod goal -- <goal>
/selfmod apply <preview_id>
/selfmod rollback <change_id>
```

See [docs/self-modification.md](docs/self-modification.md) for scope, authorization, rollback, and audit behavior.

## Documentation

- [Quickstart](docs/quickstart.md)
- [CLI/TUI reference](docs/zavorth-cli.md)
- [Desktop guide](docs/desktop.md)
- [Zavorth Control](docs/web-zavorthControl.md)
- [Security model](docs/security.md)
- [Architecture](docs/architecture.md)
- [Product direction](docs/product-direction.md)
- [Operations](docs/operations.md)
- [Contributing](CONTRIBUTING.md)

## Development

```bash
npm install
npm test
```

The repository ships dedicated type, architecture, security, visual, accessibility, and cross-surface gates. Maintainer commands live in the linked technical documentation rather than the first-use journey.

## License

MIT — see [LICENSE](LICENSE).
