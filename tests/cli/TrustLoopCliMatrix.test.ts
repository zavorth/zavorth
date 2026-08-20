/**
 * Q7 — Trust Loop CLI matrix (module entrypoints under NO_COLOR).
 */

process.env.NO_COLOR = '1';

import { runProofLedgerCli } from '../../src/cli/ProofLedgerCli.js';
import { runApprovalPresentationCli } from '../../src/cli/ApprovalPresentationCli.js';
import { runRiskBudgetCli } from '../../src/cli/RiskBudgetCli.js';
import { runChangePreviewCli } from '../../src/cli/ChangePreviewCli.js';
import { runCapabilitySubsystemCli as runCapabilityFabricCli } from '../../src/cli/CapabilitySubsystemCli.js';
import { runMemoryPrivacyCli } from '../../src/cli/MemoryPrivacyCli.js';

async function capture(run: () => Promise<number> | number): Promise<{ code: number; out: string }> {
  const chunks: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: unknown[]) => {
    chunks.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    chunks.push(args.map(String).join(' '));
  };
  try {
    const code = await run();
    return { code: typeof code === 'number' ? code : 0, out: chunks.join('\n') };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

describe('Trust Loop CLI matrix (Q7)', () => {
  it('proof help is readable under NO_COLOR', async () => {
    const { code, out } = await capture(() => runProofLedgerCli(['--help']));
    expect(code).toBe(0);
    expect(out).toMatch(/proof|ledger|Usage|list|export/i);
    expect(out).not.toMatch(/\u001B\[38;2;255;122;24m/); // no orange brand
  });

  it('proof list runs', async () => {
    const { code, out } = await capture(() => runProofLedgerCli(['list']));
    expect([0, 1]).toContain(code);
    expect(out.length).toBeGreaterThan(0);
  });

  it('approval help runs', async () => {
    const { code, out } = await capture(() => runApprovalPresentationCli(['--help']));
    expect(code).toBe(0);
    expect(out).toMatch(/approval|Usage|decide|list/i);
  });

  it('risk-budget status runs', async () => {
    const { code, out } = await capture(() => runRiskBudgetCli(['status']));
    expect([0, 1]).toContain(code);
    expect(out).toMatch(/risk|budget|observer|operator|autopilot|mode|ZAVORTH/i);
  });

  it('change-preview help runs', async () => {
    const { code, out } = await capture(() => runChangePreviewCli(['--help']));
    expect(code).toBe(0);
    expect(out).toMatch(/preview|change|Usage|what-changes/i);
  });

  it('absorb help runs', async () => {
    const { code, out } = await capture(() => runCapabilityFabricCli(['--help']));
    expect(code).toBe(0);
    expect(out).toMatch(/absorb|consent|quarantine|Usage/i);
  });

  it('import-workspace help runs', async () => {
    const { code, out } = await capture(() => runCapabilityFabricCli(['import-workspace', '--help']));
    expect(code).toBe(0);
    expect(out).toMatch(/import-workspace|profile|Usage/i);
  });

  it('memory-privacy help runs', async () => {
    const { code, out } = await capture(() => runMemoryPrivacyCli(['--help']));
    expect(code).toBe(0);
    expect(out).toMatch(/memory|privacy|forget|Usage/i);
  });
});
