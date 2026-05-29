# ZavorthControl Visual Real QA

This note documents the official visual QA gate for the Zavorth zavorthControl.
It is intentionally short and operational: the source of truth is the product
runtime and the scripts wired in `package.json`.

## Gates

Run the fixture/browser preview gate:

```bash
npm run qa:zavorthControl-browser-preview
```

Run the real ZavorthControl flow gate:

```bash
npm run qa:zavorthControl-real
```

Run the live visual gate when a local zavorthControl is available and unlocked:

```bash
npm run qa:zavorthControl-live-visual
```

## What It Proves

- A risky request creates an approval instead of executing directly.
- Approval completion clears stale pending state.
- The zavorthControl receives an artifact after the governed run completes.
- Replay and history remain visible for the same session.
- The replay lane stays readable as evidence, not as raw model reasoning.
- Live visual checks reject demo-only data and protected-state confusion.

## Safety

These QA scripts are preview-first. They must not send external channel
messages, leak tokens, or bypass the policy broker. Mutable work remains
approval-gated and runtime-owned.
