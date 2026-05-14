import {
  ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthCapabilityProviderRegistryContract.js';
import { ZavorthCapabilityProviderRegistryService } from '../../src/services/ZavorthCapabilityProviderRegistryService.js';

describe('ZavorthCapabilityProviderRegistryService Phase 4', () => {
  it('publishes the capability provider registry snapshot after Phase 3 readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T21:10:00.000Z',
      contractVersion: ZAVORTH_CAPABILITY_PROVIDER_REGISTRY_CONTRACT_VERSION,
      status: 'capability-provider-registry-ready',
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-4-capability-providers',
      previousSidecarAdapterStatus: 'sidecar-adapter-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      normalizedCapabilities: 6,
      importedSkillManifests: 1,
      classifiedTools: expect.any(Number),
      approvalRequiredCapabilities: expect.any(Number),
      quarantinedCapabilities: 1,
      unavailableCapabilities: 1,
      directToolExposureAllowed: 0,
      sourceRuntimeCodeExecuted: false,
      toolExecutionPerformed: false,
      skillMutationPerformed: false,
    }));
    expect(snapshot.summary.classifiedTools).toBeGreaterThanOrEqual(4);
    expect(snapshot.summary.approvalRequiredCapabilities).toBeGreaterThanOrEqual(3);
    expect(snapshot.summary.dangerousCapabilitiesApprovalGated).toBeGreaterThanOrEqual(2);
    expect(snapshot.summary.unavailableCapabilitiesFailHonestly).toBe(1);
    expect(snapshot.commands.nextPhase).toBe('291 Phase 5 - Channels And Messaging');
  });

  it('normalizes capability metadata as Zavorth-owned registry entries', () => {
    const service = createService();
    const capability = service.normalizeCapability({
      sourceCapabilityId: 'source.skill.test',
      sourceRuntimeId: 'source-runtime-test',
      name: '  Test Skill  ',
      description: 'A source skill used only as advisory provider metadata.',
      kind: 'skill',
      tags: ['Source Skill', 'Routing'],
      availability: 'available',
      riskHint: 'low',
      toolNames: [],
    });

    expect(capability).toEqual(expect.objectContaining({
      capabilityId: 'zavorth.capability.source-skill-test',
      sourceCapabilityId: 'source.skill.test',
      sourceRuntimeId: 'source-runtime-test',
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      kind: 'skill',
      name: 'Test Skill',
      availability: 'available',
      risk: 'low',
      manifestRef: null,
      toolBindings: [],
      policy: expect.objectContaining({
        requiredDecision: 'allow',
        approvalRequired: false,
        canExposeTool: false,
        canRunWithoutApproval: true,
      }),
    }));
    expect(capability.tags).toEqual(['source-skill', 'routing']);
  });

  it('imports skill manifests as dry-run receipts without mutating skills or exposing tools', () => {
    const receipt = createService().importSkillManifest({
      manifestId: 'manifest.test',
      sourceRuntimeId: 'source-runtime-test',
      name: 'Test manifest',
      description: 'Imports advisory skill metadata into the registry.',
      entrypoint: 'skills/test/manifest.json',
      tools: ['read.session', 'message.send'],
      tags: ['test'],
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'import-ready',
      manifestId: 'manifest.test',
      capabilityId: 'zavorth.capability.manifest-test',
      importedName: 'Test manifest',
      errors: [],
      toolRiskReceipts: expect.arrayContaining([
        expect.objectContaining({ toolName: 'read.session', requiredDecision: 'preview-only' }),
        expect.objectContaining({ toolName: 'message.send', requiredDecision: 'approval-required' }),
      ]),
      safety: expect.objectContaining({
        noSkillMutationPerformed: true,
        noToolExposurePerformed: true,
        noSourceRuntimeCodeExecuted: true,
        approvalRequiredBeforeActivation: true,
      }),
    }));
  });

  it('classifies dangerous tools as approval-required without executing them', () => {
    const receipt = createService().classifyToolRisk({ toolName: 'delete.files' });

    expect(receipt).toEqual(expect.objectContaining({
      toolName: 'delete.files',
      risk: 'critical',
      requiredDecision: 'approval-required',
      approvalRequired: true,
      quarantineRequired: false,
      signals: expect.arrayContaining(['destructive-filesystem-intent']),
      safety: expect.objectContaining({
        noToolExecution: true,
        noDirectExposure: true,
        noApprovalBypass: true,
      }),
    }));
  });

  it('keeps quarantined capabilities unable to expose tools', () => {
    const capability = createService().normalizeCapability({
      sourceCapabilityId: 'source.tool.unsafe',
      sourceRuntimeId: 'source-runtime-test',
      name: 'unsafe.raw.shell',
      description: 'Untrusted raw shell bridge from an advisory runtime.',
      kind: 'tool',
      tags: ['unsafe', 'shell'],
      availability: 'available',
      riskHint: 'high',
      quarantined: true,
      toolNames: ['unsafe.raw.shell'],
    });

    expect(capability.availability).toBe('quarantined');
    expect(capability.policy).toEqual(expect.objectContaining({
      requiredDecision: 'quarantine',
      approvalRequired: true,
      canExposeTool: false,
      canRunWithoutApproval: false,
      failureMode: 'quarantine-review',
    }));
    expect(capability.toolBindings.every((binding) => binding.directExposureAllowed === false)).toBe(true);
  });

  it('makes unavailable capabilities fail honestly without silent fallback', () => {
    const service = createService();
    const capability = service.normalizeCapability({
      sourceCapabilityId: 'source.plugin.offline',
      sourceRuntimeId: 'source-runtime-test',
      name: 'offline.plugin',
      description: 'Unavailable plugin provider metadata.',
      kind: 'plugin',
      tags: ['offline'],
      availability: 'unavailable',
      riskHint: 'medium',
    });
    const receipt = service.buildUnavailableReceipt(capability);

    expect(capability.policy).toEqual(expect.objectContaining({
      requiredDecision: 'unavailable',
      approvalRequired: false,
      canExposeTool: false,
      canRunWithoutApproval: false,
      failureMode: 'honest-unavailable',
    }));
    expect(receipt).toEqual(expect.objectContaining({
      capabilityId: capability.capabilityId,
      status: 'honest-unavailable',
      fallbackAllowed: false,
      safety: expect.objectContaining({
        noSilentFallback: true,
        noToolExecution: true,
        noProviderCall: true,
      }),
    }));
  });

  it('projects capability provider state for Command Center', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.commandCenterProjection).toEqual(expect.objectContaining({
      title: 'Capability Provider Registry',
      status: 'capability-provider-registry-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'metadata normalization',
        'skill manifest dry-run',
        'tool risk classification',
        'approval-gated danger',
        'honest unavailable',
        'no direct tool exposure',
      ]),
      nextSafeAction: 'Proceed to 291 Phase 5 - Channels And Messaging.',
    }));
    expect(snapshot.commandCenterProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'capabilities',
      'manifests',
      'tools',
      'approval',
      'quarantine',
      'unavailable',
      'direct-tools',
    ]));
  });

  it('blocks Phase 4 if Phase 3 sidecar adapter is not ready', () => {
    const snapshot = createService().buildSnapshot({ sidecarAdapterStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousSidecarAdapterStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'phase-3-sidecar-adapter-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for the provider registry pack', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Capability Provider Registry - Phase 4');
    expect(text).toContain('Status: capability-provider-registry-ready');
    expect(text).toContain('Direct tool exposure allowed: 0');
    expect(text).toContain('Tool execution performed: false');
    expect(text).toContain('Next: 291 Phase 5 - Channels And Messaging');
  });
});

function createService(): ZavorthCapabilityProviderRegistryService {
  return new ZavorthCapabilityProviderRegistryService({
    now: () => new Date('2026-05-11T21:10:00.000Z'),
    sidecarAdapterStatus: 'sidecar-adapter-ready',
  });
}
