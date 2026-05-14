import {
  ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthExternalRuntimeBridgeContract.js';
import { ZavorthExternalRuntimeBridgeService } from '../../src/services/ZavorthExternalRuntimeBridgeService.js';

describe('ZavorthExternalRuntimeBridgeService Phase 10', () => {
  it('publishes the Natural First bridge into the Zavorth External Runtime plan without execution', () => {
    const snapshot = new ZavorthExternalRuntimeBridgeService({
      now: () => new Date('2026-05-11T17:00:00.000Z'),
      naturalFirstPackStatus: 'phase-9-complete',
    }).buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T17:00:00.000Z',
      contractVersion: ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
      status: 'bridge-ready',
      planId: '291 - Plano Zavorth External Runtime Absorption',
      naturalFirstPackStatus: 'phase-9-complete',
    }));
    expect(snapshot.gatewayPolicy).toEqual(expect.objectContaining({
      naturalFirstClosed: true,
      freeTextEntrypoint: 'ZavorthAgentGateway',
      allExternalInboundViaGateway: true,
      noExternalReplyBypass: true,
      approvedSurfaces: ['web', 'cli', 'telegram', 'api'],
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      candidateCount: 9,
      executionPerformed: false,
      sourceRuntimeCodeExecuted: false,
      sidecarsStarted: false,
      toolsLaunched: false,
      filesMutated: false,
      userFacingSourceIdentityLeak: false,
    }));
  });

  it('maps Hermes/OpenClaw candidates into Zavorth-owned next packs and Natural First routes', () => {
    const snapshot = new ZavorthExternalRuntimeBridgeService().buildSnapshot();
    const byId = new Map(snapshot.candidates.map((entry) => [entry.id, entry]));

    expect(snapshot.firstImplementationQueue.slice(0, 4)).toEqual([
      'external-capability-inventory',
      'external-runtime-readonly-probe',
      'error-classifier',
      'tool-call-repair',
    ]);
    expect(byId.get('error-classifier')).toEqual(expect.objectContaining({
      decision: 'absorb',
      phase: 'phase-2-native-engine',
      naturalFirstRoute: 'governed-execution',
      zavorthOwner: expect.objectContaining({
        contract: 'ZavorthErrorClassifierContract',
        service: 'ZavorthErrorClassifierService',
      }),
    }));
    expect(byId.get('skill-curator')).toEqual(expect.objectContaining({
      decision: 'absorb',
      naturalFirstRoute: 'approval-proposal',
      safety: expect.objectContaining({
        approvalRequiredForLive: true,
        noAutonomousSkillMutation: true,
      }),
    }));
    expect(byId.get('channel-gateway-normalization')).toEqual(expect.objectContaining({
      sourceRuntimeIds: expect.arrayContaining(['openclaw']),
      phase: 'phase-5-channels-messaging',
      naturalFirstRoute: 'capability-discovery',
    }));
  });

  it('keeps external runtimes quarantined and every candidate behind Zavorth policy', () => {
    const snapshot = new ZavorthExternalRuntimeBridgeService().buildSnapshot();

    expect(snapshot.publicIdentityPolicy).toEqual(expect.objectContaining({
      publicAgentName: 'Zavorth',
      externalRuntimeNamesQuarantinedToDiagnostics: true,
      noSourceRuntimeCanonicalFields: true,
    }));
    expect(snapshot.externalRuntimes.every((entry) => (
      entry.quarantine.diagnosticsOnly
      && entry.quarantine.publicIdentityAllowed === false
      && entry.quarantine.sourceNamesAreCanonical === false
    ))).toBe(true);
    expect(snapshot.candidates.every((entry) => (
      entry.safety.dryRunFirst
      && entry.safety.noSourceRuntimeCodeExecution
      && entry.safety.noDirectToolExecution
      && entry.safety.noDirectUserReply
      && entry.safety.gatewayEntry === 'ZavorthAgentGateway'
      && entry.safety.replyExit === 'Zavorth ReplyPipeline'
      && entry.acceptanceGates.length > 0
    ))).toBe(true);
  });

  it('blocks the bridge if Natural First has not reached phase 9 closure', () => {
    const snapshot = new ZavorthExternalRuntimeBridgeService().buildSnapshot({
      naturalFirstPackStatus: 'phase-8-complete',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.gatewayPolicy).toEqual(expect.objectContaining({
      naturalFirstClosed: false,
      allExternalInboundViaGateway: true,
    }));
    expect(snapshot.policy.noImplementationPerformedByBridge).toBe(true);
  });

  it('formats an operator summary without enabling sidecars or tools', () => {
    const service = new ZavorthExternalRuntimeBridgeService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth External Runtime Bridge - Phase 10');
    expect(text).toContain('Status: bridge-ready');
    expect(text).toContain('Source runtime code executed: false');
    expect(text).toContain('All inbound external events enter ZavorthAgentGateway.');
  });
});
