import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeNativeAbsorptionTargetSelectionFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/184-wave-3-native-absorption-target-selection.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentNativeAbsorptionTargetSelection.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('native absorption target selection', () => {
  it('documents 184 as a route change from live dispatch to native absorption', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-absorption-target-selected');
    expect(content).toContain('Stop live action/message dispatch as priority');
    expect(content).toContain('First target: dashboard view models');
    expect(content).toContain('Second likely target: capability/plugin registry');
    expect(content).toContain('docs/185-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('sourceModuleCopied: false');
    expect(content).toContain('adapterRemovedBeforeReplacement: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the target selection boundary and public contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeAbsorptionTargetSelection/v1');
    expect(boundary).toContain('ZavorthNativeReplacementInitialSlice/v1');
    expect(boundary).toContain('normalizeNativeAbsorptionTargetSelection');
    expect(index).toContain("from './ExternalAgentNativeAbsorptionTargetSelection.js'");
    expect(index).toContain('ZavorthNativeAbsorptionTargetSelectionNormalization');
  });

  it('selects dashboard view models first and capability/plugin registry second', () => {
    const normalized = normalizeNativeAbsorptionTargetSelectionFixture();

    expect(normalized.decision).toBe('native-absorption-target-selected');
    expect(normalized.firstTarget).toEqual(expect.objectContaining({
      id: 'dashboard-view-models',
      decision: 'first-target',
      risk: 'low',
      reducesExternalRuntimeDependency: true,
      sideEffectRiskLow: true,
      requiresRealMutation: false,
      requiresProviderExecution: false,
      requiresMessageExecution: false,
      preparesAdapterRemoval: true,
    }));
    expect(normalized.secondLikelyTarget).toEqual(expect.objectContaining({
      id: 'capability-plugin-registry',
      decision: 'second-target',
      risk: 'low',
    }));
  });

  it('evaluates all requested candidates with safety criteria', () => {
    const normalized = normalizeNativeAbsorptionTargetSelectionFixture();
    const ids = normalized.candidates.map((candidate) => candidate.id).sort();

    expect(ids).toEqual([
      'capability-plugin-registry',
      'channel-metadata-registry',
      'command-http-surfaces',
      'config-secrets-mapping',
      'dashboard-view-models',
      'message-transport-registry',
      'provider-metadata-registry',
      'session-history-metadata-registry',
    ]);
    normalized.candidates.forEach((candidate) => {
      expect(candidate.canBecomeZavorthOwnedWithoutModuleCopy).toBe(true);
      expect(candidate.sourceModulesCopied).toBeUndefined();
      expect(candidate.evidenceDocs.length).toBeGreaterThan(0);
      expect(candidate.requiresRealMutation).toBe(false);
      expect(candidate.requiresProviderExecution).toBe(false);
      expect(candidate.requiresMessageExecution).toBe(false);
    });
  });

  it('defines the native replacement slice and dependency reduction proof', () => {
    const normalized = normalizeNativeAbsorptionTargetSelectionFixture();

    expect(normalized.initialSlice).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeReplacementInitialSlice/v1',
      id: 'dashboard-view-model-registry-native-slice',
      selectedTarget: 'dashboard-view-models',
      secondLikelyTarget: 'capability-plugin-registry',
      adapterRemovalBlockedUntilParity: true,
      sourceModulesCopied: false,
      realMutationRequired: false,
      providerExecutionRequired: false,
      messageExecutionRequired: false,
      publicIdentityZavorthNative: true,
    }));
    expect(normalized.initialSlice.zavorthOwnedContracts).toEqual(expect.arrayContaining([
      'ZavorthCommandCenterLiveAssimilationViewModel/v1',
      'ZavorthNativeAbsorptionDashboardViewRegistry/v1',
    ]));
    expect(normalized.initialSlice.sourceRuntimeNoLongerRequiredFor).toEqual(expect.arrayContaining([
      'Rendering Command Center public view models from latest normalized snapshot',
    ]));
    expect(normalized.initialSlice.dependencyReductionProof).toEqual(expect.arrayContaining([
      'Unit test builds registry from existing normalized fixtures without starting ExternalExecutor',
      'No adapter call is needed to render dashboard view model rows',
    ]));
  });

  it('uses 156-183 evidence readiness without authorizing live dispatch', () => {
    const normalized = normalizeNativeAbsorptionTargetSelectionFixture();

    expect(normalized.evidenceReadiness).toEqual({
      authenticatedHealth: 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md',
      realCapabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      liveReadOnlyBridge: 'external-executor-live-read-only-bridge-boundary-ready',
      commandCenterAssimilation: 'command-center-live-assimilation-ready',
      transportDiscovery: 'real-message-transport-capability-discovery-ready',
      configStateStrategy: 'docs/162-167 design/dry-run gates closed',
    });
    expect(normalized.routeChange).toEqual({
      nativeContract: 'ZavorthNativeAbsorptionRouteChange/v1',
      stopLiveActionDispatchPriority: true,
      stopLiveMessageDispatchPriority: true,
      nextRoute: 'native-absorption',
      liveDispatchGatesRemainAsEvidence: true,
      adapterRemovalAuthorized: false,
      rawSecretSerialized: false,
    });
  });

  it('keeps no-copy, no-rename-only, no-adapter-removal, and no-public-source-identity gates closed', () => {
    const normalized = normalizeNativeAbsorptionTargetSelectionFixture();
    const serialized = JSON.stringify(normalized);

    expect(normalized.executionGate).toEqual({
      nativeAbsorptionRouteSelected: true,
      liveActionDispatchPriorityStopped: true,
      liveMessageDispatchPriorityStopped: true,
      targetSelected: true,
      sourceModuleCopied: false,
      superficialRenameOnly: false,
      adapterRemovedBeforeReplacement: false,
      realStateMigrationAuthorized: false,
      providerExecutionAuthorized: false,
      messageExecutionAuthorized: false,
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(normalized.nextGateRecommended).toBe('185-dashboard-view-model-registry-native-slice');
  });
});
