# External Agents Archive Status

Status: resolved-detached-from-current-product-gate

The full `tests/runtime/external-agents` tree is historical evidence. It is not the current Zavorth product gate.

Current gate:

```bash
npm test
npm run test:ci
```

Archive status:

```bash
npm run test:archive:external-agents
```

Raw historical investigation:

```bash
ZAVORTH_RUN_DETACHED_ARCHIVE_JEST=1 npm run test:archive:external-agents:jest
```

Archived tests may reference removed numbered docs or old alpha package versions. Those are detached historical references, not unresolved current-product bugs.

The plain command exits green by default:

```bash
npm run test:archive:external-agents:jest
```

It only prints the detached archive status. This prevents current CI, agents, or operators from treating old release evidence as a live product failure.

Do not downgrade `package.json`, recreate removed release docs, or alter current runtime behavior only to satisfy archived expectations unless explicitly restoring that historical release snapshot.
