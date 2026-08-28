// Live physical proof of the browser profile vault (no mocks): real profile, real fs, real SQLite.
// Run when explicitly enabled: ZAVORTH_LIVE_PROFILE_PROOF=1 npx jest tests/tool-runtime/tools/browser/LiveProfileProof.test.ts
// Windows PowerShell: $env:ZAVORTH_LIVE_PROFILE_PROOF='1'; npx jest tests/tool-runtime/tools/browser/LiveProfileProof.test.ts
import fs from 'node:fs';
import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { BrowserProfileResolverService } from '../../../../src/tool-runtime/tools/browser/BrowserProfileResolverService.js';
import { DomainScopedBrowserProfileService } from '../../../../src/tool-runtime/tools/browser/DomainScopedBrowserProfileService.js';
import type { BrowserProfileCandidate } from '../../../../src/tool-runtime/tools/browser/BrowserProfileResolverContract.js';

const RUN_LIVE = process.env.ZAVORTH_LIVE_PROFILE_PROOF === '1';

(RUN_LIVE ? describe : describe.skip)('Live browser vault proof (ZAVORTH_LIVE_PROFILE_PROOF=1)', () => {
  const resolver = new BrowserProfileResolverService();
  const vaultService = new DomainScopedBrowserProfileService();
  const createdSnapshotDirs: string[] = [];
  let candidate!: BrowserProfileCandidate;

  beforeAll(() => {
    const result = resolver.resolveProfile();
    const resolved = result.selectedCandidate;
    if (!resolved || !resolved.exists) {
      throw new Error(
        'No existing Chromium browser profile found on this machine. Launch Chrome/Edge/Brave once and retry.',
      );
    }
    candidate = resolved;
    console.log(`LiveProfileProof: resolved live profile: ${candidate.name} (${candidate.profileDir})`);
  });

  afterAll(async () => {
    for (const snapshotDir of createdSnapshotDirs) {
      if (!fs.existsSync(snapshotDir)) {
        continue;
      }
      try {
        await vaultService.disposeSnapshot(snapshotDir);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`LiveProfileProof: failed to shred snapshot dir ${snapshotDir}: ${message}`);
      }
    }
  });

  it('creates a domain-scoped snapshot from the live profile while the browser may be running', async () => {
    const snapshot = await vaultService.createDomainScopedSnapshot(candidate, { allowedDomains: ['github.com'] });
    createdSnapshotDirs.push(snapshot.snapshotDir);

    expect(fs.existsSync(snapshot.snapshotDir)).toBe(true);
    expect(fs.existsSync(snapshot.cookiesDbPath)).toBe(true);

    let sourceCookieCount: number | null = null;
    try {
      const sourceDb: SQLiteDatabase = new DatabaseLib(candidate.cookiesDbPath, { readonly: true });
      try {
        const countRow = sourceDb.prepare('SELECT count(*) AS count FROM cookies').get() as { count: number } | undefined;
        sourceCookieCount = countRow?.count ?? 0;
      } finally {
        sourceDb.close();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`LiveProfileProof: source cookie DB unreadable while browser is running: ${message}`);
    }

    expect(snapshot.purgedCookiesCount).toBeGreaterThanOrEqual(0);
    expect(snapshot.retainedCookiesCount).toBeGreaterThanOrEqual(0);
    if (sourceCookieCount === null) {
      console.log('LiveProfileProof: could not read source cookie DB count; total not verified.');
    } else if (sourceCookieCount === 0) {
      expect(snapshot.purgedCookiesCount).toBe(0);
      expect(snapshot.retainedCookiesCount).toBe(0);
      console.log('LiveProfileProof: source cookie DB has zero cookies; empty snapshot expected.');
    } else {
      expect(snapshot.purgedCookiesCount + snapshot.retainedCookiesCount).toBe(sourceCookieCount);
    }

    if (fs.existsSync(snapshot.cookiesDbPath)) {
      const snapshotDb: SQLiteDatabase = new DatabaseLib(snapshot.cookiesDbPath, { readonly: true });
      let rows: { host_key: string }[];
      try {
        rows = snapshotDb.prepare('SELECT host_key FROM cookies').all() as { host_key: string }[];
      } finally {
        snapshotDb.close();
      }
      expect(rows.filter((row) => row.host_key.includes('google.com'))).toEqual([]);
    }
  });

  it('shreds the ephemeral snapshot on dispose', async () => {
    const snapshot = await vaultService.createDomainScopedSnapshot(candidate, { allowedDomains: ['github.com'] });
    createdSnapshotDirs.push(snapshot.snapshotDir);
    expect(fs.existsSync(snapshot.snapshotDir)).toBe(true);

    const disposed = await vaultService.disposeSnapshot(snapshot.snapshotDir);
    expect(disposed).toBe(true);
    expect(fs.existsSync(snapshot.snapshotDir)).toBe(false);
  });
});
