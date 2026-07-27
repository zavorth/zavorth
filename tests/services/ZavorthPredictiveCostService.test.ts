import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthPredictiveCostService } from '../../src/services/ZavorthPredictiveCostService.js';

describe('ZavorthPredictiveCostService', () => {
  let tempDir = '';
  let tempDbPath = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-predictive-test-'));
    tempDbPath = path.join(tempDir, 'zavorth_test.db');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns default predictions when database does not exist', () => {
    const service = new ZavorthPredictiveCostService({ dbPath: tempDbPath });
    const result = service.predictCost('code_generation');

    expect(result.historyCount).toBe(0);
    expect(result.avgInputTokens).toBe(3000);
    expect(result.avgOutputTokens).toBe(1000);
    expect(result.avgCostUsd).toBe(0.05);
    expect(result.recommendedModelId).toBe('claude-4');
  });

  it('calculates average tokens and costs from SQLite records', () => {
    let sqlite3: any;
    try {
      sqlite3 = require('better-sqlite3');
    } catch {
      // If better-sqlite3 cannot be imported under test environment, skip DB check
      return;
    }

    const db = new sqlite3(tempDbPath);
    db.prepare(`
      CREATE TABLE IF NOT EXISTS token_usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        scope TEXT,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_type TEXT
      )
    `).run();

    const insert = db.prepare(`
      INSERT INTO token_usage_records (timestamp, scope, model, input_tokens, output_tokens, cost_usd, task_type)
      VALUES (-, -, -, -, -, -, -)
    `);

    // Insert 2 records for 'chat'
    insert.run(Date.now(), 'task', 'gpt-4o-mini', 400, 100, 0.0005, 'chat');
    insert.run(Date.now(), 'task', 'gpt-4o-mini', 600, 300, 0.0015, 'chat');

    db.close();

    const service = new ZavorthPredictiveCostService({ dbPath: tempDbPath });
    const result = service.predictCost('chat');

    expect(result.historyCount).toBe(2);
    expect(result.avgInputTokens).toBe(500); // AVG(400, 600)
    expect(result.avgOutputTokens).toBe(200); // AVG(100, 300)
    expect(result.avgCostUsd).toBe(0.001); // AVG(0.0005, 0.0015)
    expect(result.recommendedModelId).toBe('gpt-4o-mini'); // Cost < 0.005 -> cheap tier
  });
});
