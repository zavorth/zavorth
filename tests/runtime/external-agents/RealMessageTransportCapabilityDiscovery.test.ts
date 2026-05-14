import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeMessageTransportCapabilityDiscoveryFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/183-wave-2-real-message-transport-capability-discovery.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentRealMessageTransportCapabilityDiscovery.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('real message transport capability discovery', () => {
  it('documents 183 as read-only transport capability discovery with no sends', () => {
    const content = read(DOC);

    expect(content).toContain('Status: real-message-transport-capability-discovery-ready');
    expect(content).toContain('EXTERNAL_EXECUTOR_SKIP_CHANNELS=1 kept on');
    expect(content).toContain('ZavorthExternalMessageTransportCapability');
    expect(content).toContain('send-capable-but-blocked');
    expect(content).toContain('messageActuallySent: false');
    expect(content).toContain('transportMutationActuallyCalled: false');
    expect(content).toContain('final cleanup listener count: 0');
    expect(content).toContain('final cleanup process count: 0');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the discovery boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthRealMessageTransportCapabilityDiscovery/v1');
    expect(boundary).toContain('ZavorthExternalMessageTransportCapability/v1');
    expect(boundary).toContain('normalizeMessageTransportCapabilityDiscovery');
    expect(index).toContain("from './ExternalAgentRealMessageTransportCapabilityDiscovery.js'");
    expect(index).toContain('ZavorthMessageTransportCapabilityDiscoveryNormalization');
  });

  it('normalizes real/fixture evidence into Zavorth transport capabilities', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();

    expect(normalized.decision).toBe('real-message-transport-capability-discovery-ready');
    expect(normalized.nativeContract).toBe('ZavorthRealMessageTransportCapabilityDiscovery/v1');
    expect(normalized.sourceReadiness).toEqual(expect.objectContaining({
      capabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      bridge: 'external-executor-live-read-only-bridge-boundary-ready',
      observability: 'external-executor-live-observability-projection-ready',
      sessionHistory: 'external-executor-session-history-read-only-bridge-ready',
      commandCenter: 'command-center-live-assimilation-ready',
      messageSendRehearsal: 'message-send-live-rehearsal-transport-blocked-ready',
    }));
    expect(normalized.capabilities.length).toBeGreaterThanOrEqual(12);
    normalized.capabilities.forEach((capability) => {
      expect(capability.nativeContract).toBe('ZavorthExternalMessageTransportCapability/v1');
      expect(capability.sourceIdsEvidenceOnly).toBe(true);
      expect(capability.sourceAuthorityGranted).toBe(false);
      expect(capability.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps read-only surfaces non-sendable', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();
    const statusOnly = normalized.capabilities.find((capability) => capability.transportKind === 'status-only');

    expect(statusOnly).toEqual(expect.objectContaining({
      status: 'read-only',
      configured: true,
      supportsSend: false,
      sendPolicy: 'not-supported',
      credentialRequirement: 'none',
      risk: 'read-only-metadata',
    }));
  });

  it('marks send-capable channels as blocked until a future transport gate', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();
    const sendCapable = normalized.capabilities.filter((capability) => capability.supportsSend);

    expect(sendCapable.map((capability) => capability.transportKind)).toEqual(expect.arrayContaining([
      'telegram',
      'whatsapp',
      'discord',
      'slack',
      'signal',
      'imessage',
      'matrix',
      'msteams',
      'mattermost',
      'twitch',
      'qa-channel',
    ]));
    sendCapable.forEach((capability) => {
      expect(capability.status).toBe('unconfigured');
      expect(capability.sendPolicy).toBe('blocked');
      expect(capability.risk).toBe('blocked-mutable-send');
      expect(capability.supportsDryRun).toBe(true);
    });
  });

  it('keeps credentials as SecretRef metadata only', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();
    const credentialed = normalized.capabilities.filter((capability) => capability.credentialRequirement === 'secret-ref-required');

    expect(credentialed.length).toBeGreaterThan(5);
    credentialed.forEach((capability) => {
      expect(capability.secretRef).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthExternalMessageTransportSecretRef/v1',
        rawValueSerialized: false,
      }));
      expect(capability.secretRef?.name).toMatch(/^external-/);
    });
    expect(JSON.stringify(normalized)).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
  });

  it('represents unknown transport metadata honestly as degraded/unknown', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();
    const unknown = normalized.capabilities.find((capability) => capability.sourceEvidence.includes('not classified as message transport'));

    expect(unknown).toEqual(expect.objectContaining({
      transportKind: 'unknown',
      status: 'degraded-unknown',
      supportsSend: false,
      sendPolicy: 'not-supported',
      risk: 'unknown',
    }));
  });

  it('records the skip-channels decision and cleanup evidence', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();

    expect(normalized.discoveryEvidence.skipChannelsDecision).toEqual(expect.objectContaining({
      skipChannelsUsed: true,
      realChannelActivationBlocked: true,
      discoveryCompleteness: 'limited-by-read-only-safety',
    }));
    expect(normalized.discoveryEvidence).toEqual(expect.objectContaining({
      tokenStatus: 'present-redacted',
      commandArgTokenUsed: false,
      listenerObserved: true,
      configuredChannelsCount: 0,
      messageSendDryRunFlagExposed: true,
      finalCleanupListenerCount: 0,
      finalCleanupProcessCount: 0,
    }));
  });

  it('feeds the transport-blocked rehearsal without unlocking send', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();

    expect(normalized.feedsRehearsal).toEqual({
      doc: 'docs/182-wave-2-message-send-live-rehearsal-transport-blocked.md',
      rehearsalDecision: 'message-send-live-rehearsal-transport-blocked-ready',
      transportLiveBlocked: true,
    });
  });

  it('keeps all mutation and execution gates closed', () => {
    const normalized = normalizeMessageTransportCapabilityDiscoveryFixture();

    expect(normalized.executionGate).toEqual({
      transportCapabilityDiscoveryPerformed: true,
      messageActuallySent: false,
      transportMutationActuallyCalled: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sessionMutationActuallyPerformed: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      credentialsAsSecretRefOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-explicit-message-send-transport-target-gate');
  });
});
