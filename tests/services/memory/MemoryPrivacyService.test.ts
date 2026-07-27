import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MEMORY_PRIVACY_CONTRACT_VERSION,
} from '../../../src/contracts/memory/MemoryPrivacyContract.js';
import {
  MemoryPrivacyService,
  createMemoryPrivacyDemoLooseItems,
  detectSecretLike,
  redactSecretLikeText,
} from '../../../src/services/memory/MemoryPrivacyService.js';
import {
  InMemoryProofLedgerAdapter,
  ProofLedgerService,
} from '../../../src/services/proof/ProofLedgerService.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-privacy-'));
}

function createService(opts: {
  demoStorePath-: string | null;
  now-: () => Date;
} = {}): MemoryPrivacyService {
  const dir = createTempDir();
  return new MemoryPrivacyService({
    demoStorePath: opts.demoStorePath === undefined
      ? path.join(dir, 'memory-privacy-demo.json')
      : opts.demoStorePath,
    now: opts.now || (() => new Date('2026-07-11T12:00:00.000Z')),
    idFactory: (prefix) => `${prefix}-test-1`,
  });
}

describe('MemoryPrivacyService', () => {
  test('maps conversation origin from source/kind', () => {
    const service = createService();
    const [view] = service.fromLooseItems([
      {
        id: 'm1',
        title: 'Repo uses Postgres',
        summary: 'Architecture decision from chat.',
        kind: 'project-fact',
        source: 'conversation',
      },
    ]);
    expect(view.origin).toBe('conversation');
    expect(view.originLabel).toBe('Conversation');
    expect(view.whyIKnowThis).toMatch(/past conversation/i);
    expect(view.canForget).toBe(true);
    expect(view.consentState).toBe('implied');
  });

  test('secretLike flags without leaking secret value in view', () => {
    const service = createService();
    const secretValue = 'sk-leakedvalueSHOULDNOTAPPEAR';
    const [view] = service.fromLooseItems([
      {
        id: 'mem-secret-1',
        title: 'Vendor API credential',
        summary: `api_key=${secretValue}`,
        content: secretValue,
        kind: 'secret-reference',
        origin: 'conversation',
      },
    ]);

    expect(view.secretLike).toBe(true);
    expect(view.summary).not.toContain(secretValue);
    expect(view.summary).toMatch(/redacted|Sensitive/i);
    expect(JSON.stringify(view)).not.toContain(secretValue);

    expect(detectSecretLike({ summary: `token=${secretValue}` })).toBe(true);
    expect(redactSecretLikeText(`api_key=${secretValue}`)).not.toContain(secretValue);
  });

  test('forget proof event shape is memory / Memory forgotten', () => {
    const service = createService();
    const items = createMemoryPrivacyDemoLooseItems();
    const views = service.fromLooseItems(items);
    const conv = views.find((v) => v.id === 'mem-conv-1');
    expect(conv).toBeTruthy();

    const proof = service.buildForgetProofEvent(conv!, 'owner-test');
    expect(proof.kind).toBe('memory');
    expect(proof.title).toBe('Memory forgotten');
    expect(proof.source).toBe('memory-privacy-os');
    expect(proof.status).toBe('ok');
    expect(proof.summary).toContain('mem-conv-1');
    expect(proof.summary).toContain('owner-test');
    expect(proof.metadata).toMatchObject({
      memoryId: 'mem-conv-1',
      action: 'forget',
      decidedBy: 'owner-test',
    });
    // Must not embed raw content blobs
    expect(JSON.stringify(proof)).not.toMatch(/sk-leaked/i);

    const ledger = new ProofLedgerService({
      adapter: new InMemoryProofLedgerAdapter(),
      now: () => new Date('2026-07-11T12:00:00.000Z'),
      idFactory: (p) => `${p}-1`,
    });
    const event = ledger.append(proof);
    expect(event.kind).toBe('memory');
    expect(event.title).toBe('Memory forgotten');
    expect(event.id).toBeTruthy();
  });

  test('snapshot counts forgettable / review / secretLike', () => {
    const service = createService();
    const snapshot = service.buildSnapshot({
      items: createMemoryPrivacyDemoLooseItems(),
      learning: [
        { id: 'l1', title: 'Short answers', lane: 'yellow', status: 'pending' },
        { id: 'l2', title: 'Green there isbit', lane: 'green', status: 'approved' },
      ],
    });

    expect(snapshot.contractVersion).toBe(MEMORY_PRIVACY_CONTRACT_VERSION);
    expect(snapshot.summary.total).toBe(3);
    // system-critical cannot forget; secret + conv can
    expect(snapshot.summary.forgettable).toBe(2);
    expect(snapshot.summary.secretLike).toBe(1);
    // yellow learning needs review
    expect(snapshot.summary.reviewQueue).toBeGreaterThanOrEqual(1);
    expect(snapshot.dreamCandidates).toHaveLength(2);
    expect(snapshot.nextSafeAction.length).toBeGreaterThan(10);
    expect(service.toMarkdown(snapshot)).toContain('Memory Privacy');
  });

  test('seed demo roundtrip: list, explain, forget with --yes semantics', () => {
    const dir = createTempDir();
    const demoPath = path.join(dir, 'memory-privacy-demo.json');
    const service = createService({ demoStorePath: demoPath });

    const seeded = service.seedDemo();
    expect(fs.existsSync(demoPath)).toBe(true);
    expect(seeded.items.length).toBeGreaterThanOrEqual(4);

    const snapshot = service.buildSnapshotFromDemo();
    expect(snapshot.summary.total).toBe(seeded.items.length);

    const explained = service.explainFromDemo('mem-demo-pref-tabs');
    expect(explained).not.toBeNull();
    expect(explained!.origin).toBe('user-stated');
    expect(explained!.whyIKnowThis).toMatch(/explicitly asked/i);

    const secret = service.explainFromDemo('mem-demo-secret-flag');
    expect(secret!.secretLike).toBe(true);
    expect(JSON.stringify(secret)).not.toMatch(/sk-demoSECRET/i);

    const system = service.explainFromDemo('mem-demo-system-identity');
    expect(system!.canForget).toBe(false);
    expect(service.forgetInDemo('mem-demo-system-identity')).toBeNull();

    const forgotten = service.forgetInDemo('mem-demo-pref-tabs', 'tester');
    expect(forgotten).not.toBeNull();
    expect(forgotten!.proof.title).toBe('Memory forgotten');
    expect(forgotten!.proof.kind).toBe('memory');

    // Item no longer listed
    expect(service.explainFromDemo('mem-demo-pref-tabs')).toBeNull();
    const after = service.buildSnapshotFromDemo();
    expect(after.summary.total).toBe(seeded.items.length - 1);
    expect(after.items.find((i) => i.id === 'mem-demo-pref-tabs')).toBeUndefined();
  });

  test('system-critical canForget false', () => {
    const service = createService();
    const [view] = service.fromLooseItems([
      {
        id: 'sys-1',
        title: 'Bootstrap identity',
        kind: 'system',
        origin: 'system',
        systemCritical: true,
      },
    ]);
    expect(view.canForget).toBe(false);
    expect(view.origin).toBe('system');
  });

  test('title with embedded secret is redacted in views', () => {
    const service = createService();
    const secretValue = 'sk-titleLEAKSHOULDNOTAPPEAR99';
    const [view] = service.fromLooseItems([
      {
        id: 'mem-title-secret',
        title: 'Vendor key ' + secretValue,
        summary: 'credential reference',
        kind: 'secret-reference',
        origin: 'conversation',
      },
    ]);
    expect(view.secretLike).toBe(true);
    expect(view.title).not.toContain(secretValue);
    expect(JSON.stringify(view)).not.toContain(secretValue);
  });

  test('whyIKnowThis is accurate for dream-cycle pending vs accepted', () => {
    const service = createService();
    const [pending, accepted] = service.fromLooseItems([
      {
        id: 'dream-pending',
        title: 'Maybe prefer dark mode',
        origin: 'dream-cycle',
        consentState: 'review',
        summary: 'Proposed preference',
      },
      {
        id: 'dream-accepted',
        title: 'Prefer dark mode',
        origin: 'dream-cycle',
        consentState: 'granted',
        summary: 'Accepted preference',
      },
    ]);
    expect(pending.whyIKnowThis).toMatch(/pending review/i);
    expect(accepted.whyIKnowThis).toMatch(/after review/i);
    expect(accepted.whyIKnowThis).not.toMatch(/pending review/i);
  });

  test('forgetInDemo only mutates demo store (not a live wipe path)', () => {
    const dir = createTempDir();
    const demoPath = path.join(dir, 'memory-privacy-demo.json');
    const service = createService({ demoStorePath: demoPath });
    service.seedDemo();
    const before = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
    const result = service.forgetInDemo('mem-demo-pref-tabs', 'tester');
    expect(result).not.toBeNull();
    const after = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
    // Demo item is marked forgotten, not deleted from disk file
    expect(after.items.find((i) => i.id === 'mem-demo-pref-tabs')?.forgotten).toBe(true);
    expect(after.items.length).toBe(before.items.length);
    // Null demo path cannot forget anything
    const noStore = createService({ demoStorePath: null });
    expect(noStore.forgetInDemo('mem-demo-pref-tabs')).toBeNull();
  });

});
