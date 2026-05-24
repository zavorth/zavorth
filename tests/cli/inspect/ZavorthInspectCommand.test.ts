import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthInspectService } from '../../../src/services/ZavorthInspectService.js';

describe('Zavorth inspect command', () => {
  it('builds a redacted inspection snapshot without reading raw secrets', () => {
    const root = makeProjectRoot();
    process.env.OPENAI_API_KEY = 'test-secret-value';
    const service = new ZavorthInspectService(root, {
      projectRoot: root,
      llmProvider: 'openai',
      modelSelectionModelId: 'gpt-test',
      modelSelectionRouteId: '',
      modelSelectionFamilyId: '',
      openaiModel: 'gpt-test',
    } as any);

    const snapshot = service.buildSnapshot();

    expect(snapshot.provider.id).toBe('openai');
    expect(snapshot.provider.model).toBe('gpt-test');
    expect(snapshot.provider.configured).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('test-secret-value');
    delete process.env.OPENAI_API_KEY;
  });

  it('projects runtime receipts and approvals when an overlay is provided', () => {
    const root = makeProjectRoot();
    const service = new ZavorthInspectService(root, {
      projectRoot: root,
      llmProvider: 'ollama',
      modelSelectionModelId: '',
      modelSelectionRouteId: '',
      modelSelectionFamilyId: '',
      geminiModel: 'gemini-fixture',
    } as any);

    const snapshot = service.buildSnapshot({
      runtime: {
        pendingApprovals: [{ id: 'approval-1', status: 'pending' }],
        receiptIds: ['receipt-1'],
      },
    });

    expect(snapshot.pendingApprovals.count).toBe(1);
    expect(snapshot.pendingApprovals.ids).toEqual(['approval-1']);
    expect(snapshot.receipts.recentIds).toEqual(['receipt-1']);
  });
});

function makeProjectRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'zavorth-inspect-'));
  mkdirSync(path.join(root, '.git'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'fixture',
    version: '1.2.3',
    scripts: { test: 'jest' },
    dependencies: {
      grammy: '1.0.0',
      '@modelcontextprotocol/sdk': '1.0.0',
    },
  }, null, 2));
  writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
  return root;
}
