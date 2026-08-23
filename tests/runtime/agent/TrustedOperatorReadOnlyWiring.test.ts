import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/ZavorthAgentGateway.js';
import { TrustedOperatorModeService } from '../../../src/services/power/TrustedOperatorModeService.js';
import type { TrustedOperatorDecision } from '../../../src/services/power/TrustedOperatorModeService.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function buildStubOperator(): {
  isEnabled: () => boolean;
  decide: (input: Parameters<TrustedOperatorModeService['decide']>[0]) => TrustedOperatorDecision;
  calls: Array<Parameters<TrustedOperatorModeService['decide']>[0]>;
} {
  const calls: Array<Parameters<TrustedOperatorModeService['decide']>[0]> = [];
  return {
    calls,
    isEnabled: () => true,
    decide: (input) => {
      calls.push(input);
      return {
        autoApprove: false,
        reason: 'Stub operator keeps every lane explicit.',
        lane: input.risk === 'high' ? 'red' : 'yellow',
        receiptsRequired: true,
      };
    },
  };
}

describe('Trusted Operator read-only wiring', () => {
  it('auto-approves green-lane read-only actions while enabled with the default flag', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'zavorth-to-ro-'));
    try {
      const operator = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'trusted-operator-mode.json'),
      });
      operator.enable('test');
      const decision = operator.decide({ description: 'summarize repository status', risk: 'low', mutation: false });
      expect(decision.autoApprove).toBe(true);
      expect(decision.lane).toBe('green');
      expect(decision.receiptsRequired).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('honors agent.autoApproveReadOnly=false by keeping reads on the explicit approval path', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'zavorth-to-noro-'));
    try {
      const operator = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'trusted-operator-mode.json'),
        autoApproveReadOnly: false,
      });
      operator.enable('test');
      const decision = operator.decide({ description: 'summarize repository status', risk: 'low', mutation: false });
      expect(decision.autoApprove).toBe(false);
      expect(decision.reason).toContain('autoApproveReadOnly');
      expect(decision.receiptsRequired).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('never auto-approves red-lane or disabled postures regardless of the flag', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'zavorth-to-red-'));
    try {
      const enabled = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'a.json'),
        autoApproveReadOnly: true,
      });
      enabled.enable('test');
      expect(enabled.decide({ risk: 'high', mutation: true }).autoApprove).toBe(false);
      expect(enabled.decide({ risk: 'critical' }).autoApprove).toBe(false);
      expect(enabled.decide({ risk: 'medium', mutation: false }).autoApprove).toBe(false);

      const disabled = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'b.json'),
        autoApproveReadOnly: true,
      });
      expect(disabled.decide({ risk: 'low', mutation: false }).autoApprove).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('completes read-only flows with zero approval prompts under trusted operator', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-12T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({ status: 'completed', summary: 'Read-only work done.', replyText: 'Workspace files listed.' }),
      trustedOperator: buildStubOperator([]),
    });
    const result = await gateway.handle({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:ro',
      text: 'show me the workspace files',
      requestedTools: ['read_file'],
    });
    expect(result.run.status).toBe('completed');
    expect(result.run.approvals).toHaveLength(0);
  });

  it('consults the operator for pending approvals and never relaxes red/danger lanes', async () => {
    const operator = buildStubOperator();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-12T12:05:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({ status: 'completed', summary: 'Should not run before approval.', replyText: '' }),
      trustedOperator: operator,
    });
    const result = await gateway.handle({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:red',
      text: 'run npm test',
      requestedTools: ['shell.exec'],
    });
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.approvals.filter((approval) => approval.status === 'pending')).toHaveLength(1);
    expect(result.run.approvals[0].risk).toBe('danger');
    expect(operator.calls.length).toBeGreaterThan(0);
    expect(operator.calls.every((call) => call.mutation === false)).toBe(true);
  });

  it('keeps DiskMutationGate phrase and path re-validation invariants intact', () => {
    const gate = readFileSync(
      path.resolve(__dirname, '../../../src/services/DiskMutationGateService.ts'),
      'utf8',
    );
    expect(gate).toMatch(/approvalPhrase/);
    expect(gate).toMatch(/assertApplyPathStillInsideWorkspace/);
    expect(gate).toMatch(/required:\s*true/);
  });
});
