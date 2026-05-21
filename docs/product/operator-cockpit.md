# Command Center

`/control` is the official web gateway for Zavorth.

## What You See First

The cockpit should answer one question quickly:

> What is ready, what is blocked and what is the next safe action?

Primary blocks:

- chat;
- runtime readiness;
- provider and channel status;
- approvals when they exist;
- recent receipts;
- safe next actions.

## One-Minute Flow

1. Open `http://127.0.0.1:33333/control`.
2. Validate local access.
3. Read the next safe action.
4. Review runtime status and pending approvals.
5. Open sessions, nodes, transports or integrations only when needed.

If the installer created a helper, use:

```powershell
.zavorth/open-web-shell.ps1
```

## When To Use Terminal

Use CLI when you need automation, JSON output or quick diagnostics:

```bash
zavorth status
zavorth doctor
zavorth help
```

## Product Rule

If an operator can understand readiness and act safely without opening legacy surfaces, the Command Center is doing its job.
