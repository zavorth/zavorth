# External Agent Onboarding

External Agent Onboarding is the consent-first way to tell Zavorth about an
agent that may already exist in the user's environment.

The default posture is deliberately quiet:

```text
automatic discovery: off
disk inspection: requires explicit consent
process execution: never during onboarding
network probing: never during onboarding
registration/use: separate approval later
```

## Daily Use

Start without a scan:

```text
zavorth external-agent-onboarding
```

Then give Zavorth a user-declared hint:

```text
zavorth external-agent-onboarding --path C:/agents/my-agent --consent
zavorth external-agent-onboarding --approx-path <workspace-parent> --consent
zavorth external-agent-onboarding --command claude --consent
zavorth external-agent-onboarding --endpoint http://127.0.0.1:8765/acp --consent
```

The command produces candidate records only. It does not bind the agent as a
runtime, expose tools, run commands, read credentials, scan ports, or call the
endpoint.

When the candidate looks usable, Zavorth can materialize the gateway profile for
you:

```text
zavorth external-agent-onboarding \
  --command claude \
  --consent \
  --materialize-first \
  --approve-registration \
  --enable-live
```

For a path-based candidate where the command is not obvious, give the command
override:

```text
zavorth external-agent-onboarding \
  --path C:/agents/my-agent \
  --consent \
  --materialize-first \
  --profile-command my-agent \
  --approve-registration
```

For an untrusted CLI agent, require strong isolation at registration time:

```text
zavorth external-agent-onboarding \
  --command my-agent \
  --consent \
  --materialize-first \
  --isolation docker \
  --docker-image my-agent:latest \
  --require-strong-isolation \
  --approve-registration \
  --enable-live
```

Materialization still does not invoke the external agent. It only creates the
approved External Agent Gateway profile. Every live run continues to require
per-invocation approval.

## Privacy Model

Zavorth asks the user for a specific clue first:

```text
"Quer me dizer se existe algum agente externo no ambiente?
Se sim, passe uma pasta exata, uma pasta aproximada, um comando CLI ou um
endpoint ACP/MCP. Eu so vou inspecionar o escopo que voce autorizar."
```

This means an external agent can be discovered without making the product feel
like a background scanner.

## Candidate Lifecycle

```text
user hint
-> explicit consent
-> read-only inspection
-> candidate-only record
-> operator review
-> optional approved profile materialization
-> optional dry-run adapter
-> separate approval for live use
```

Discovery is not use. Discovery only tells Zavorth what might be available.
