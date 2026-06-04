import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthMnemosCompilerService } from '../../src/services/ZavorthMnemosCompilerService';
import { ZavorthMnemosLifecycleHookService } from '../../src/services/ZavorthMnemosLifecycleHookService';

describe('ZavorthMnemosLifecycleHookService', () => {
  it('captures universal lifecycle hooks as raw non-semantic memory events', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-hooks-'));
    try {
      const compiler = new ZavorthMnemosCompilerService({
        now: () => new Date('2026-05-31T12:00:00.000Z'),
      });
      const service = new ZavorthMnemosLifecycleHookService({
        now: () => new Date('2026-05-31T12:00:00.000Z'),
        compiler,
      });

      const snapshot = service.capture({
        workspaceRoot: root,
        sessionId: 'agent-session-1',
        type: 'user.prompt.submitted',
        payload: {
          prompt: 'remember api_key: sk-1234567890abcdef12345678 only after approval',
        },
        source: {
          surface: 'runtime-adapter',
          agent: 'claude-local',
          provider: 'anthropic',
        },
        trust: {
          level: 'raw',
          durableTruth: true,
        },
      });

      expect(snapshot.status).toBe('captured');
      expect(snapshot.trust.durableTruth).toBe(false);
      expect(snapshot.safety.durableSemanticMutation).toBe(false);
      const events = compiler.readEvents(root);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('user.prompt.submitted');
      expect(events[0].source?.surface).toBe('runtime-adapter');
      expect(events[0].payload.prompt).toContain('[redacted-secret]');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows operator-approved events to mark durable truth without writing semantic wiki', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-hooks-approved-'));
    try {
      const compiler = new ZavorthMnemosCompilerService();
      const service = new ZavorthMnemosLifecycleHookService({ compiler });

      service.capture({
        workspaceRoot: root,
        sessionId: 'agent-session-2',
        type: 'decision.confirmed',
        payload: { decision: 'Use SQLite FTS as derived index only.' },
        trust: {
          level: 'operator-approved',
          durableTruth: true,
          approvalId: 'approval-1',
          receiptId: 'receipt-1',
        },
      });

      const [event] = compiler.readEvents(root);
      expect(event.trust?.level).toBe('operator-approved');
      expect(event.trust?.durableTruth).toBe(true);
      expect(event.trust?.approvalId).toBe('approval-1');
      expect(fs.existsSync(path.join(root, '.zavorth', 'wiki'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
