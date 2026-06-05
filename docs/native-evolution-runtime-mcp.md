# Native Evolution, Runtime Profiles and MCP Intake

This page describes three Zavorth-native setup surfaces that turn advanced agent
behavior into reviewable, reversible operator flows.

## Prompt Evolution Lab

The Prompt Evolution Lab proposes prompt candidates for a selected profile or
task family. It is a lab, not an auto-patcher:

- raw system prompts are not serialized in receipts;
- secret-like values are redacted from previews;
- candidates that remove policy, approval, redaction, sandbox or receipt rules
  are blocked;
- promotion requires approval, regression checks, sandbox smoke and rollback.

```bash
npm run zavorth:prompt-evolution-lab -- --profile developer
npm run zavorth:prompt-evolution-lab:json -- --candidate-limit 5
npm run zavorth:prompt-evolution-lab:check
```

## Runtime Profile Playbooks

Runtime Profile Playbooks make low-resource and always-on operation explicit.
They do not grant extra execution authority; they only guide which sidecars load
on boot and which capabilities stay on demand.

Targets:

- `vps-24-7` uses `chat` with `minimal` fallback;
- `safe-8gb-desktop` uses `safe-8gb` with `minimal` fallback;
- `developer-workstation` uses `dev` with `desktop` fallback;
- `full-lab` uses `full` with `dev` fallback.

```bash
npm run zavorth:runtime-profile-playbook -- --target vps-24-7
npm run zavorth:runtime-profile-playbook:json -- --target safe-8gb-desktop
npm run zavorth:runtime-profile-playbook:check
```

## MCP Ecosystem Intake

MCP packages enter through the Universal Skill Intake path. Zavorth previews
them, maps declared tools, assigns risk and keeps them held for review before
any tool exposure.

Rules:

- preview only by default;
- no install or execution during intake;
- external MCP packages are never trusted automatically;
- promotion requires review, approval and the normal skill/tool wrapper path;
- hostile scripts, internal URLs, destructive shell or exfiltration instructions
  remain blocked.

```bash
npm run zavorth:mcp-ecosystem-intake -- --source ./path/to/mcp-pack
npm run zavorth:mcp-ecosystem-intake:json -- --source ./path/to/mcp-pack
npm run zavorth:mcp-ecosystem-intake:check
```

## Certification

The combined gate verifies prompt safety, runtime profile posture and MCP review
hold together:

```bash
npm run zavorth:native-evolution-runtime-mcp:check
```

## Daily Capability Flow

The Daily Capability Flow is the user-facing projection that ties the lab,
runtime playbooks, MCP intake and continuous evals together.

It shows four simple areas in text output:

- `Melhorar comportamento`: observe usage, draft a candidate, evaluate, approve,
  apply, measure and roll back if needed;
- `Rodar leve`: choose a low-resource or workstation runtime profile without
  changing execution authority;
- `Adicionar ferramenta`: preview MCP/tool sources and review them before any
  tool exposure;
- `Rodar avaliacoes`: run regression, safety and product checks before promoting
  behavior.

```bash
npm run zavorth:daily-capability-flow
npm run zavorth:daily-capability-flow:json -- --target vps-24-7 --profile personal
npm run zavorth:daily-capability-flow:check
```

This surface is projection-only. It does not install tools, run live actions,
persist eval results or apply prompt changes by itself.

For the dashboard, the same snapshot exposes eight cards:

- behavior improvement;
- memory review and forgetting;
- MCP/tool catalog review;
- skill lifecycle;
- runtime profile wizard;
- channel connection wizard;
- execution backend wizard;
- continuous evals.

Dashboard cards open review/setup routes and commands. They do not execute live
work from the dashboard.
