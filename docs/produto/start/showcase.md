---
title: "Showcase"
description: "Examples of daily work Zavorth can support."
---

Zavorth is built for governed daily work: ask naturally, review sensitive actions, and keep receipts.

## Development and code

<CardGroup cols={2}>

<Card title="PR review by Telegram" icon="code-pull-request">
  **Developer workflow** - `github` `telegram` `review`

  Ask Zavorth to review a pull request. It reads the diff, lists what changed, flags potential issues, and returns a verdict with a receipt.
</Card>

<Card title="Code review loop" icon="rotate">
  **Native workflow** - `review` `multi-agent`

  Zavorth can split a deep review into bounded subagent work, synthesize the evidence, and return one governed answer.
</Card>

<Card title="Bug fix with approval" icon="moon">
  **Automation** - `approval` `receipt`

  Queue a task like "find and fix the failing tests." Zavorth pauses when it needs to change files and waits for approval.
</Card>

<Card title="Explain this repo" icon="book-open">
  **Onboarding** - `memory` `semantic`

  Ask Zavorth to explain a codebase and store the overview for future questions.
</Card>

</CardGroup>

## Automation and workflows

<CardGroup cols={2}>

<Card title="Morning briefing" icon="sun">
  **Scheduling** - `memory` `telegram`

  Zavorth can summarize calendar items, open tasks and recent repository activity into a daily briefing.
</Card>

<Card title="Support watcher" icon="slack">
  **Channel automation** - `channels` `skills`

  Zavorth can draft replies in a support channel and ask for approval before posting.
</Card>

</CardGroup>

## Knowledge and memory

<CardGroup cols={2}>

<Card title="Decision history" icon="clock-rotate-left">
  **Memory** - `mnemos` `semantic`

  Ask "what did we decide about auth last month?" and Zavorth searches local memory for context.
</Card>

<Card title="Document indexer" icon="folder-open">
  **Memory ingestion** - `wiki`

  Put project docs in `.zavorth/wiki/` so future answers can use that local knowledge.
</Card>

</CardGroup>

## Multi-agent work

<CardGroup cols={2}>

<Card title="Parallel subagents" icon="code-fork">
  **Swarm** - `multi-agent` `parallel`

  For large tasks, Zavorth can split work across bounded subagents and synthesize the results.
</Card>

</CardGroup>
