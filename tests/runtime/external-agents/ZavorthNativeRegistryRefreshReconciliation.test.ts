import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeRegistryRefreshReconciliationFixture,
  normalizeZavorthNativeRegistryRefreshReconciliationFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryRefreshMode,
  ZavorthNativeRegistryRefreshReconciliationNormalization,
  ZavorthNativeRegistryReconciliationOutcome,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/193-wave-3-native-registry-refresh-reconciliation-design.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const COMMAND_CENTER_NATIVE_FIRST_DOC = 'docs/192-wave-3-command-center-native-first-consumer-integration.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native registry refresh reconciliation', () => {
  let normalized: ZavorthNativeRegistryRefreshReconciliationNormalization;

  beforeAll(() => {
    normalized = normalizeZavorthNativeRegistryRefreshReconciliationFixture();
  });

  it('documents 193 as the native registry refresh reconciliation design boundary', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-refresh-reconciliation-ready');
    expect(content).toContain('ZavorthNativeRegistryRefreshReconciliation/v1');
    expect(content).toContain('ZavorthNativeRegistryRefreshPolicy/v1');
    expect(content).toContain('ZavorthNativeRegistryRefreshCandidate/v1');
    expect(content).toContain('ZavorthNativeRegistryRefreshReceipt/v1');
    expect(content).toContain('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(content).toContain('docs/188-wave-3-session-history-native-registry.md');
    expect(content).toContain('docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(content).toContain('docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(content).toContain('docs/191-wave-3-partial-adapter-deprecation-gate.md');
    expect(content).toContain('docs/192-wave-3-command-center-native-first-consumer-integration.md');
    expect(content).toContain('nativeFirstLookupPreserved=true');
    expect(content).toContain('registryMutationCommitted=false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior Command Center gate for 193', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/193-wave-3-native-registry-refresh-reconciliation-design.md');
    expect(read(PAUSE_DOC)).toContain('`193` is the native registry refresh/reconciliation boundary');
    expect(read(COMMAND_CENTER_NATIVE_FIRST_DOC)).toContain('native registry refresh/reconciliation follow-up: docs/193-wave-3-native-registry-refresh-reconciliation-design.md');
    expect(read(COMMAND_CENTER_NATIVE_FIRST_DOC)).toContain('Do not advance to `194`');
  });

  it('exports the refresh reconciliation boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryRefreshReconciliation/v1');
    expect(boundary).toContain('ZavorthNativeRegistryRefreshReconciliation');
    expect(boundary).toContain('normalizeZavorthNativeRegistryRefreshReconciliation');
    expect(index).toContain("from './ZavorthNativeRegistryRefreshReconciliation.js'");
    expect(index).toContain('ZavorthNativeRegistryRefreshReconciliationNormalization');
  });

  it('normalizes native registries and optional live evidence into a refresh boundary', () => {
    expect(normalized.decision).toBe('native-registry-refresh-reconciliation-ready');
    expect(normalized.sourceReadiness).toEqual({
      partialAdapterDeprecation: 'partial-adapter-deprecation-ready',
      authenticatedHealth: 'authenticated-health-ok',
      optionalCapabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      nativeDashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
      nativeIntegrationRegistry: 'native-integration-registry-ready',
      nativeSessionHistoryRegistry: 'native-session-history-registry-ready',
      nativeConfigStateRegistry: 'native-config-state-registry-ready',
    });
  });

  it('models disabled, manual, scheduled, optional adapter, and blocked refresh modes', () => {
    const modes = normalized.refreshPolicies.map((policy) => policy.mode);

    expect(modes).toEqual(expect.arrayContaining([
      'disabled',
      'manual',
      'scheduled-future',
      'live-adapter-optional',
      'blocked',
    ] satisfies ZavorthNativeRegistryRefreshMode[]));
    normalized.refreshPolicies.forEach((policy) => {
      expect(policy.adapterCallIsDefaultPath).toBe(false);
      expect(policy.defaultLookupPathPreserved).toBe('native-registry');
      expect(policy.defaultRenderPathPreserved).toBe('native-registry');
      expect(policy.runtimeExternalExecutorRequiredForDefaultLookup).toBe(false);
      expect(policy.runtimeExternalExecutorRequiredForDefaultRender).toBe(false);
      expect(policy.commitAllowedInThisGate).toBe(false);
      expect(policy.registryMutationCommitted).toBe(false);
      expect(policy.executionAuthority).toBe(false);
      expect(policy.rawSecretSerialized).toBe(false);
    });
    expect(normalized.refreshPolicies.find((policy) => policy.mode === 'live-adapter-optional')?.adapterMayBeCalled).toBe(true);
    expect(normalized.refreshPolicies.find((policy) => policy.mode === 'disabled')?.adapterMayBeCalled).toBe(false);
  });

  it('represents updated, conflict, source-unavailable, degraded, and no-change outcomes', () => {
    const outcomes = normalized.candidates.map((candidate) => candidate.outcome);

    expect(outcomes).toEqual(expect.arrayContaining([
      'updated',
      'conflict',
      'source-unavailable',
      'degraded',
      'no-change',
    ] satisfies ZavorthNativeRegistryReconciliationOutcome[]));
    normalized.candidates.forEach((candidate) => {
      expect(candidate.registryMutationCommitted).toBe(false);
      expect(candidate.sourceRuntimeAuthority).toBe(false);
      expect(candidate.sourceIdsEvidenceOnly).toBe(true);
      expect(candidate.provenanceInternalOnly).toBe(true);
      expect(candidate.rawSecretSerialized).toBe(false);
    });
  });

  it('produces redacted dry-run refresh receipts without calling the adapter or committing registry mutation', () => {
    const reconciliation = createZavorthNativeRegistryRefreshReconciliationFixture();
    const manual = reconciliation.planRefresh('manual');
    const optional = reconciliation.planRefresh('live-adapter-optional');

    expect(manual.dryRun).toBe(true);
    expect(optional.adapterInvocationPlanned).toBe(true);
    [manual, optional].forEach((receipt) => {
      expect(receipt.adapterActuallyCalled).toBe(false);
      expect(receipt.registryMutationCommitted).toBe(false);
      expect(receipt.nativeFirstLookupPreserved).toBe(true);
      expect(receipt.nativeFirstRenderPreserved).toBe(true);
      expect(receipt.commandCenterNativeFirstPreserved).toBe(true);
      expect(receipt.runtimeExternalExecutorRequiredForDefaultLookup).toBe(false);
      expect(receipt.runtimeExternalExecutorRequiredForDefaultRender).toBe(false);
      expect(receipt.rawSecretSerialized).toBe(false);
      expect(JSON.stringify(receipt)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    });
  });

  it('keeps native lookup and render alive when the optional source is unavailable', () => {
    const reconciliation = createZavorthNativeRegistryRefreshReconciliationFixture();
    const unavailable = reconciliation.planRefresh('live-adapter-optional', {
      optionalSourceAvailable: false,
    });
    const dashboardRegistry = createZavorthNativeDashboardViewModelRegistryFixture();
    const render = dashboardRegistry.render();

    expect(unavailable.outcome).toBe('source-unavailable');
    expect(unavailable.optionalSourceAvailable).toBe(false);
    expect(unavailable.adapterActuallyCalled).toBe(false);
    expect(unavailable.nativeFirstLookupPreserved).toBe(true);
    expect(unavailable.nativeFirstRenderPreserved).toBe(true);
    expect(render.rows.length).toBeGreaterThan(0);
    expect(render.runtimeExternalExecutorRequiredForDashboardRender).toBe(false);
    expect(render.runtimeExternalExecutorRequiredForDashboardViewLookup).toBe(false);
  });

  it('lets policy block refresh without changing native-first lookup or render', () => {
    const reconciliation = createZavorthNativeRegistryRefreshReconciliationFixture();
    const blockedByMode = reconciliation.planRefresh('blocked');
    const blockedByPolicy = reconciliation.planRefresh('live-adapter-optional', {
      policyAllowedAdapterRefresh: false,
    });

    [blockedByMode, blockedByPolicy].forEach((receipt) => {
      expect(receipt.outcome).toBe('rejected-by-policy');
      expect(receipt.adapterActuallyCalled).toBe(false);
      expect(receipt.registryMutationCommitted).toBe(false);
      expect(receipt.nativeFirstLookupPreserved).toBe(true);
      expect(receipt.nativeFirstRenderPreserved).toBe(true);
      expect(receipt.candidateOutcomes.every((row) => row.outcome === 'rejected-by-policy')).toBe(true);
    });
  });

  it('preserves Command Center native-first and all no-execution guarantees', () => {
    expect(normalized.commandCenterDefaultPath).toEqual({
      nativeFirstLookupPreserved: true,
      nativeFirstRenderPreserved: true,
      commandCenterNativeFirstEnabled: true,
      commandCenterDefaultAdapterCall: false,
      runtimeExternalExecutorRequiredForCommandCenterRender: false,
      runtimeExternalExecutorRequiredForCommandCenterLookup: false,
    });
    expect(normalized.executionGate).toEqual({
      nativeFirstLookupPreserved: true,
      nativeFirstRenderPreserved: true,
      refreshAdapterOptional: true,
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      registryMutationCommitted: false,
      stateMigrated: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
  });

  it('does not serialize raw secrets or authorize ExternalExecutor as required again', () => {
    const serialized = JSON.stringify(normalized);

    expect(normalized.dependencyProtection).toEqual({
      externalExecutorOptionalForRefreshOnly: true,
      externalExecutorRequiredForLookupAgain: false,
      externalExecutorRequiredForRenderAgain: false,
      adapterRemovalAllowed: false,
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    expect(normalized.nextGateRecommended).toBe('future-native-registry-refresh-commit-or-adapter-removal-parity-gate');
  });
});
