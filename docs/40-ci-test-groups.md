# CI Test Groups

The Jest suite is intentionally split by runtime surface. Do not run the whole tree as one silent monolith in CI.

Use:

```bash
npm run test:ci:list
npm run test:ci:security
npm run test:ci:api
npm run test:ci:ai-gateway
npm run test:ci:domain-dashboard
npm run test:ci:domain-web
npm run test:ci:domain-shared
npm run test:ci:telegram
npm run test:ci:channels
npm run test:ci:services
npm run test:ci:runtime-agent
npm run test:ci:runtime-external-1
npm run test:ci:runtime-external-2
npm run test:ci:runtime-external-3
npm run test:ci:runtime-external-4
npm run test:ci:runtime-external-5
npm run test:ci:runtime-sessions
npm run test:ci:runtime-other
npm run test:ci:integration
npm run test:ci:platform
```

`npm test` now runs `scripts/run-jest-ci-groups.mjs`, which executes groups sequentially with a timeout per group. The `runtime-external-*` groups use the representative external-agent contract pack set instead of the archived full historical evidence suite, because older release tests assert obsolete package versions and removed numbered docs.

For historical evidence status, use:

```bash
npm run test:archive:external-agents
npm run test:archive:external-agents:json
npm run test:archive:external-agents:json -- --details
```

That command does not run raw Jest. It reports the archive as resolved and detached from the current product gate, including old numbered-doc references or alpha-version assertions only as historical inventory.

For raw historical investigation only, use:

```bash
ZAVORTH_RUN_DETACHED_ARCHIVE_JEST=1 npm run test:archive:external-agents:jest -- --testTimeout=30000
```

Without `ZAVORTH_RUN_DETACHED_ARCHIVE_JEST=1`, `npm run test:archive:external-agents:jest` exits green and explains that the historical suite is detached. The raw mode is intentionally not part of `npm test` or `npm run test:ci`; it is an archive/audit command for old release evidence, not the current product gate. Do not downgrade the package version or recreate removed release docs just to satisfy archived expectations.

Override the timeout when investigating a slow group:

```bash
npm run test:ci:runtime-external-1 -- --timeout-ms=900000
```

When a group fails or times out, fix that group directly instead of rerunning the full suite.
