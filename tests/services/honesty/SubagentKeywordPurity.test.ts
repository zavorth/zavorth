/**
 * Agent-first purity: free-text must never keyword-activate subagents.
 * Spawn uses structured explicitSubagents / tools / LLM only.
 * Free-text keyword helpers (e.g. hasExplicitSubagentIntent) were removed;
 * purity is enforced at the runtime/policy boundary.
 */
import { ZavorthSubagentAutoInvocationPolicyService } from '../../../src/services/ZavorthSubagentAutoInvocationPolicyService.js';
import { ZavorthSubagentRuntimeService } from '@zavorth/agents/ZavorthSubagentRuntimeService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('subagent free-text keyword purity', () => {
  it('auto-invocation policy does not treat free-text subagent phrases as explicit request', () => {
    const service = new ZavorthSubagentAutoInvocationPolicyService();
    const decision = service.decide({
      text: 'use subagentes: um agente analisa a arquitetura e outro revisa os riscos',
      channel: 'telegram',
      mode: 'default',
    });
    expect(decision.explicitSubagentRequest).toBe(false);
    // Without structured taskKind, free-text alone should not force live invoke.
    expect(decision.telemetry.selectedBy === 'explicit-user-request').toBe(false);
  });

  it('runtime spawn ignores free-text subagent keywords without explicitSubagents flag', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-subagent-purity-'));
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: path.join(root, 'state.json'),
        boardDbPath: path.join(root, 'board.db'),
      });
      const blocked = await service.execute({
        action: 'subagents.spawn',
        task: 'use subagentes e analise localmente',
        // no explicitSubagents — free-text path must not unlock spawn
        persistState: false,
      });
      // Free text alone must not unlock spawn as if user flipped the structured flag.
      expect(blocked.policy?.reasons?.join(' ') || blocked.status || '').toMatch(
        /explicit|forbidden|blocked|denied|policy|required/i,
      );

      const allowed = await service.execute({
        action: 'subagents.spawn',
        task: 'analise localmente (tool-requested)',
        explicitSubagents: true,
        persistState: false,
      });
      expect(['completed', 'running', 'approval-required', 'queued', 'ready']).toContain(allowed.status);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('documents free-text path: spawn without explicitSubagents is blocked even with agent keywords', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-subagent-purity-doc-'));
    try {
      const service = new ZavorthSubagentRuntimeService({
        now: () => new Date('2026-05-10T14:00:00.000Z'),
        stateFilePath: path.join(root, 'state.json'),
        boardDbPath: path.join(root, 'board.db'),
      });
      for (const task of [
        'use subagentes para revisar o codigo',
        'spawn a multi-agent swarm in parallel',
        'mande um agente e delegue em paralelo',
        '',
      ]) {
        const result = await service.execute({
          action: 'subagents.spawn',
          task,
          persistState: false,
        });
        expect(result.policy?.reasons?.join(' ') || result.status || '').toMatch(
          /explicit|forbidden|blocked|denied|policy|required/i,
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
