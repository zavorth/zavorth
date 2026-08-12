import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthMnemosPromotionGateService } from '../../src/services/ZavorthMnemosPromotionGateService';
import type { ZavorthMnemosPromotionCandidate } from '../../src/contracts/ZavorthMnemosPromotionGateContract';

describe('ZavorthMnemosPromotionGateService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('correctly creates preview and blocks promotion if there are conflicts', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-promotion-conflict-'));
    tempDirs.push(tempDir);

    // Setup a dummy architecture.md that uses SQLite and requires approval
    const wikiDir = path.join(tempDir, '.zavorth', 'wiki');
    fs.mkdirSync(wikiDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(wikiDir, 'architecture.md'),
      `---
title: Architecture
updated_at: 2026-05-01
sources:
  - README.md
---
## Purpose
Purpose text.
## Current Facts
- Zavorth uses sqlite for metadata.
- Decisions require approval before write.
## Decisions
## Open Questions
`,
      'utf8',
    );

    const service = new ZavorthMnemosPromotionGateService({
      now: () => new Date('2026-05-31T12:00:00.000Z'),
      projectRoot: tempDir,
    });

    const candidates: ZavorthMnemosPromotionCandidate[] = [
      {
        id: 'c-1',
        targetPage: 'architecture',
        fact: 'Migrated database to postgresql for production scale.',
        source: 'session-events-1',
        confidence: 0.9,
      },
      {
        id: 'c-2',
        targetPage: 'architecture',
        fact: 'Decisions can be saved with no approval required.',
        source: 'session-events-2',
        confidence: 0.95,
      },
    ];

    const snapshot = service.buildSnapshot({
      candidates,
      apply: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.conflicts).toHaveLength(2);
    expect(snapshot.conflicts[0].contradictionRule).toContain('Postgres vs SQLite');
    expect(snapshot.conflicts[1].contradictionRule).toContain('No approval vs Required');
  });

  it('safely promotes and appends facts to the wiki when approved and conflict-free', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-promotion-apply-'));
    tempDirs.push(tempDir);

    const wikiDir = path.join(tempDir, '.zavorth', 'wiki');
    fs.mkdirSync(wikiDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(wikiDir, 'architecture.md'),
      `---
title: Architecture
updated_at: 2026-05-01
sources:
  - README.md
---
## Purpose
Purpose text.
## Current Facts
- Zavorth is governed.
## Decisions
## Open Questions
`,
      'utf8',
    );

    const service = new ZavorthMnemosPromotionGateService({
      now: () => new Date('2026-05-31T12:00:00.000Z'),
      projectRoot: tempDir,
    });

    const candidates: ZavorthMnemosPromotionCandidate[] = [
      {
        id: 'c-3',
        targetPage: 'architecture',
        fact: 'Implemented White Fox visual theme with sk-supersecretkey123',
        source: 'session-events-3',
        confidence: 0.98,
      },
    ];

    // 1. Dry run/preview first
    const preview = service.buildSnapshot({
      candidates,
      apply: false,
    });
    expect(preview.status).toBe('preview-ready');
    expect(preview.conflicts).toHaveLength(0);
    expect(preview.apply.applied).toBe(false);

    // 2. Apply promotion with approvalId
    const snapshot = service.buildSnapshot({
      candidates,
      apply: true,
      approvalId: 'operator-approval-999',
    });

    expect(snapshot.status).toBe('applied');
    expect(snapshot.apply.applied).toBe(true);
    expect(snapshot.apply.mutatedFiles).toContain('.zavorth/wiki/architecture.md');

    // Verify written file contents
    const pageContent = fs.readFileSync(path.join(wikiDir, 'architecture.md'), 'utf8');
    expect(pageContent).toContain('Implemented White Fox visual theme with [redacted-secret]');
    expect(pageContent).toContain('updated_at: 2026-05-31');
    expect(pageContent).toContain('session-events-3');
    expect(pageContent).not.toContain('sk-supersecretkey123');
  });
});
