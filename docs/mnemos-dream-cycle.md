# Mnemos Dream Cycle

Mnemos Dream Cycle is Zavorth's memory consolidation pass. It runs as a
reviewable job: read old sessions and memory notes, produce a separate
candidate memory store, then wait for the user or operator to apply or reject.

The scheduler policy can decide when a dream cycle is eligible. The default
decision is conservative: at least 24 hours since the previous cycle, at least
5 sessions since the previous cycle and a 30 minute idle window.

## What It Does

- merges duplicate memories with evidence references;
- prunes stale low-confidence observations;
- refreshes relative date references against the current day;
- resolves contradictions by recency and evidence;
- quarantines secrets, sensitive user-model records and policy changes.

## User Control

The source memory store is immutable during the cycle. The output store is a
candidate. Applying it requires approval and creates a rollback receipt. Rejecting
it leaves the current memory untouched.

## Safety

- secrets are redacted before candidate writes;
- sensitive psychology is not converted into normal memory;
- policy and approval changes are never dream-applied;
- every candidate memory keeps evidence refs, confidence and expiry.
- the scheduler decision does not mutate memory; it only decides whether a
  dream cycle should be queued.

## Commands

```bash
npm run mnemos:dream-cycle --silent
npm run mnemos:dream-cycle:json --silent
npm run mnemos:dream-cycle:check --silent
```
