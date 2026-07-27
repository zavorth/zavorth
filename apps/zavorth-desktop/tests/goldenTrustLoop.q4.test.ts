/**
 * Q4 — Desktop golden UX loop (automated):
 * Chat home trust model → next approval → approve → receipt strip → memory forget receipt.
 *
 * Hermetic: pure models + in-memory storage + monorepo MemoryPrivacyService (via relative import).
 * This is the CI stand-in for the manual Desktop chat → approval → proof → forget path.
 */

import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  appendReceipt,
  loadReceipts,
  type DesktopReceipt,
} from '../src/desktop-state/receiptsLedger';
import {
  buildHomeTrustSummary,
  selectNextApproval,
} from '../src/desktop-state/homeTrustModel';
import { selectProofStripItems } from '../src/desktop-state/proofStripModel';
import { resolveNextAction } from '../src/components/NextActionBanner';
import { MemoryPrivacyService } from '../../../src/services/memory/MemoryPrivacyService';
import {
  ProofLedgerService,
  InMemoryProofLedgerAdapter,
} from '../../../src/services/proof/ProofLedgerService';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('Q4 Desktop golden trust loop', () => {
  it('walks chat home → pending approval → approve → proof strip → memory forget receipt', () => {
    const store = memoryStorage();
    let receipts: DesktopReceipt[] = [];
    let nav: string[] = [];

    // 1) Chat turn completes → chat receipt on home
    receipts = appendReceipt(receipts, {
      kind: 'chat',
      title: 'User asked to patch tests',
      summary: 'Chat turn completed; plan requires disk write approval.',
      status: 'ok',
      sessionId: 'sess-q4',
      source: 'desktop-chat',
    }, store);

    // 2) Pending approval appears (disk write)
    const approvals = [
      {
        id: 'appr-disk-1',
        status: 'pending',
        title: 'Write tests/fix.test.ts',
        summary: 'Agent proposes a test file write.',
        action: 'disk.write',
      },
      {
        id: 'appr-old',
        status: 'approved',
        title: 'Already done',
      },
    ];

    let trust = buildHomeTrustSummary({ approvals, receipts, proofLimit: 3 });
    expect(trust.pendingApprovalCount).toBe(1);
    expect(trust.nextApproval?.id).toBe('appr-disk-1');
    expect(trust.hasProof).toBe(true);

    // 3) Next-action banner targets Review only (honest CTA)
    const next = resolveNextAction({
      approvalsCount: trust.pendingApprovalCount,
      onOpenReview: () => {
        nav.push('review');
      },
      onOpenProof: () => {
        nav.push('proof');
      },
      language: 'en',
    });
    expect(next).not.toBeNull();
    expect(next!.tone).toBe('warn');
    expect(next!.cta.toLowerCase()).toMatch(/review|approve|revis/i);
    next!.onClick();
    expect(nav).toContain('review');

    // 4) User approves → approval receipt + strip updates; pending clears
    const decided = approvals.map((a) =>
      a.id === 'appr-disk-1' ? { ...a, status: 'approved' } : a,
    );
    receipts = appendReceipt(receipts, {
      kind: 'approval',
      title: 'Approved: Write tests/fix.test.ts',
      summary: 'Owner approved disk write; apply may proceed.',
      status: 'ok',
      sessionId: 'sess-q4',
      source: 'desktop-approval',
      metadata: { approvalId: 'appr-disk-1' },
    }, store);

    trust = buildHomeTrustSummary({ approvals: decided, receipts, proofLimit: 3 });
    expect(trust.pendingApprovalCount).toBe(0);
    expect(selectNextApproval(decided)).toBeNull();
    expect(resolveNextAction({
      approvalsCount: trust.pendingApprovalCount,
      onOpenReview: () => undefined,
    })).toBeNull();

    const strip = selectProofStripItems(receipts, 3);
    expect(strip.length).toBeGreaterThanOrEqual(2);
    expect(strip.some((i) => i.kind === 'approval' && i.tone === 'ok')).toBe(true);
    expect(strip.every((i) => i.title.trim().length > 0)).toBe(true);

    // 5) Memory forget → proof ledger + desktop memory receipt
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zvd-q4-mem-'));
    try {
      const demoPath = path.join(tmp, 'memory-privacy-demo.json');
      const memory = new MemoryPrivacyService({
        demoStorePath: demoPath,
        now: () => new Date('2026-07-11T15:00:00.000Z'),
        idFactory: (p) => `${p}-q4`,
      });
      memory.seedDemo();
      const forgotten = memory.forgetInDemo('mem-demo-pref-tabs', 'desktop-q4');
      expect(forgotten).not.toBeNull();
      expect(forgotten!.item.id).toBe('mem-demo-pref-tabs');
      expect(forgotten!.item.canForget).toBe(true);
      // After forget, explain/list hide the item (demo store flag set).
      expect(memory.explainFromDemo('mem-demo-pref-tabs')).toBeNull();
      expect(
        memory.buildSnapshotFromDemo().items.some((i) => i.id === 'mem-demo-pref-tabs'),
      ).toBe(false);

      const ledger = new ProofLedgerService({
        adapter: new InMemoryProofLedgerAdapter(),
        now: () => new Date('2026-07-11T15:00:01.000Z'),
        idFactory: (p) => `${p}-q4`,
      });
      const proofEvent = ledger.append(forgotten!.proof);
      expect(proofEvent.kind).toBe('memory');
      expect(proofEvent.title.toLowerCase()).toMatch(/forget|memory/);
      expect(JSON.stringify(proofEvent)).not.toMatch(/sk-[a-z0-9]{8,}/i);

      receipts = appendReceipt(receipts, {
        kind: 'memory',
        title: proofEvent.title,
        summary: proofEvent.summary,
        status: 'ok',
        sessionId: 'sess-q4',
        source: 'memory-privacy',
        metadata: { proofEventId: proofEvent.id, memoryId: forgotten!.item.id },
      }, store);

      const finalTrust = buildHomeTrustSummary({ approvals: decided, receipts, proofLimit: 5 });
      expect(finalTrust.latestProof.some((r) => r.kind === 'memory')).toBe(true);
      expect(loadReceipts(store).length).toBeGreaterThanOrEqual(3);

      const finalStrip = selectProofStripItems(loadReceipts(store), 5);
      expect(finalStrip.some((i) => i.kind === 'memory')).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('empty proof strip and zero approvals produce an empty next-action home', () => {
    const trust = buildHomeTrustSummary({ approvals: [], receipts: [] });
    expect(trust.pendingApprovalCount).toBe(0);
    expect(trust.hasProof).toBe(false);
    expect(selectProofStripItems([], 3)).toEqual([]);
    expect(resolveNextAction({
      approvalsCount: 0,
      onOpenReview: () => undefined,
      busy: false,
      runtimeOnline: true,
    })).toBeNull();
  });
});
