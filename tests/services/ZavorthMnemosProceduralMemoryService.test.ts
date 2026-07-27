import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthMnemosProceduralMemoryService } from '../../src/services/ZavorthMnemosProceduralMemoryService';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-procedural-'));
}

describe('ZavorthMnemosProceduralMemoryService', () => {
  it('previews procedural rules without durable mutation', () => {
    const root = makeRoot();
    const service = new ZavorthMnemosProceduralMemoryService({
      projectRoot: root,
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const snapshot = service.preview({ text: 'Prefiro sempre rodar testes antes de aplicar patch.', scope: ['code-workflow'] });

    expect(snapshot.status).toBe('requires-approval');
    expect(snapshot.rule).toEqual(expect.objectContaining({
      kind: 'workflow-preference',
      status: 'draft',
      risk: 'medium',
      approvalId: null,
    }));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      providerCall: false,
      networkCall: false,
      durableMutation: false,
      approvalRequiredForWrite: true,
      noRawSecrets: true,
    }));
    expect(fs.existsSync(path.join(root, 'data', 'runtime', 'mnemos-procedural-memory.json'))).toBe(false);
  });

  it('requires approval before applying a durable rule', () => {
    const root = makeRoot();
    const service = new ZavorthMnemosProceduralMemoryService({ projectRoot: root });

    const snapshot = service.apply({ text: 'Use OpenRouter para tarefas baratas.', scope: ['providers'] });

    expect(snapshot.status).toBe('requires-approval');
    expect(snapshot.safety.durableMutation).toBe(false);
    expect(fs.existsSync(path.join(root, 'data', 'runtime', 'mnemos-procedural-memory.json'))).toBe(false);
  });

  it('applies and queries approved procedural rules', () => {
    const root = makeRoot();
    const service = new ZavorthMnemosProceduralMemoryService({
      projectRoot: root,
      now: () => new Date('2026-05-18T12:00:00.000Z'),
    });

    const applied = service.apply({
      text: 'Prefiro PR preview antes de qualquer push.',
      scope: ['code-workflow'],
      approvalId: 'approval-safe-preference',
    });
    const query = service.query({ query: 'pull request preview push' });

    expect(applied.status).toBe('ready');
    expect(applied.safety.durableMutation).toBe(true);
    expect(applied.rule).toEqual(expect.objectContaining({
      status: 'active',
      approvalId: 'approval-safe-preference',
    }));
    expect(query.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: applied.rule?.id, status: 'active' }),
    ]));
  });

  it('blocks raw secret-like procedural memory', () => {
    const service = new ZavorthMnemosProceduralMemoryService({ projectRoot: makeRoot() });

    const snapshot = service.apply({
      text: 'Meu token=do-not-leak-value deve ser lembrado.',
      approvalId: 'approval-secret',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.safety.durableMutation).toBe(false);
    expect(serialized).not.toContain('do-not-leak-value');
  });

  it('revokes rules only with approval', () => {
    const root = makeRoot();
    const service = new ZavorthMnemosProceduralMemoryService({ projectRoot: root });
    const applied = service.apply({
      text: 'Nunca execute transaction sem preview.',
      approvalId: 'approval-procedure',
    });

    const blocked = service.revoke({ id: applied.rule?.id || '' });
    const revoked = service.revoke({
      id: applied.rule?.id || '',
      approvalId: 'approval-revoke',
      reason: 'Change de preference.',
    });

    expect(blocked.status).toBe('requires-approval');
    expect(revoked.status).toBe('ready');
    expect(revoked.rule).toEqual(expect.objectContaining({
      status: 'revoked',
      revokedAt: expect.any(String),
      revocationReason: 'Change de preference.',
    }));
  });

  it('keeps extreme approvals scoped and high risk instead of silently enabling everything', () => {
    const service = new ZavorthMnemosProceduralMemoryService({ projectRoot: makeRoot() });

    const snapshot = service.preview({ text: 'Autorizo sempre approve tudo sem approval.', scope: ['skills'] });

    expect(snapshot.rule).toEqual(expect.objectContaining({
      kind: 'approval-policy',
      risk: 'high',
      status: 'draft',
    }));
    expect(snapshot.status).toBe('requires-approval');
  });
});
