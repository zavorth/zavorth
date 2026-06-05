# Dynamic Mission Harness

The Dynamic Mission Harness turns a complex request into a safe mission
preview before any worker runs.

It is built for work that benefits from multiple independent passes:

- classify and act;
- fanout and synthesize;
- adversarial verification;
- generate and filter;
- tournament judging;
- loop until done, with checkpoints.

## Product Behavior

The user chooses a depth mode: `normal`, `deep`, `mission` or `adversarial`.
Zavorth then shows the task plan, worker roles, checkpoints, budget caps and
approval reasons. Write, shell, network, external send, provider changes and
elevated budgets require approval.

The harness is declarative. It does not execute generated code. After approval,
it can materialize the preview into a durable `WorkflowRunService` run with
pending phases, checkpoints and receipts. Worker execution still happens only
through the normal governed path.

## Safety

- hard caps limit agents, depth, tokens, cost and duration;
- mission previews redact secrets before prompts, tasks or receipts;
- resumable checkpoints are explicit;
- approved materialization creates pending workflow phases only;
- synthesis requires worker evidence;
- generated scripts are never run as an implicit side effect.

## Commands

```bash
npm run zavorth:dynamic-mission-harness --silent
npm run zavorth:dynamic-mission-harness:json --silent -- --mode=adversarial --effects=read,write,shell
npm run zavorth:dynamic-mission-harness:check --silent
```
