# External Agent Gateway

External Agent Gateway is the governed runtime layer that lets Zavorth use an
external agent after the user has declared and approved a profile.

It is intentionally separate from External Agent Onboarding:

```text
onboarding -> candidate only
gateway    -> approved profile + approved invocation + receipt
```

## Profiles

Registering a profile is approval-gated:

```text
zavorth external-agent register \
  --id claude-local \
  --adapter cli \
  --command claude \
  --approve-registration \
  --enable-live
```

For untrusted CLI agents, register a strong isolation boundary:

```text
zavorth external-agent register \
  --id safe-agent \
  --adapter cli \
  --command agent \
  --isolation docker \
  --docker-image my-agent:latest \
  --read-only-root \
  --require-strong-isolation \
  --approve-registration \
  --enable-live
```

or, when the agent already lives in WSL:

```text
zavorth external-agent register \
  --id wsl-agent \
  --adapter cli \
  --command agent \
  --root C:\path\to\workspace \
  --isolation wsl \
  --wsl-distro Ubuntu-24.04 \
  --require-strong-isolation \
  --approve-registration \
  --enable-live
```

Supported adapters:

```text
cli  - invokes a local CLI with spawn, no shell interpolation
http - POSTs to a declared local endpoint
acp  - delegates through the ACP live session service
mcp  - sends a generic JSON-RPC style request to a declared endpoint
```

## Capability import

List **declared** capabilities without spawning the agent, then import them into
a local SkillIR pack under `skills/` with explicit consent.

```text
# Offline list (profile allowedCapabilities + optional JSON file)
zavorth external-agent list-capabilities --id my-agent
zavorth external-agent list-capabilities --id my-agent --capabilities-file ./caps.json

# Preview import (no write)
zavorth external-agent import-capabilities --id my-agent

# Apply import (SkillIR pack + skill.ir.json + ORIGIN)
zavorth external-agent import-capabilities --id my-agent --consent
```

Optional registration of declared capability ids:

```text
zavorth external-agent register \
  --id my-agent \
  --adapter cli \
  --command agent \
  --capabilities review,analyze,web_search \
  --approve-registration \
  --enable-live
```

Import **never** auto-runs. Live invoke is still per-call approval:

```text
zavorth external-agent run --id my-agent --prompt "…" --approve-external-execution
```

After import, packs are searchable:

```text
zavorth skill search web_search
```

Isolation modes for CLI profiles:

```text
local-supervised - command/args/cwd/env/timeout are governed, but this is not an OS sandbox
docker           - command runs through docker run with optional read-only root and network disabled by default
wsl              - command runs through wsl.exe inside the selected distro
```

If `--require-strong-isolation` is set, a `local-supervised` profile is blocked
before live invocation. This prevents Zavorth from treating plain process
supervision as a real filesystem/process sandbox.

## Invocations

Every live invocation requires explicit per-run approval:

```text
zavorth external-agent run \
  --id claude-local \
  --prompt "review this module" \
  --approve-external-execution
```

Without approval, Zavorth returns an invocation plan:

```text
status: approval-required
adapterInvoked: false
liveExecutionPerformed: false
```

## Web/API Approval Guard

The zavorthControl/API route can preview registrations and invocations, but a request
body with `approved: true` is not enough to perform live external-agent work.
Live approval through `/api/runtime/external-agents` requires the operator to set
`ZAVORTH_EXTERNAL_AGENT_API_APPROVAL_TOKEN` and send the same value in the
`x-zavorth-operator-approval` header.

If that header is missing or wrong, Zavorth ignores the body approval and keeps
the response in preview/approval-required mode:

```text
bodyApprovalIgnored: true
apiApprovalAccepted: false
```

## What Zavorth Can See

For CLI profiles, Zavorth sees:

```text
command
args
cwd
stdout
stderr
exit code
timeout
isolation kind
whether a strong boundary was used
receipt metadata
```

For HTTP/MCP profiles, Zavorth sees:

```text
endpoint
HTTP status
response body
timeout/failure
receipt metadata
```

For ACP profiles, Zavorth sees:

```text
ACP session status
events
tool requests
tool decisions
output text
receipt metadata
```

## What Zavorth Does Not Do By Default

```text
no external agent becomes the default runtime
no external tool is exposed directly
no shell string is interpolated
no secrets are serialized into receipts
no remote endpoint is allowed unless the profile explicitly allows it
no invocation runs without approval
no untrusted CLI profile marked as requiring strong isolation can run locally
```

The external agent is a delegated capability. Zavorth remains the owner of
policy, memory, approval, receipts, and final decision-making.
