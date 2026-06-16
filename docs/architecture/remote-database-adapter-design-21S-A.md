# Remote Database Adapter Design - Phase 21S-A

> [!IMPORTANT]
> This is a design-only document for Phase 21S-A. No runtime implementation is performed in this phase.

## Future Database Schema Abstraction

To support both local-first desktop environments and serverless container deployments, Zavorth will refactor its storage layer to use a `DatabaseAdapter` interface.

```typescript
export interface DatabaseAdapter {
  execute(query: string, params?: unknown[]): Promise<DatabaseQueryResult>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface DatabaseQueryResult {
  rows: Record<string, unknown>[];
  lastInsertRowid?: number | string;
  rowsAffected: number;
}
```

---

## Adapter Implementations

1.  **LocalSqliteAdapter**: 
    - Standard implementation using `better-sqlite3`.
    - Writes to the local `data/state.db` file.
    - Default behavior for local desktop, CLI, and offline daemon runs.
2.  **LibSqlRemoteAdapter**:
    - Remote implementation utilizing `@libsql/client` (Libsql / Turso).
    - Connects via HTTP/HTTPS protocols to a managed cloud database.
    - Used for ephemeral serverless runtimes where disk storage is volatile.

---

## Environment Configuration (Explicit Opt-In)
- Local mode is the **strict default**.
- Remote mode requires an explicit opt-in via environment variables:
  - `ZAVORTH_DATABASE_URL`: The remote HTTP connection endpoint.
  - `ZAVORTH_DATABASE_AUTH_TOKEN`: The bearer authentication key.
- If these keys are absent, the runtime automatically falls back to `LocalSqliteAdapter`.

---

## Operational & Latency Design Concerns
- **Latency**: HTTP requests to a remote database introduce latency (~30-100ms per roundtrip). The agent loop must avoid chatty, sequential queries. All multi-statement transactions should be combined or batched.
- **Transaction Behavior**: Turso supports standard transactions via HTTP envelopes. If a remote HTTP request fails midway through a transaction, the client must trigger an explicit rollback to prevent schema fragmentation.
- **Migration Compatibility**: The schema definitions must remain identical between `better-sqlite3` and `libsql` to ensure migrations run seamlessly on both backends.
- **Token Redaction**: The database connection string and authentication tokens must be redacted by `SecurityAuditLogger` to prevent leakage.
- **Test Strategy**: Integration tests will use an in-memory SQLite database (`:memory:`) to verify queries, and a mocked HTTP client to verify the remote adapter's envelope structure.
