import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PROOF_LEDGER_CONTRACT_VERSION,
  type ProofEvent,
} from '../../../src/contracts/proof/ProofLedgerContract.js';
import {
  desktopReceiptFromProofEvent,
  proofEventFromDesktopReceipt,
  proofEventFromEvidenceRecord,
  mapProofKindToDesktopKind,
  normalizeProofEventKind,
} from '../../../src/services/proof/proofEventMappers.js';
import {
  InMemoryProofLedgerAdapter,
  JsonlProofLedgerAdapter,
  ProofLedgerService,
  createProofLedgerDemoEvents,
} from '../../../src/services/proof/ProofLedgerService.js';

function createService(seed: ProofEvent[] = []): ProofLedgerService {
  let counter = 0;
  return new ProofLedgerService({
    now: () => new Date('2026-07-11T12:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-${++counter}`,
    ledgerId: 'ledger-test-1',
    adapter: new InMemoryProofLedgerAdapter(seed),
  });
}

function sampleDesktopReceipts() {
  return [
    {
      id: 'rcpt-chat-1',
      kind: 'chat',
      title: 'User asked about status',
      summary: 'Chat turn completed.',
      status: 'ok' as const,
      at: '2026-07-11T11:00:00.000Z',
      sessionId: 'sess-1',
      source: 'desktop',
      metadata: { runId: 'run-a' },
    },
    {
      id: 'rcpt-appr-1',
      kind: 'approval',
      title: 'Approve disk write',
      summary: 'Waiting for owner.',
      status: 'pending' as const,
      at: '2026-07-11T11:30:00.000Z',
      sessionId: 'sess-1',
      source: 'desktop',
      metadata: { approvalId: 'appr-9', riskLevel: 'high' },
    },
  ];
}

function sampleEvidenceRecords() {
  return [
    {
      id: 'ev-1',
      key: 'plan',
      runId: 'run-ev-1',
      status: 'ok',
      generatedAt: '2026-07-11T10:00:00.000Z',
      material: true,
      sequence: 1,
      snapshot: {
        title: 'Plan evidence',
        summary: 'Planner produced a step list.',
        status: 'ok',
        riskLevel: 'low',
      },
    },
    {
      id: 'ev-2',
      key: 'tool-result',
      runId: 'run-ev-1',
      status: 'failed',
      generatedAt: '2026-07-11T10:05:00.000Z',
      material: true,
      sequence: 2,
      snapshot: {
        title: 'Tool failed',
        message: 'Exit code 1',
        risk: 'medium',
      },
    },
  ];
}

describe('ProofLedgerService', () => {
  test('append + list + get', () => {
    const service = createService();
    const created = service.append({
      runId: 'run-1',
      kind: 'runtime',
      surface: 'cli',
      title: 'Runtime tick',
      summary: 'Heartbeat ok',
      status: 'ok',
      riskLevel: 'none',
      approvalId: null,
      artifacts: [],
      source: 'test',
    });

    expect(created.id).toBe('proof-1');
    expect(created.createdAt).toBe('2026-07-11T12:00:00.000Z');
    expect(created.kind).toBe('runtime');

    const listed = service.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe('Runtime tick');

    const found = service.get(created.id);
    expect(found).not.toBeNull();
    expect(found?.summary).toBe('Heartbeat ok');

    expect(service.get('missing')).toBeNull();
  });

  test('list filters by kind, status, runId, query, limit', () => {
    const service = createService();
    service.append({
      id: 'a1',
      runId: 'r1',
      kind: 'chat',
      surface: 'desktop',
      title: 'Hello chat',
      summary: 'greeting',
      status: 'ok',
      riskLevel: 'none',
      approvalId: null,
      artifacts: [],
      source: 't',
      createdAt: '2026-07-11T09:00:00.000Z',
    });
    service.append({
      id: 'a2',
      runId: 'r2',
      kind: 'approval',
      surface: 'desktop',
      title: 'Need approval',
      summary: 'sensitive write',
      status: 'pending',
      riskLevel: 'high',
      approvalId: 'ap1',
      artifacts: [],
      source: 't',
      createdAt: '2026-07-11T10:00:00.000Z',
    });
    service.append({
      id: 'a3',
      runId: 'r1',
      kind: 'chat',
      surface: 'cli',
      title: 'Follow-up',
      summary: 'more chat',
      status: 'failed',
      riskLevel: 'low',
      approvalId: null,
      artifacts: [],
      source: 't',
      createdAt: '2026-07-11T11:00:00.000Z',
    });

    expect(service.list({ kind: 'chat' })).toHaveLength(2);
    expect(service.list({ status: 'pending' })).toHaveLength(1);
    expect(service.list({ runId: 'r1' })).toHaveLength(2);
    expect(service.list({ query: 'sensitive' })).toHaveLength(1);
    expect(service.list({ limit: 1 })[0].id).toBe('a3');
  });

  test('projectFromDesktopReceipts', () => {
    const service = createService();
    const projected = service.projectFromDesktopReceipts(sampleDesktopReceipts());
    expect(projected).toHaveLength(2);
    expect(projected[0].kind).toBe('chat');
    expect(projected[0].surface).toBe('desktop');
    expect(projected[0].runId).toBe('run-a');
    expect(projected[1].kind).toBe('approval');
    expect(projected[1].riskLevel).toBe('high');
    expect(projected[1].approvalId).toBe('appr-9');
    expect(projected[1].status).toBe('pending');
  });

  test('projectFromEvidenceRecords', () => {
    const service = createService();
    const projected = service.projectFromEvidenceRecords(sampleEvidenceRecords());
    expect(projected).toHaveLength(2);
    expect(projected[0].kind).toBe('evidence');
    expect(projected[0].title).toBe('Plan evidence');
    expect(projected[0].runId).toBe('run-ev-1');
    expect(projected[0].status).toBe('ok');
    expect(projected[1].status).toBe('failed');
    expect(projected[1].summary).toContain('Exit code 1');
  });

  test('merge + dedupe by id, sorted createdAt desc', () => {
    const service = createService();
    const left: ProofEvent[] = [
      {
        id: 'same',
        runId: null,
        kind: 'system',
        surface: 'cli',
        title: 'Old title',
        summary: 'from left',
        status: 'info',
        riskLevel: 'none',
        approvalId: null,
        artifacts: [],
        createdAt: '2026-07-11T08:00:00.000Z',
        source: 'left',
      },
      {
        id: 'only-left',
        runId: null,
        kind: 'chat',
        surface: 'cli',
        title: 'Left only',
        summary: 'x',
        status: 'ok',
        riskLevel: 'none',
        approvalId: null,
        artifacts: [],
        createdAt: '2026-07-11T09:00:00.000Z',
        source: 'left',
      },
    ];
    const right: ProofEvent[] = [
      {
        id: 'same',
        runId: null,
        kind: 'system',
        surface: 'cli',
        title: 'New title',
        summary: 'from right',
        status: 'ok',
        riskLevel: 'low',
        approvalId: null,
        artifacts: [],
        createdAt: '2026-07-11T08:00:00.000Z',
        source: 'right',
      },
      {
        id: 'only-right',
        runId: null,
        kind: 'runtime',
        surface: 'runtime',
        title: 'Right only',
        summary: 'y',
        status: 'ok',
        riskLevel: 'none',
        approvalId: null,
        artifacts: [],
        createdAt: '2026-07-11T10:00:00.000Z',
        source: 'right',
      },
    ];

    const merged = service.mergeSources(left, right);
    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe('only-right');
    const same = merged.find((e) => e.id === 'same');
    expect(same?.title).toBe('New title');
    expect(same?.source).toBe('right');
  });

  test('snapshot summary counts', () => {
    const service = createService();
    service.append({
      id: 's1',
      runId: null,
      kind: 'chat',
      surface: 'cli',
      title: 'A',
      summary: 'a',
      status: 'ok',
      riskLevel: 'none',
      approvalId: null,
      artifacts: [],
      source: 't',
    });
    service.append({
      id: 's2',
      runId: null,
      kind: 'approval',
      surface: 'cli',
      title: 'B',
      summary: 'b',
      status: 'failed',
      riskLevel: 'critical',
      approvalId: null,
      artifacts: [],
      source: 't',
    });
    service.append({
      id: 's3',
      runId: null,
      kind: 'chat',
      surface: 'cli',
      title: 'C',
      summary: 'c',
      status: 'ok',
      riskLevel: 'high',
      approvalId: null,
      artifacts: [],
      source: 't',
    });

    const snap = service.buildSnapshot();
    expect(snap.contractVersion).toBe(PROOF_LEDGER_CONTRACT_VERSION);
    expect(snap.source).toBe('proof-ledger');
    expect(snap.summary.total).toBe(3);
    expect(snap.summary.byKind.chat).toBe(2);
    expect(snap.summary.byKind.approval).toBe(1);
    expect(snap.summary.byStatus.ok).toBe(2);
    expect(snap.summary.byStatus.failed).toBe(1);
    expect(snap.summary.highRiskOrAbove).toBe(2);
  });

  test('markdown export contains titles', () => {
    const service = createService();
    service.append({
      id: 'md-1',
      runId: null,
      kind: 'system',
      surface: 'cli',
      title: 'Unique Markdown Title XYZ',
      summary: 'details for export',
      status: 'info',
      riskLevel: 'none',
      approvalId: null,
      artifacts: [],
      source: 't',
    });
    const snap = service.buildSnapshot();
    const md = service.toMarkdown(snap);
    expect(md).toContain('# Zavorth Proof Ledger');
    expect(md).toContain('Unique Markdown Title XYZ');
    expect(md).toContain('details for export');
    expect(md).toContain(PROOF_LEDGER_CONTRACT_VERSION);
  });

  test('toJson returns valid snapshot json', () => {
    const service = createService(createProofLedgerDemoEvents(() => new Date('2026-07-11T12:00:00.000Z')));
    // seed via adapter already loaded
    const snap = service.buildSnapshot();
    const json = service.toJson(snap);
    const parsed = JSON.parse(json);
    expect(parsed.contractVersion).toBe(PROOF_LEDGER_CONTRACT_VERSION);
    expect(Array.isArray(parsed.events)).toBe(true);
  });

  test('mapper desktop round-trip preserves core kinds', () => {
    const coreKinds = [
      'chat',
      'approval',
      'runtime',
      'system',
      'channel',
      'memory',
      'marketplace',
      'workboard',
    ] as const;

    for (const kind of coreKinds) {
      const event: ProofEvent = {
        id: `rt-${kind}`,
        runId: 'run-rt',
        kind,
        surface: 'desktop',
        title: `Title ${kind}`,
        summary: `Summary ${kind}`,
        status: 'ok',
        riskLevel: 'low',
        approvalId: kind === 'approval' ? 'ap-1' : null,
        artifacts: [],
        createdAt: '2026-07-11T12:00:00.000Z',
        source: 'test',
      };
      const receipt = desktopReceiptFromProofEvent(event);
      expect(receipt.kind).toBe(kind);
      const back = proofEventFromDesktopReceipt(receipt);
      expect(back.kind).toBe(kind);
      expect(back.title).toBe(event.title);
      expect(back.status).toBe('ok');
    }

    // action/evidence map to runtime for desktop, then back as runtime
    expect(mapProofKindToDesktopKind('action')).toBe('runtime');
    expect(mapProofKindToDesktopKind('evidence')).toBe('runtime');
    expect(normalizeProofEventKind('totally-weird')).toBe('unknown');
  });

  test('toDesktopReceipt on service matches mapper', () => {
    const service = createService();
    const event = service.append({
      id: 'desk-1',
      runId: 'sess-9',
      kind: 'marketplace',
      surface: 'desktop',
      title: 'Installed skill',
      summary: 'Skill pack added',
      status: 'ok',
      riskLevel: 'low',
      approvalId: null,
      artifacts: [{ id: 'pack-1', type: 'skill', label: 'pack' }],
      source: 'marketplace',
    });
    const receipt = service.toDesktopReceipt(event);
    expect(receipt.id).toBe('desk-1');
    expect(receipt.kind).toBe('marketplace');
    expect(receipt.at).toBe(event.createdAt);
    expect(receipt.sessionId).toBe('sess-9');
  });

  test('jsonl adapter persists and reloads', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-ledger-'));
    const filePath = path.join(dir, 'proof-ledger.jsonl');
    try {
      let counter = 0;
      const service = new ProofLedgerService({
        now: () => new Date('2026-07-11T12:00:00.000Z'),
        idFactory: (prefix) => `${prefix}-${++counter}`,
        jsonlPath: filePath,
      });
      service.append({
        runId: null,
        kind: 'system',
        surface: 'cli',
        title: 'Persisted event',
        summary: 'on disk',
        status: 'ok',
        riskLevel: 'none',
        approvalId: null,
        artifacts: [],
        source: 'jsonl-test',
      });
      expect(fs.existsSync(filePath)).toBe(true);

      const reloaded = new ProofLedgerService({
        jsonlPath: filePath,
        now: () => new Date('2026-07-11T13:00:00.000Z'),
        idFactory: (prefix) => `${prefix}-reload`,
      });
      const listed = reloaded.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].title).toBe('Persisted event');

      const adapter = new JsonlProofLedgerAdapter(filePath);
      expect(adapter.load()).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('evidence mapper standalone', () => {
    const event = proofEventFromEvidenceRecord({
      id: 'ev-x',
      key: 'snapshot',
      runId: 'r-x',
      status: null,
      generatedAt: null,
      snapshot: { status: 'pending', title: 'Waiting' },
    });
    expect(event.kind).toBe('evidence');
    expect(event.status).toBe('pending');
    expect(event.title).toBe('Waiting');
  });
  test('corrupt JSONL lines are skipped on load', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-corrupt-'));
    const filePath = path.join(dir, 'proof-ledger.jsonl');
    try {
      fs.writeFileSync(
        filePath,
        [
          JSON.stringify({
            id: 'good-1',
            runId: null,
            kind: 'system',
            surface: 'cli',
            title: 'Good',
            summary: 'ok',
            status: 'ok',
            riskLevel: 'none',
            approvalId: null,
            artifacts: [],
            createdAt: '2026-07-11T12:00:00.000Z',
            source: 't',
          }),
          '{not-json',
          '',
          JSON.stringify({
            id: 'good-2',
            runId: null,
            kind: 'chat',
            surface: 'cli',
            title: 'Also good',
            summary: 'ok',
            status: 'ok',
            riskLevel: 'none',
            approvalId: null,
            artifacts: [],
            createdAt: '2026-07-11T12:01:00.000Z',
            source: 't',
            metadata: { apiKey: 'sk-secret-12345' },
          }),
        ].join('\n') + '\n',
        'utf8',
      );
      const service = new ProofLedgerService({ jsonlPath: filePath });
      expect(service.list()).toHaveLength(2);
      const json = service.toJson(service.buildSnapshot());
      const md = service.toMarkdown(service.buildSnapshot());
      // S1: secret-like metadata redacted on load + JSON/markdown export
      expect(json).not.toContain('sk-secret-12345');
      expect(json).toMatch(/apiKey["']-\s*:\s*["']\[REDACTED\]["']/);
      expect(md).not.toContain('sk-secret-12345');
      const stored = service.get('good-2');
      expect(stored?.metadata?.apiKey).toBe('[REDACTED]');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('append and export redact secret-like title/summary and nested metadata', () => {
    const service = createService();
    const event = service.append({
      kind: 'action',
      surface: 'cli',
      title: 'Called with api_key=sk-live-LEAKEDTOKEN999',
      summary: 'Authorization: Bearer supersecrettokenvalue',
      status: 'ok',
      riskLevel: 'low',
      metadata: {
        nested: { token: 'raw-token-value', safe: 'ok' },
        authorization: 'Bearer abcdefghijklmnop',
      },
    });

    expect(event.title).not.toContain('LEAKEDTOKEN999');
    expect(event.summary).not.toContain('supersecrettokenvalue');
    expect(event.metadata?.authorization).toBe('[REDACTED]');
    expect((event.metadata?.nested as { token-: string })?.token).toBe('[REDACTED]');
    expect((event.metadata?.nested as { safe-: string })?.safe).toBe('ok');

    const json = service.toJson(service.buildSnapshot());
    expect(json).not.toContain('LEAKEDTOKEN999');
    expect(json).not.toContain('supersecrettokenvalue');
    expect(json).not.toContain('raw-token-value');
    expect(service.toPublicEvent(event).title).not.toContain('sk-live-');
  });
});
