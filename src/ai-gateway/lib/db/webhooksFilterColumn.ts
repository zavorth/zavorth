/**
 * Residual: formal ensure for webhooks.filter (migration 021).
 * Pure helper so callers/tests do not need a live product DB.
 */

export type SqliteLike = {
  prepare: (sql: string) => { all: () => unknown[] };
  exec: (sql: string) => unknown;
};

/**
 * Ensure `webhooks.filter` TEXT column exists. Idempotent.
 * Returns true when the column is present after the call.
 */
export function ensureWebhooksFilterColumnOn(db: SqliteLike): boolean {
  try {
    const cols = db.prepare(`PRAGMA table_info(webhooks)`).all() as Array<{ name: string }>;
    if (!Array.isArray(cols) || cols.length === 0) {
      // Table missing — nothing to alter yet
      return false;
    }
    const hasFilter = cols.some((c) => c?.name === 'filter');
    if (!hasFilter) {
      db.exec(`ALTER TABLE webhooks ADD COLUMN filter TEXT`);
    }
    return true;
  } catch {
    return false;
  }
}
