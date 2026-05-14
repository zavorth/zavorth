import fs from 'fs';
import os from 'os';
import path from 'path';
import { TrustPlanePolicyLedgerService } from '../../src/services/TrustPlanePolicyLedgerService.js';

describe('TrustPlanePolicyLedgerService', () => {
  it('appends, lists and summarizes trust policy mutations', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-ledger-'));
    const ledgerFile = path.join(tempDir, 'trust-plane-ledger.jsonl');
    const service = new TrustPlanePolicyLedgerService({
      ledgerFile,
      now: () => new Date('2026-04-12T12:00:00.000Z'),
    });

    const preview = service.append({
      domain: 'mcp',
      actionId: 'set-mcp-profile',
      requestedBy: 'operator',
      sourceSurface: 'cli',
      status: 'previewed',
      riskLevel: 'high',
      approvalScope: 'once',
      planId: 'plan-1',
      permissionId: 'perm-1',
      summary: 'Promover MCP.',
      diff: [{ path: 'mcp.profile', before: 'safe', after: 'trusted', summary: 'Perfil MCP.', riskLevel: 'high', reversible: true }],
      rollback: {
        available: true,
        reason: 'Policy anterior salva.',
        payload: {
          domain: 'mcp',
          beforePolicy: { version: 1, profile: 'safe', allowlist: [] },
          afterPolicy: { version: 1, profile: 'trusted', allowlist: [] },
        },
      },
      result: null,
    });
    service.append({
      domain: 'skills',
      actionId: 'set-skill-default',
      requestedBy: 'operator',
      sourceSurface: 'chat',
      status: 'applied',
      riskLevel: 'medium',
      approvalScope: 'once',
      planId: null,
      permissionId: null,
      summary: 'Endurecer skills.',
      diff: [{ path: 'skills.defaultPolicy', before: 'allow', after: 'deny', summary: 'Default de skills.', riskLevel: 'medium', reversible: true }],
      rollback: { available: true, reason: 'Policy anterior salva.', payload: null },
      result: 'applied',
    });

    const entries = service.list({ limit: 10 });
    const summary = service.summarize();

    expect(preview.id).toContain('trust-ledger-');
    expect(entries).toHaveLength(2);
    expect(summary.total).toBe(2);
    expect(summary.byStatus.previewed).toBe(1);
    expect(summary.byStatus.applied).toBe(1);
    expect(summary.byDomain.mcp).toBe(1);
    expect(summary.rollbackableEntries).toBe(2);
    expect(summary.lastMutationAt).toBe('2026-04-12T12:00:00.000Z');
  });

  it('ignores corrupt JSONL rows instead of blocking the runtime', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-ledger-'));
    const ledgerFile = path.join(tempDir, 'trust-plane-ledger.jsonl');
    fs.writeFileSync(ledgerFile, [
      '{broken',
      JSON.stringify({
        id: 'ledger-valid',
        at: '2026-04-12T12:01:00.000Z',
        domain: 'mcp',
        actionId: 'remove-mcp-tool',
        requestedBy: null,
        sourceSurface: 'cli',
        status: 'applied',
        riskLevel: 'medium',
        approvalScope: 'once',
        planId: null,
        permissionId: null,
        summary: 'Removeu tool.',
        diff: [],
        rollback: { available: false, reason: 'Sem rollback.' },
        result: 'ok',
      }),
    ].join('\n'), 'utf8');
    const service = new TrustPlanePolicyLedgerService({ ledgerFile });

    expect(service.list()).toEqual([
      expect.objectContaining({ id: 'ledger-valid', status: 'applied' }),
    ]);
  });
});
