# Zavorth Terminal Cockpit Preview

This folder is a standalone terminal prototype for the future Zavorth cockpit.
It uses Ink for the rich terminal frame and keeps the Zavorth fox identity, governed-runtime language, receipts and trust-plane vocabulary.

The preview intentionally avoids full-screen auto-redraw loops. Ink renders the cockpit once, unmounts cleanly, then a stable prompt appends command output below it.

## Run

From this folder:

```bash
npm run dev
```

or:

```bash
npm start
```

Direct execution also works:

```bash
npx tsx index.tsx
```

Render the Ink cockpit once and exit:

```bash
npm run once
```

`npm tsx index.tsx` is not a valid npm command.

## Controls

- `/overview`: show capability mesh
- `/agents`: show governed subagent deck
- `/skills`: show skill memory and governed skills
- `/receipts`: show receipt preview
- `/doctor`: show local readiness summary
- `/control`: show Command Center hint
- `/clear`: clear once and reprint the banner
- `/exit`: exit preview
