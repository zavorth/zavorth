import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthMnemosIngestService } from '../../src/services/ZavorthMnemosIngestService';

function makeTempWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-ingest-'));
  fs.mkdirSync(path.join(root, '.zavorth', 'wiki'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  for (const page of ['architecture', 'memory', 'providers', 'operations', 'skills', 'dependencies']) {
    fs.writeFileSync(path.join(root, '.zavorth', 'wiki', `${page}.md`), [
      '---',
      `title: ${page}`,
      'status: active',
      'owner: zavorth',
      'updated_at: 2026-05-18',
      'confidence: medium',
      'tags:',
      `  - ${page}`,
      'sources: []',
      '---',
      '',
      '## Purpose',
      '',
      'Seed page.',
      '',
      '## Current Facts',
      '',
      '## Decisions',
      '',
      '## Open Questions',
      '',
      '## Source Links',
      '',
      '## Maintenance Notes',
      '',
    ].join('\n'), 'utf8');
  }
  return root;
}

describe('ZavorthMnemosIngestService', () => {
  it('builds a preview-only ingest snapshot with impacted wiki patches', () => {
    const root = makeTempWorkspace();
    fs.writeFileSync(
      path.join(root, 'docs', 'note.md'),
      '# Provider Memory Plan\n\nThe provider routing and Mnemos memory compaction must update readiness docs.',
      'utf8',
    );
    const service = new ZavorthMnemosIngestService({
      projectRoot: root,
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      sourcePaths: ['docs/note.md'],
    });

    expect(snapshot).toEqual(expect.objectContaining({
      version: 'zavorth-mnemos-ingest-v1',
      generatedAt: '2026-05-18T12:00:00.000Z',
      status: 'preview-ready',
      mode: 'preview',
      apply: expect.objectContaining({
        requested: false,
        applied: false,
        approvalRequired: false,
        approvalSatisfied: false,
      }),
      safety: expect.objectContaining({
        workspaceConfined: true,
        providerCall: false,
        networkCall: false,
        secretsRedacted: true,
        patchPreviewOnlyByDefault: true,
      }),
    }));
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.patches.some((patch) => patch.pageId === 'providers')).toBe(true);
    expect(snapshot.patches.some((patch) => patch.pageId === 'memory')).toBe(true);
  });

  it('blocks apply without approval id', () => {
    const root = makeTempWorkspace();
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), '# Memory\n\nMnemos memory wiki.', 'utf8');
    const service = new ZavorthMnemosIngestService({ projectRoot: root });

    const snapshot = service.buildSnapshot({
      sourcePaths: ['docs/note.md'],
      apply: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.apply.applied).toBe(false);
    expect(snapshot.apply.blockers).toContain('approval-id-required');
    expect(snapshot.receipt.durableMutation).toBe(false);
  });

  it('applies source notes only with approval id and keeps mutations inside wiki pages', () => {
    const root = makeTempWorkspace();
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), '# Memory\n\nMnemos memory wiki.', 'utf8');
    const service = new ZavorthMnemosIngestService({
      projectRoot: root,
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      sourcePaths: ['docs/note.md'],
      apply: true,
      approvalId: 'approval-123',
    });

    expect(snapshot.status).toBe('applied');
    expect(snapshot.apply.applied).toBe(true);
    expect(snapshot.apply.mutatedFiles.every((file) => file.startsWith('.zavorth/wiki/'))).toBe(true);
    expect(fs.readFileSync(path.join(root, '.zavorth', 'wiki', 'memory.md'), 'utf8')).toContain('## Ingest Notes');
    expect(snapshot.receipt).toEqual(expect.objectContaining({
      durableMutation: true,
      approvalId: 'approval-123',
      providerCall: false,
    }));
  });

  it('redacts secret-like source content from previews', () => {
    const root = makeTempWorkspace();
    fs.writeFileSync(path.join(root, 'docs', 'secret.md'), '# Memory\n\ntoken=very-secret-value should vanish.', 'utf8');
    const service = new ZavorthMnemosIngestService({ projectRoot: root });

    const snapshot = service.buildSnapshot({
      sourcePaths: ['docs/secret.md'],
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).toContain('[REDACTED_SECRET]');
    expect(serialized).not.toContain('very-secret-value');
  });

  it('rejects source paths that escape the workspace', () => {
    const root = makeTempWorkspace();
    const service = new ZavorthMnemosIngestService({ projectRoot: root });

    expect(() => service.buildSnapshot({ sourcePaths: ['../outside.md'] })).toThrow('escapes workspace');
  });
});
