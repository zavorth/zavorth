/**
 * Residual: formal webhooks.filter column ensure (migration 021 safety net).
 */

import Database from 'better-sqlite3';
import { ensureWebhooksFilterColumnOn } from '../../../src/ai-gateway/lib/db/webhooksFilterColumn.js';

describe('webhooks filter column residual', () => {
  it('adds filter column when missing and is idempotent', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL DEFAULT '["*"]',
        secret TEXT,
        enabled INTEGER DEFAULT 1,
        description TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        last_triggered_at TEXT,
        last_status INTEGER,
        failure_count INTEGER DEFAULT 0
      );
    `);

    const before = db.prepare(`PRAGMA table_info(webhooks)`).all() as Array<{ name: string }>;
    expect(before.some((c) => c.name === 'filter')).toBe(false);

    expect(ensureWebhooksFilterColumnOn(db as any)).toBe(true);
    const after = db.prepare(`PRAGMA table_info(webhooks)`).all() as Array<{ name: string }>;
    expect(after.some((c) => c.name === 'filter')).toBe(true);

    // Second call must not throw
    expect(ensureWebhooksFilterColumnOn(db as any)).toBe(true);

    db.prepare(
      `INSERT INTO webhooks (id, url, events, secret, description, filter)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'w1',
      'https://example.com/hook',
      '["*"]',
      null,
      'test',
      JSON.stringify({ all: [{ field: 'type', op: 'eq', value: 'x' }] }),
    );

    const row = db.prepare(`SELECT filter FROM webhooks WHERE id = ?`).get('w1') as { filter: string };
    expect(row.filter).toContain('type');
    db.close();
  });
});
