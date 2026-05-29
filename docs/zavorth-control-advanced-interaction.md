# ZavorthControl Zavorth-native-Class Surface

Zavorth Control at `/control` now exposes a Zavorth-native advanced operational layer on top of the existing Zavorth runtime projection.

## What It Adds

- Tool call cards: safe summaries of staged or observed tools, risk, preview and approval state.
- Subagent cards: selected worker roles, confidence, routing mode, channel and risk signals.
- Rich approval cards: approval reason, scope, risk, expected receipt and direct approve/reject actions.
- Context, token and cost meter: model route, token budget, estimated cost and tool exposure.
- Mermaid execution graph: a safe rendered subset generated from trace events, plus source text for audit.
- Realtime reconnect state: WebSocket reconnect attempts are visible and automatic.
- Message queue: sending messages, pending approvals and running events appear in one queue.
- Edit/retry message affordances: every visible message can be copied back into the composer as an edit or retry draft.

## Safety Model

The ZavorthControl remains a control surface, not an authority bypass. Sensitive actions still pass through policy, approval, sandbox and receipts. Mermaid rendering is generated from safe trace summaries only; raw chain-of-thought is never displayed.

## Validation

Run:

```bash
npm run zavorth:zavorth-control-advanced-interaction:check
```

The check verifies the contract, UI integration, reconnect path, message queue, edit/retry actions, visual CSS and product-readiness gate wiring.
