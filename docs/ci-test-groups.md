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
npm run test:ci:runtime-sessions
npm run test:ci:runtime-other
npm run test:ci:integration
npm run test:ci:platform
```

`npm test` now runs `scripts/run-jest-ci-groups.mjs`, which executes groups sequentially with a timeout per group. Historical release-evidence suites are not part of the product repository; current runtime coverage lives in `runtime-agent`, `runtime-sessions`, `runtime-other`, integration, platform and security groups.

Override the timeout when investigating a slow group:

```bash
npm run test:ci:runtime-other -- --timeout-ms=900000
```

When a group fails or times out, fix that group directly instead of rerunning the full suite.
