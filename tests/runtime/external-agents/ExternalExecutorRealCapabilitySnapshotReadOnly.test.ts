import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalExecutorRealCapabilitySnapshotReadOnlyFixtureSource,
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/161-wave-1-real-capability-snapshot-read-only.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const ROW_KINDS = [
  'plugin-capabilities',
  'provider-capabilities',
  'channel-capabilities',
  'command-http-capabilities',
  'gateway-method-capabilities',
  'worker-node-capabilities',
  'session-history-capabilities',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor real capability snapshot read-only gate', () => {
  it('documents the real read-only snapshot without exposing secrets or authority', () => {
    const content = read(DOC);

    expect(content).toContain('Status: real-capability-snapshot-read-only-ok');
    expect(content).toContain('docs/158-wave-1-external-executor-gateway-secret-ref-provisioning.md -> secret-present-redacted');
    expect(content).toContain('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md -> authenticated-health-ok');
    expect(content).toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('command-arg token used: false');
    expect(content).toContain('url override used: false');
    expect(content).toContain('executionAuthority: false');
    expect(content).toContain('real adapter created: false');
    expect(content).toContain('live event stream opened: false');
    expect(content).toContain('tool/provider/command execution authorized: false');
    expect(content).toContain('decision: real-capability-snapshot-read-only-ok');
    expect(content).toContain('docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md');
    expect(content).toContain('next gate decision: external-executor-live-read-only-bridge-boundary-ready');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('documents every initial capability row and keeps import controlled', () => {
    const content = read(DOC);

    ROW_KINDS.forEach((rowKind) => {
      expect(content).toContain(`\`${rowKind}\``);
    });
    expect(content).toContain('| `command-http-capabilities` | command/http inventory only | available | blocked | blocked |');
    expect(content).toContain('| `session-history-capabilities` | session/history content not read | unavailable | unavailable | blocked |');
  });

  it('exports the Zavorth-owned real snapshot normalizer', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalExecutorRealCapabilitySnapshotReadOnly/v1');
    expect(boundary).toContain('normalizeExternalExecutorRealCapabilitySnapshotReadOnly');
    expect(boundary).toContain('createExternalExecutorRealCapabilitySnapshotReadOnlyFixtureSource');
    expect(index).toContain("from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js'");
    expect(index).toContain('ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization');
  });

  it('normalizes captured real evidence into Zavorth-native inventory', () => {
    const source = createExternalExecutorRealCapabilitySnapshotReadOnlyFixtureSource();
    const normalized = normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture();

    expect(source.authenticatedHealthDecision).toBe('authenticated-health-ok');
    expect(source.gateway.cleanupConfirmed).toBe(true);
    expect(source.readOnlySafeguards).toEqual({
      tokenPrinted: false,
      tokenSerialized: false,
      commandArgTokenUsed: false,
      urlOverrideUsed: false,
      channelsSkipped: true,
      providersSkipped: true,
      bonjourDisabled: true,
      executionAuthority: false,
    });
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorRealCapabilitySnapshotReadOnly/v1',
      decision: 'real-capability-snapshot-read-only-ok',
      liveEvidenceCaptured: true,
      readOnly: true,
      executionAuthority: false,
      rawSecretSerialized: false,
      commandArgTokenUsed: false,
      urlOverrideUsed: false,
      gatewayStartedEphemeral: true,
      cleanupConfirmed: true,
      sourceIdsEvidenceOnly: true,
    }));
    expect(normalized.capabilityInventory.inventory.map((row) => row.rowKind)).toEqual(ROW_KINDS);
    normalized.capabilityInventory.inventory.forEach((row) => {
      expect(row.executionAuthority).toBe(false);
      expect(row.sourceIdsEvidenceOnly).toBe(true);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.sourceHandlerLoaded).toBe(false);
      expect(row.providerSdkLoaded).toBe(false);
      expect(row.sessionImportAuthorized).toBe(false);
    });
    expect(normalized.capabilityImportClassification.importAuthorized).toBe(false);
    expect(normalized.capabilityImportClassification.dangerousCapabilitiesBlockedOrApprovalGated).toBe(true);
    expect(normalized.commandCenterProjection.executableControlsExposed).toBe(false);
    expect(normalized.commandCenterProjection.providerExecutionControlsExposed).toBe(false);
    expect(normalized.commandCenterProjection.commandExecutionControlsExposed).toBe(false);
    expect(normalized.commandCenterProjection.sessionImportControlsExposed).toBe(false);
    expect(JSON.stringify(normalized)).not.toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN');
  });

  it('keeps dangerous and unavailable rows blocked while preserving degraded states', () => {
    const normalized = normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture();
    const rows = normalized.capabilityInventory.inventory;

    expect(rows.find((row) => row.rowKind === 'command-http-capabilities')).toEqual(expect.objectContaining({
      importClassification: 'blocked',
      policy: 'blocked',
      executionAuthority: false,
    }));
    expect(rows.find((row) => row.rowKind === 'session-history-capabilities')).toEqual(expect.objectContaining({
      availability: 'unavailable',
      importClassification: 'unavailable',
      policy: 'blocked',
    }));
    expect(rows.find((row) => row.rowKind === 'provider-capabilities')).toEqual(expect.objectContaining({
      availability: 'degraded',
      importClassification: 'degraded',
      policy: 'approval-required',
    }));
    expect(normalized.degradedUnavailableStateHandling.preservedHonestly).toBe(true);
    expect(normalized.degradedUnavailableStateHandling.unavailableNotPromotedToReady).toBe(true);
  });
});
