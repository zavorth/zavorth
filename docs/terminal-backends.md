# Zavorth Terminal Backends

Zavorth terminal backends unify command execution behind the same governed
contract:

```txt
intent -> terminal plan -> backend envelope -> policy -> approval -> execution -> receipt
```

The LLM can choose a backend, but the harness keeps real host authority behind
configuration, policy, approval and receipts.

## Backends

| Backend | Status | Notes |
| --- | --- | --- |
| Local | Ready | Supervised host process. Not an OS sandbox. Mutations require approval. |
| Docker | Configurable / on-demand | Container envelope with network disabled by default. If the CLI exists and Zavorth is in a light profile, it is reported as available on demand rather than being started at boot. |
| SSH | Configurable | Remote shell envelope. Requires `ZAVORTH_SSH_HOST`. |
| WSL | Configurable / on-demand on Windows | Linux runtime through `wsl.exe`. Presence can be detected without starting the Linux runtime; readiness probe is deferred until a task asks for it. |
| Vercel Sandbox | Configurable | Managed cloud sandbox. Requires `VERCEL_TOKEN` and explicit opt-in. |
| Modal | Planned | Tracked as future adapter; no live claim today. |
| Daytona | Planned | Tracked as future adapter; no live claim today. |

## Commands

```bash
zavorth execution-backends
zavorth execution-backends --backend docker --command "npm test"
zavorth execution-backends --backend local --command "npm test" --live --approval-id <id>
npm run zavorth:execution-backend-playbook -- --backend docker
npm run zavorth:runtime-profile-playbook -- --target vps-24-7
npm run zavorth:runtime-profile-playbook -- --target safe-8gb-desktop
npm run zavorth:execution-backend-playbook:check
```

## Execution Backend Playbook

The Execution Backend Playbook is the guided path for local and remote execution providers. It keeps local preview useful while making strong backends obvious:

- local supervised shell;
- Docker;
- WSL;
- Vercel Sandbox;
- SSH;
- Modal;
- Daytona.

Live mutation is never enabled by default. Strong sandbox smoke, live flag and scoped approval stay separate checks.

## Runtime Profile Playbook

The Runtime Profile Playbook is the guided path for low-resource and always-on
operation. It recommends `chat` for a small VPS, `safe-8gb` for constrained
desktops, `dev` for workstations and `full` for explicit lab sessions.

Profile selection only changes boot posture and sidecar pressure. It does not
turn dry-run into live mutation, renew expired approvals or bypass receipts.

Live terminal execution is disabled by default even when a backend is configured.
To run a command live, all of these must be true:

- the backend is configured;
- the command is reviewed;
- risky commands have a scoped approval id;
- `ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE=true` is set;
- the execution emits a redacted receipt.

On constrained notebooks, Docker and WSL can stay asleep. Zavorth may report them
as `available-on-demand` when the local executable is present, but it does not
start Docker Desktop, wake WSL or run a daemon probe just to render status. The
heavier readiness probe happens only when a governed task asks to use that
isolated executor.

## Safety Rules

- No backend is live by default.
- Docker and WSL can be available on demand without being kept live in the background.
- Docker, SSH, WSL and Vercel Sandbox must be configured before live execution.
- Modal and Daytona are explicit future adapters, not fake live integrations.
- stdout/stderr previews are redacted before serialization.
- Commands are represented as structured executable/args envelopes.
- Network/install commands and workspace mutation commands require approval.
