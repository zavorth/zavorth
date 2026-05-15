import { describe, expect, it } from '@jest/globals';
import { CAPABILITY_HUB_CONTRACT_VERSION, type CapabilityHubSnapshot } from '../../src/contracts/CapabilityHubContract';
import { ZavorthCapabilityStoreService } from '../../src/services/ZavorthCapabilityStoreService';

function hubSnapshot(): CapabilityHubSnapshot {
  const base: any = {
    requirements: {
      secretRefs: [],
      envKeys: [],
      accounts: [],
      binaries: [],
      manualSteps: [],
    },
    governance: {
      risk: 'low',
      requiresApproval: false,
      budgetRequired: false,
      sandboxRequired: false,
      networkScope: 'none',
      receiptRequired: true,
      auditTrailRequired: true,
    },
    activation: {
      defaultEnabled: false,
      liveAllowed: false,
      configured: false,
      installed: true,
      setupGuided: true,
      readinessChecks: [],
      commands: [],
    },
    source: 'zavorth-core',
    provenance: {
      owner: 'zavorth-core',
      sourceService: 'test',
      sourceId: 'test',
      externalRuntimeDependency: false,
      canonicalRootOnly: true,
    },
    searchText: '',
  };

  return {
    contractVersion: CAPABILITY_HUB_CONTRACT_VERSION,
    generatedAt: '2026-05-15T00:00:00.000Z',
    query: { query: null, kind: null, readiness: null, selectedId: null },
    rootPolicy: {
      canonicalRoot: 'zavorth-core/Zavorth',
      externalCapabilityRootsAllowed: false,
      importsMustNormalizeToZavorthContract: true,
      secretsSerialized: false,
    },
    summary: {
      total: 4,
      visible: 4,
      ready: 1,
      needsConfiguration: 2,
      needsProbe: 1,
      planned: 0,
      blocked: 0,
      guidedSetup: 3,
      approvalGated: 2,
    },
    groups: [],
    featured: [],
    selected: null,
    narrative: {
      headline: 'test',
      operatorSummary: 'test',
      nextAction: 'test',
    },
    items: [
      {
        ...base,
        id: 'channel:telegram',
        kind: 'channel',
        label: 'Telegram',
        summary: 'Telegram approvals and messages.',
        description: 'Telegram channel.',
        tags: ['telegram', 'message'],
        readiness: 'needs_configuration',
        requirements: { ...base.requirements, secretRefs: ['telegram.botToken'] },
        governance: { ...base.governance, risk: 'medium', requiresApproval: true, networkScope: 'external-policy' },
      },
      {
        ...base,
        id: 'provider:openai',
        kind: 'provider',
        label: 'OpenAI',
        summary: 'OpenAI model provider.',
        description: 'Provider.',
        tags: ['model', 'provider'],
        readiness: 'needs_probe',
      },
      {
        ...base,
        id: 'runtime:repo-map',
        kind: 'runtime-capability',
        label: 'Repo map',
        summary: 'Read repository structure.',
        description: 'Development capability.',
        tags: ['repo', 'code'],
        readiness: 'ready',
      },
      {
        ...base,
        id: 'skill:pdf-summary',
        kind: 'skill',
        label: 'PDF summary',
        summary: 'Summarize documents.',
        description: 'Document skill.',
        tags: ['pdf', 'document'],
        readiness: 'ready',
      },
    ] as any,
  };
}

describe('ZavorthCapabilityStoreService', () => {
  it('projects Capability Hub into a human capability store', () => {
    const service = new ZavorthCapabilityStoreService({
      hub: { buildSnapshot: () => hubSnapshot() },
    });
    const snapshot = service.buildContract();

    expect(snapshot.surface).toBe('capability-store');
    expect(snapshot.summary.visible).toBe(4);
    expect(snapshot.summary.available).toBe(2);
    expect(snapshot.summary.needsSetup).toBe(1);
    expect(snapshot.summary.needsTest).toBe(1);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(snapshot.source.executionAuthority).toBe(false);
  });

  it('filters by human category and keeps setup actions non-mutating', () => {
    const service = new ZavorthCapabilityStoreService({
      hub: { buildSnapshot: () => hubSnapshot() },
    });
    const snapshot = service.buildContract({ category: 'communication' });

    expect(snapshot.selectedCategory).toBe('communication');
    expect(snapshot.cards).toHaveLength(1);
    expect(snapshot.cards[0].sourceCapabilityId).toBe('channel:telegram');
    expect(snapshot.cards[0].friendlyStatus).toBe('needs_setup');
    expect(snapshot.cards[0].primaryAction.kind).toBe('setup_guide');
    expect(snapshot.cards[0].primaryAction.mutatesState).toBe(false);
  });

  it('keeps provider readiness honest as needs_test', () => {
    const service = new ZavorthCapabilityStoreService({
      hub: { buildSnapshot: () => hubSnapshot() },
    });
    const snapshot = service.buildContract({ category: 'providers' });

    expect(snapshot.cards).toHaveLength(1);
    expect(snapshot.cards[0].friendlyStatus).toBe('needs_test');
    expect(snapshot.cards[0].primaryAction.kind).toBe('test_readiness');
  });
});
