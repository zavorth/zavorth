import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FastBm25SearchEngine } from '../../src/services/search/FastBm25SearchEngine.js';

describe('FastBm25SearchEngine (Sub-5ms BM25 Ranking)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bm25-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'auth_adapter.md'),
      '# Authentication Adapter\nThis file describes the OAuth2 and JWT token verification system for Zavorth.',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'circuit_breaker.ts'),
      'export class HotPathCircuitBreaker { canAttempt() { return true; } }',
      'utf-8'
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should rank relevant documents at the top with positive BM25 score', () => {
    const results = FastBm25SearchEngine.search('circuit breaker', tmpDir);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toContain('circuit_breaker.ts');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should find keywords across markdown documents', () => {
    const results = FastBm25SearchEngine.search('oauth2 jwt token', tmpDir);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toContain('auth_adapter.md');
  });

  it('should return empty results for empty or blank query', () => {
    const results = FastBm25SearchEngine.search('   ', tmpDir);
    expect(results).toEqual([]);
  });
});
