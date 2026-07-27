/**
 * S4 — risk budget / trusted operator / disk gate must not skip red-lane.
 * Characterization tests on source contracts + unit services.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RiskBudgetService } from '../../../src/services/risk/RiskBudgetService.js';
import { TrustedOperatorModeService } from '../../../src/services/power/TrustedOperatorModeService.js';

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), 'src', ...parts), 'utf8');
}

describe('Approval bypass guardrails (S4)', () => {
  it('TrustedOperator never auto-approves high/critical/red patterns', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'zavorth-to-'));
    try {
      const to = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'trusted-operator-mode.json'),
      });
      to.enable('test');
      const red = to.decide({ description: 'rm -rf /', risk: 'high', mutation: true });
      expect(red.autoApprove).toBe(false);
      expect(red.lane).toBe('red');
      expect(red.receiptsRequired).toBe(true);

      const critical = to.decide({ description: 'noop', risk: 'critical' });
      expect(critical.autoApprove).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }

    const src = readSrc('services', 'power', 'TrustedOperatorModeService.ts');
    expect(src).toMatch(/Red-lane \/ high-risk action never auto-approves/);
    expect(src).toMatch(/risk === 'critical' \|\| risk === 'high'/);
  });

  it('RiskBudget observer blocks mutation spends and does not unfreeze via trusted operator', () => {
    const service = new RiskBudgetService({
      trustedOperator: { isEnabled: () => true },
    });
    service.setMode('observer');
    const blocked = service.spend({
      dimension: 'diskMutations',
      amount: 1,
      riskLevel: 'low',
    });
    expect(blocked.allowed).toBe(false);
    const src = readSrc('services', 'risk', 'RiskBudgetService.ts');
    expect(src).toMatch(/never bypasses freeze/i);
  });

  it('DiskMutationGate apply always requires phrase and re-validates paths', () => {
    const gate = readSrc('services', 'DiskMutationGateService.ts');
    expect(gate).toMatch(/approvalPhrase/);
    expect(gate).toMatch(/invalid-approval-phrase|Invalid approval phrasea/);
    expect(gate).toMatch(/assertApplyPathStillInsideWorkspace/);
    expect(gate).toMatch(/required:\s*true/);
  });
});
