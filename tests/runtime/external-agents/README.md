# External Agents Historical Evidence Tests

This folder contains many historical evidence tests from older absorption and release phases.

Current product CI does not run the whole folder as a release gate. It runs representative current contracts through:

```bash
npm run test:ci:runtime-external-1
npm run test:ci:runtime-external-2
npm run test:ci:runtime-external-3
npm run test:ci:runtime-external-4
npm run test:ci:runtime-external-5
```

Use the archive status command before treating failures here as product bugs:

```bash
npm run test:archive:external-agents
```

Some archived tests intentionally reference old numbered docs or old alpha versions. Those references are cataloged as detached historical evidence and are not unresolved current-product issues.

The raw Jest archive is opt-in:

```bash
ZAVORTH_RUN_DETACHED_ARCHIVE_JEST=1 npm run test:archive:external-agents:jest
```

Without that environment variable, the command exits green and reports the detached archive status.
