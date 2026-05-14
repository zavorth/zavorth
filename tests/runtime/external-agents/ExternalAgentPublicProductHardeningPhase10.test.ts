import fs from 'node:fs';
import path from 'node:path';
import {
  type ExternalAgentProductHardeningChecklistItem,
  type ExternalAgentPublicCapabilityMatrixItem,
  type ExternalAgentPublicSurface,
  type ExternalAgentPublicSurfaceKind,
  evaluateExternalAgentPublicProductHardeningGate,
} from '../../../src/runtime/external-agents/index.js';
import {
  buildZavorthCommandCenterAssimilationSnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';

function readSurface(relativePath: string, kind: ExternalAgentPublicSurfaceKind): ExternalAgentPublicSurface {
  const absolutePath = path.join(process.cwd(), relativePath);
  return {
    id: relativePath.replaceAll(path.sep, '/'),
    label: relativePath,
    path: relativePath,
    kind,
    content: fs.readFileSync(absolutePath, 'utf8'),
  };
}

function createCanonicalSurfaces(): ExternalAgentPublicSurface[] {
  return [
    readSurface('src/runtime/external-agents/contracts.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentSidecarAdapter.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentCapabilityProvider.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentChannelBridge.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentSessionMemoryBridge.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentWorkerBridge.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentNativeReplacementRegistry.ts', 'canonical-zavorth-source'),
    readSurface('src/runtime/external-agents/ExternalAgentPublicProductHardeningGate.ts', 'canonical-zavorth-source'),
    readSurface('src/ai-gateway/app/(dashboard)/control/command-center/contracts/zavorthCommandCenterContracts.ts', 'canonical-zavorth-source'),
    readSurface('src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthCommandCenterAssimilationProjection.ts', 'canonical-zavorth-source'),
  ];
}

function createCompatibilitySurfaces(): ExternalAgentPublicSurface[] {
  return [
    readSurface('src/runtime/external-agents/external-executor/QuarantinedExternalExecutorSidecarAdapter.ts', 'adapter-detail'),
    readSurface('src/runtime/external-agents/external-executor/FixtureExternalExecutorSidecarClient.ts', 'adapter-detail'),
    readSurface('docs/115-external-agent-absorption-inventory.md', 'inventory-evidence'),
    readSurface('docs/external-agent-absorption/external-executor/README.md', 'compatibility-doc'),
    readSurface('src/ai-gateway/shared/constants/cliTools.ts', 'compatibility-route'),
  ];
}

function createCapabilityMatrix(): ExternalAgentPublicCapabilityMatrixItem[] {
  return [
    {
      id: 'gateway-event-normalization',
      label: 'Gateway event normalization',
      decision: 'adapt',
      publicBehavior: 'External events enter as NormalizedInboundMessage.',
      securityBoundary: 'No external event bus or direct legacy dispatch.',
      acceptanceCriteria: ['One external event normalizes and enters ZavorthAgentGateway.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentAdapterContract.test.ts'],
      status: 'complete',
    },
    {
      id: 'capability-policy',
      label: 'Capability policy',
      decision: 'adapt',
      publicBehavior: 'External capability metadata becomes Zavorth capability inventory and policy input.',
      securityBoundary: 'Imported tools stay blocked or approval-gated by Zavorth policy.',
      acceptanceCriteria: ['Unavailable/quarantined capabilities fail honestly.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentCapabilityProviderPhase4.test.ts'],
      status: 'complete',
    },
    {
      id: 'channel-bridge',
      label: 'Channel bridge',
      decision: 'adapt',
      publicBehavior: 'Inbound channel events and outbound replies pass through Zavorth contracts.',
      securityBoundary: 'ReplyPipeline and sidecar action gate own delivery.',
      acceptanceCriteria: ['Delivery receipts and history remain Zavorth-owned.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentChannelBridgePhase5.test.ts'],
      status: 'complete',
    },
    {
      id: 'session-memory',
      label: 'Session and memory bridge',
      decision: 'replace',
      publicBehavior: 'Imported source history becomes Zavorth read model, context, and memory signals.',
      securityBoundary: 'Private entries excluded and restricted entries redacted.',
      acceptanceCriteria: ['Continuation runs through ZavorthAgentGateway.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentSessionMemoryBridgePhase6.test.ts'],
      status: 'complete',
    },
    {
      id: 'command-center',
      label: 'Command Center projection',
      decision: 'replace',
      publicBehavior: 'Ordinary users see runtime state through Zavorth Command Center view models.',
      securityBoundary: 'Source dashboard UI types, routes, CSS, and product copy are not imported.',
      acceptanceCriteria: ['Realtime, empty, offline, failure, and identity scan states pass.'],
      testsOrSmokes: ['tests/ai-gateway/control/CommandCenterAssimilationPhase7.test.ts'],
      status: 'complete',
    },
    {
      id: 'remote-workers',
      label: 'Remote worker bridge',
      decision: 'externalize',
      publicBehavior: 'Existing worker endpoints receive Zavorth delegated task envelopes.',
      securityBoundary: 'Phase 8 never launches source worker processes.',
      acceptanceCriteria: ['Timeout, cancellation, artifact return, and worker state are visible.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentWorkerBridgePhase8.test.ts'],
      healthAndFailureModel: 'ExternalAgentNodeDaemonHealthSnapshot and ExternalAgentWorkerStatusSnapshot.',
      status: 'complete',
    },
    {
      id: 'native-replacement',
      label: 'Native replacement',
      decision: 'replace',
      publicBehavior: 'Native candidates become removable only after public-contract parity passes.',
      securityBoundary: 'Source module copy requests and source identity leaks block replacement.',
      acceptanceCriteria: ['Parity-ready, identity-leak, copy-request, and failing-parity cases are covered.'],
      testsOrSmokes: ['tests/runtime/external-agents/ExternalAgentNativeReplacementPhase9.test.ts'],
      status: 'complete',
    },
    {
      id: 'source-branding-assets',
      label: 'Source runtime branding assets',
      decision: 'reject',
      publicBehavior: 'Source product identity is not adopted as Zavorth product identity.',
      securityBoundary: 'Allowed only in compatibility evidence or adapter details.',
      acceptanceCriteria: ['Public canonical scans block source identity leaks.'],
      testsOrSmokes: [],
      rejectReason: 'Branding is product identity, not a capability.',
      status: 'complete',
    },
  ];
}

function createChecklist(): ExternalAgentProductHardeningChecklistItem[] {
  return [
    {
      id: 'docs-cleanup',
      label: 'Docs cleanup',
      category: 'docs',
      status: 'pass',
      evidence: ['docs/115-external-agent-absorption-inventory.md', 'docs/116-external-agent-public-product-hardening.md'],
    },
    {
      id: 'env-config-cleanup',
      label: 'Env/config cleanup',
      category: 'env-config',
      status: 'pass',
      evidence: ['Legacy source env keys stay compatibility-only; no Phase 10 config mutation.'],
    },
    {
      id: 'command-center-final-projection',
      label: 'Command Center final projection',
      category: 'command-center',
      status: 'pass',
      evidence: ['tests/ai-gateway/control/CommandCenterAssimilationPhase7.test.ts'],
    },
    {
      id: 'release-checklist',
      label: 'Release checklist',
      category: 'release',
      status: 'pass',
      evidence: ['Phase 10 release checklist is documented before full absorption.'],
    },
    {
      id: 'security-review',
      label: 'Security review',
      category: 'security',
      status: 'pass',
      evidence: ['Adapter quarantine, approval gates, privacy redaction, worker no-launch, and parity gates are covered.'],
    },
    {
      id: 'capability-matrix',
      label: 'Capability matrix completed',
      category: 'capability-matrix',
      status: 'pass',
      evidence: ['Phase 10 matrix rows all have decisions and coverage.'],
    },
  ];
}

describe('Plan 111 Phase 10 public product hardening', () => {
  it('passes when canonical surfaces are Zavorth-native and compatibility mentions stay quarantined', () => {
    const snapshot = buildZavorthCommandCenterAssimilationSnapshot({
      identityLeakTerms: ['ExternalExecutor'],
      now: () => new Date('2026-04-28T02:00:00.000Z'),
    });

    const report = evaluateExternalAgentPublicProductHardeningGate({
      surfaces: [
        ...createCanonicalSurfaces(),
        ...createCompatibilitySurfaces(),
      ],
      capabilityMatrix: createCapabilityMatrix(),
      checklist: createChecklist(),
      commandCenter: {
        primarySurface: true,
        workflowIds: snapshot.workflows.map((workflow) => workflow.id),
        sourceIdentityLeakScanPassed: snapshot.identityLeakScan.passed,
        cloneIndicators: [],
      },
    }, {
      now: () => new Date('2026-04-28T02:01:00.000Z'),
      forbiddenSourceTerms: ['ExternalExecutor'],
    });

    expect(report).toEqual(expect.objectContaining({
      version: 'external-agent-public-product-hardening-report/v1',
      status: 'pass',
      guarantee: {
        publicCanonicalSurfacesZavorthNative: true,
        everyAdoptedCapabilityHasCoverage: true,
        releaseChecklistComplete: true,
        securityReviewComplete: true,
        commandCenterIsPrimaryProductSurface: true,
      },
    }));
    expect(report.surfaceScan.canonicalLeaks).toEqual([]);
    expect(report.surfaceScan.compatibilityMentions.length).toBeGreaterThan(0);
    expect(report.capabilityMatrix).toEqual(expect.objectContaining({
      total: 8,
      complete: true,
      findings: [],
    }));
  });

  it('blocks when a canonical public surface leaks source runtime identity', () => {
    const report = evaluateExternalAgentPublicProductHardeningGate({
      surfaces: [
        {
          id: 'bad-command-center-copy',
          label: 'Bad Command Center copy',
          path: 'src/ai-gateway/app/(dashboard)/control/command-center/bad.tsx',
          kind: 'canonical-zavorth-source',
          content: 'Render ExternalExecutor dashboard as the primary Zavorth surface.',
        },
      ],
      capabilityMatrix: createCapabilityMatrix(),
      checklist: createChecklist(),
      commandCenter: {
        primarySurface: true,
        workflowIds: ['sessions.resume', 'channels.review', 'capabilities.review', 'runtime.doctor'],
        sourceIdentityLeakScanPassed: true,
        cloneIndicators: [],
      },
    }, {
      forbiddenSourceTerms: ['ExternalExecutor'],
      now: () => new Date('2026-04-28T02:10:00.000Z'),
    });

    expect(report.status).toBe('blocked');
    expect(report.guarantee.publicCanonicalSurfacesZavorthNative).toBe(false);
    expect(report.surfaceScan.canonicalLeaks).toEqual([
      expect.objectContaining({
        surfaceId: 'bad-command-center-copy',
        term: 'ExternalExecutor',
      }),
    ]);
  });

  it('blocks incomplete release, matrix, security, or Command Center gates', () => {
    const report = evaluateExternalAgentPublicProductHardeningGate({
      surfaces: createCanonicalSurfaces(),
      capabilityMatrix: [
        {
          id: 'missing-tests',
          label: 'Missing tests',
          decision: 'adapt',
          publicBehavior: 'Useful behavior without coverage.',
          securityBoundary: 'Unclear.',
          acceptanceCriteria: [],
          testsOrSmokes: [],
          status: 'blocked',
        },
      ],
      checklist: [
        {
          id: 'release-blocked',
          label: 'Release checklist blocked',
          category: 'release',
          status: 'blocked',
          evidence: ['Missing security review and matrix completion.'],
        },
      ],
      commandCenter: {
        primarySurface: false,
        workflowIds: ['runtime.doctor'],
        sourceIdentityLeakScanPassed: false,
        cloneIndicators: ['source dashboard route naming'],
      },
    }, {
      forbiddenSourceTerms: ['ExternalExecutor'],
      now: () => new Date('2026-04-28T02:20:00.000Z'),
    });

    expect(report.status).toBe('blocked');
    expect(report.capabilityMatrix.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'missing-tests',
      }),
    ]));
    expect(report.checklist.blocked).toBe(1);
    expect(report.checklist.missingCategories).toEqual(expect.arrayContaining([
      'docs',
      'env-config',
      'command-center',
      'security',
      'capability-matrix',
    ]));
    expect(report.commandCenter).toEqual(expect.objectContaining({
      primarySurface: false,
      workflowCoveragePassed: false,
      identityLeakScanPassed: false,
      cloneIndicators: ['source dashboard route naming'],
    }));
  });
});
