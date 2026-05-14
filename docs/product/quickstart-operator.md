# Operator Quickstart

Use this path when you operate Zavorth day to day.

## Mental Model

The normal user path is natural-first:

```text
connect Zavorth to Slack
which channel is best for approvals?
review why this build failed
check whether the runtime is ready
```

The steps below are for host setup and readiness validation.

## 1. Install

```powershell
powershell -ExecutionPolicy Bypass -File install/install.ps1 -Profile Operator
```

The installer prepares local runtime state, `.zavorth` helpers and the operator shell path.

## 2. Readiness

```bash
npm run setup
npm run status -- --json
npm run doctor -- --json
```

## 3. Node And Companion Checks

```bash
npm run test:nodes:smoke
```

If a local companion launcher exists, it is usually available at:

```text
.zavorth/companion-start.ps1
```

## 4. Operate

Open:

```text
http://127.0.0.1:33333/dashboard
```

Then use the dashboard for sessions, approvals, nodes, transports and integrations.

## Safety Notes

- A desktop companion adds a local allowlist, but it does not replace gateway policy.
- Channels should start closed and become live only after doctor checks and approval.
- Raw credentials should stay out of prompts and docs; use `SecretRef`-style metadata.
