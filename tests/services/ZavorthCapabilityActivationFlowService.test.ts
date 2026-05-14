import type { CapabilityImportManifest } from '../../src/contracts/CapabilityImportContract';
import { CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION } from '../../src/contracts/CapabilityActivationFlowContract';
import { ZavorthCapabilityActivationFlowApiService } from '../../src/services/ZavorthCapabilityActivationFlowApiService';
import { ZavorthCapabilityActivationFlowService } from '../../src/services/ZavorthCapabilityActivationFlowService';

describe('ZavorthCapabilityActivationFlowService', () => {
  it('connects import, setup and governance while waiting for secure secret input', () => {
    const service = new ZavorthCapabilityActivationFlowService({
      now: () => new Date('2026-05-07T17:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      manifest: buildManifest(),
      text: 'ative daily brief',
    });

    expect(snapshot.contractVersion).toBe(CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION);
    expect(snapshot.status).toBe('waiting_secret_input');
    expect(snapshot.target?.id).toBe('skill:daily-brief');
    expect(snapshot.importSnapshot.summary.normalizedItems).toBe(1);
    expect(snapshot.setupSnapshot?.selectedCapability?.id).toBe('skill:daily-brief');
    expect(snapshot.setupSnapshot?.governancePlan?.recipeId).toBe('governed-skill-run');
    expect(snapshot.setupSnapshot?.secretPlan.missingRefs).toEqual(['calendar.oauth']);
    expect(snapshot.activation).toMatchObject({
      dryRunOnly: true,
      liveActivationApplied: false,
    });
    expect(snapshot.policy).toMatchObject({
      canonicalRootOnly: true,
      externalRootsAllowed: false,
      secretsSerialized: false,
      ownerApprovalBeforeLive: true,
    });
  });

  it('moves to waiting approval after secret refs are available without serializing values', () => {
    const service = new ZavorthCapabilityActivationFlowService({
      now: () => new Date('2026-05-07T17:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      manifest: buildManifest(),
      text: 'ative daily brief',
      providedSecrets: {
        'calendar.oauth': 'calendar-token-value-that-must-not-leak',
      },
    });

    expect(snapshot.status).toBe('waiting_approval');
    expect(snapshot.setupSnapshot?.secretPlan.missingRefs).toEqual([]);
    expect(snapshot.setupSnapshot?.secretPlan.providedRefs).toEqual(['calendar.oauth']);
    expect(JSON.stringify(snapshot)).not.toContain('calendar-token-value-that-must-not-leak');
    expect(snapshot.activation.nextCommand).toContain('--approval-id');
  });

  it('prepares a controlled activation request after approval but does not apply live activation', () => {
    const api = new ZavorthCapabilityActivationFlowApiService({
      now: () => new Date('2026-05-07T17:00:00.000Z'),
    });

    const snapshot = api.buildSnapshot({
      manifest: buildManifest(),
      text: 'ative daily brief',
      approvalId: 'approval-123',
      providedSecrets: {
        'calendar.oauth': 'calendar-token-value-that-must-not-leak',
      },
    });

    expect(snapshot.status).toBe('ready_for_controlled_activation');
    expect(snapshot.activation.approvalId).toBe('approval-123');
    expect(snapshot.activation.liveActivationApplied).toBe(false);
    expect(snapshot.receipts.map((receipt) => receipt.source)).toEqual(expect.arrayContaining([
      'importer',
      'governance',
      'activation-flow',
    ]));
  });

  it('blocks manifests with raw secret-looking values before setup starts', () => {
    const service = new ZavorthCapabilityActivationFlowService({
      now: () => new Date('2026-05-07T17:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      manifest: {
        ...buildManifest(),
        summary: 'bad sk-test-secret-value-1234567890',
      },
      text: 'ative daily brief',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.target).toBeNull();
    expect(snapshot.setupSnapshot).toBeNull();
    expect(snapshot.importSnapshot.summary.blocked).toBe(1);
  });
});

function buildManifest(): CapabilityImportManifest {
  return {
    packId: 'team-ops-pack',
    label: 'Team Ops Pack',
    summary: 'Team operations capabilities.',
    source: {
      label: 'team-curated',
      externalRuntimeDependency: true,
    },
    items: [
      {
        id: 'daily-brief',
        kind: 'skill',
        label: 'Daily Brief',
        summary: 'Prepare a governed daily brief.',
        description: 'Collects inputs and produces an artifact-first daily summary.',
        tags: ['ops', 'briefing'],
        requirements: {
          secretRefs: ['calendar.oauth'],
          manualSteps: ['choose calendars'],
        },
        governance: {
          risk: 'medium',
          requiresApproval: true,
          networkScope: 'external-policy',
        },
        activation: {
          readiness: 'needs_configuration',
          readinessChecks: ['calendar-token', 'workspace-policy'],
        },
      },
    ],
  };
}
