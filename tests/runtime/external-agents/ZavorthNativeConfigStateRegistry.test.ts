import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeConfigStateRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeConfigStateRegistryFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/189-wave-3-config-secrets-state-native-registry.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const STRATEGY_DOC = 'docs/162-wave-0-external-agent-config-state-migration-strategy.md';
const INVENTORY_DOC = 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md';
const MAPPING_DOC = 'docs/164-wave-1-redaction-and-secretref-mapping.md';
const DRY_RUN_DOC = 'docs/165-wave-1-dry-run-migration-plan.md';
const ROLLBACK_DOC = 'docs/166-wave-1-rollback-restore-rehearsal.md';
const SESSION_REGISTRY_DOC = 'docs/188-wave-3-session-history-native-registry.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeConfigStateRegistry.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native config/state registry', () => {
  it('documents 189 as the config/secrets/state native registry slice', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-config-state-registry-ready');
    expect(content).toContain('ZavorthNativeConfigStateRegistry/v1');
    expect(content).toContain('ZavorthNativeConfigStateRecord/v1');
    expect(content).toContain('ZavorthNativeConfigStateSecretRefMetadata/v1');
    expect(content).toContain('docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md');
    expect(content).toContain('docs/162-wave-0-external-agent-config-state-migration-strategy.md');
    expect(content).toContain('docs/163-wave-1-external-agent-config-state-read-only-inventory.md');
    expect(content).toContain('docs/164-wave-1-redaction-and-secretref-mapping.md');
    expect(content).toContain('docs/165-wave-1-dry-run-migration-plan.md');
    expect(content).toContain('docs/166-wave-1-rollback-restore-rehearsal.md');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(content).toContain('docs/188-wave-3-session-history-native-registry.md');
    expect(content).toContain('runtimeExternalExecutorRequiredForConfigLookup: false');
    expect(content).toContain('runtimeExternalExecutorRequiredForSecretMetadataLookup: false');
    expect(content).toContain('nativeReplacementAuthorizedForConfigStateMetadata: true');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs for the config/state registry closure', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(read(PAUSE_DOC)).toContain('`189` is the native config/secrets/state metadata registry slice');
    expect(read(STRATEGY_DOC)).toContain('native registry follow-up: docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(read(INVENTORY_DOC)).toContain('native registry follow-up: docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(read(MAPPING_DOC)).toContain('native registry follow-up: docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(read(DRY_RUN_DOC)).toContain('native registry follow-up: docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(read(ROLLBACK_DOC)).toContain('native registry follow-up: docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(read(SESSION_REGISTRY_DOC)).toContain('config/state registry follow-up: docs/189-wave-3-config-secrets-state-native-registry.md');
  });

  it('exports the config/state registry boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeConfigStateRegistry/v1');
    expect(boundary).toContain('ZavorthNativeConfigStateRegistrySlice/v1');
    expect(boundary).toContain('normalizeZavorthNativeConfigStateRegistry');
    expect(index).toContain("from './ZavorthNativeConfigStateRegistry.js'");
    expect(index).toContain('ZavorthNativeConfigStateRegistryNormalization');
  });

  it('normalizes inventory and mapping metadata into Zavorth-native records', () => {
    const normalized = normalizeZavorthNativeConfigStateRegistryFixture();

    expect(normalized.decision).toBe('native-config-state-registry-ready');
    expect(normalized.sourceReadiness).toEqual({
      secretRefResolverBoundary: 'ExternalAgentSecretResolutionEnvelope/v1',
      configStateMigrationStrategy: 'design-only-no-migration',
      configStateReadOnlyInventory: 'read-only-inventory-no-migration',
      redactionSecretRefMapping: 'redaction-secretref-mapping-no-migration',
      dryRunMigrationPlan: 'dry-run-plan-no-migration',
      rollbackRestoreRehearsal: 'rollback-restore-rehearsal-no-mutation',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      dashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
      nativeIntegrationRegistry: 'native-integration-registry-ready',
      nativeSessionHistoryRegistry: 'native-session-history-registry-ready',
    });
    expect(normalized.registry.sourceArtifactsConsumed).toEqual({
      secretRefResolverBoundary: 'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md',
      configStateMigrationStrategy: 'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
      configStateReadOnlyInventory: 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
      redactionSecretRefMapping: 'docs/164-wave-1-redaction-and-secretref-mapping.md',
      dryRunMigrationPlan: 'docs/165-wave-1-dry-run-migration-plan.md',
      rollbackRestoreRehearsal: 'docs/166-wave-1-rollback-restore-rehearsal.md',
      nativeCapabilityRegistry: 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md',
      dashboardViewModelRegistry: 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md',
      integrationRegistry: 'docs/187-wave-3-provider-channel-transport-native-registry.md',
      sessionHistoryRegistry: 'docs/188-wave-3-session-history-native-registry.md',
    });
    expect(normalized.registry.records.length).toBeGreaterThanOrEqual(12);
  });

  it('covers all required config/state categories and classification indexes', () => {
    const normalized = normalizeZavorthNativeConfigStateRegistryFixture();
    const categories = new Set(normalized.registry.records.map((record) => record.category));

    expect(Array.from(categories)).toEqual(expect.arrayContaining([
      'config-file',
      'secret-ref',
      'provider-credentials',
      'channel-credentials',
      'device-node-identity',
      'plugin-config',
      'cache',
      'logs',
      'workspace',
      'sqlite-store',
      'backup-rollback',
    ]));
    expect(normalized.registry.indexes.byRisk.critical).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byRisk.high).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byMigrationEligibility.deferred).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byMigrationEligibility.rejected).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byRollbackAvailability.required).toBeGreaterThan(0);
    expect(normalized.registry.indexes.degradedOrUnavailableIds.length).toBeGreaterThan(0);
  });

  it('supports lookup, list, and filter without live ExternalExecutor or raw secrets', () => {
    const registry = createZavorthNativeConfigStateRegistryFixture();
    const config = registry.list({ category: 'config-file' })[0];
    const critical = registry.list({ risk: 'critical' });
    const deferred = registry.list({ migrationEligibility: 'deferred' });
    const rollbackRequired = registry.list({ rollbackAvailability: 'required' });
    const secretRefRecords = registry.list({ requiresSecretRef: true });
    const degradedOrUnavailable = registry.list({ degradedOrUnavailable: true });
    const lookup = registry.lookup(config.id);

    expect(lookup).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForConfigLookup: false,
      runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
      sourceRuntimeAuthority: false,
    }));
    expect(critical.length).toBeGreaterThan(0);
    expect(deferred.length).toBeGreaterThan(0);
    expect(rollbackRequired.length).toBeGreaterThan(0);
    expect(secretRefRecords.length).toBeGreaterThan(0);
    expect(degradedOrUnavailable.length).toBeGreaterThan(0);
    expect(registry.lookup('missing-config-state-record').found).toBe(false);
  });

  it('preserves SecretRefs without raw values', () => {
    const normalized = normalizeZavorthNativeConfigStateRegistryFixture();
    const secretRefRecords = normalized.registry.records.filter((record) => record.secretRefs.length > 0);
    const secretRefNames = new Set(secretRefRecords.flatMap((record) => record.secretRefs.map((secretRef) => secretRef.name)));

    expect(Array.from(secretRefNames)).toEqual(expect.arrayContaining([
      'external-executor-gateway-token',
      'external-executor-provider-api-key',
      'external-executor-channel-telegram-token',
      'external-executor-channel-discord-token',
      'external-executor-device-node-token',
      'external-executor-plugin-service-credential',
    ]));
    secretRefRecords.forEach((record) => {
      expect(record.secretRawValueRead).toBe(false);
      expect(record.secretRawValueSerialized).toBe(false);
      record.secretRefs.forEach((secretRef) => {
        expect(secretRef.nativeContract).toBe('ZavorthNativeConfigStateSecretRefMetadata/v1');
        expect(secretRef.rawValueRead).toBe(false);
        expect(secretRef.rawValueSerialized).toBe(false);
        expect(JSON.stringify(secretRef)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
      });
    });
    expect(JSON.stringify(normalized)).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });

  it('cross-references capability, integration, and session registries', () => {
    const normalized = normalizeZavorthNativeConfigStateRegistryFixture();
    const capabilityRegistry = createZavorthNativeCapabilityRegistryFixture();
    const integrationRegistry = createZavorthNativeIntegrationRegistryFixture();
    const sessionRegistry = createZavorthNativeSessionHistoryRegistryFixture();

    normalized.registry.records.forEach((record) => {
      record.capabilityRegistryEntryIds.forEach((entryId) => {
        expect(capabilityRegistry.lookup(entryId).found).toBe(true);
      });
      record.integrationRegistryRecordIds.forEach((integrationId) => {
        expect(integrationRegistry.lookup(integrationId).found).toBe(true);
      });
      record.sessionRegistryRecordIds.forEach((sessionId) => {
        expect(sessionRegistry.lookupSession(sessionId).found).toBe(true);
      });
    });
    expect(normalized.registry.records.some((record) => record.integrationRegistryRecordIds.length > 0)).toBe(true);
    expect(normalized.registry.records.some((record) => record.sessionRegistryRecordIds.length > 0)).toBe(true);
    expect(normalized.integration).toEqual(expect.objectContaining({
      capabilityRegistryCrossReferenceReady: true,
      integrationRegistryCrossReferenceReady: true,
      sessionRegistryCrossReferenceReady: true,
      dashboardProjectionReady: true,
      migrationDryRunOnly: true,
      rollbackMetadataPreserved: true,
      secretRefsMetadataOnly: true,
    }));
  });

  it('projects dashboard rows without exposing public source identity', () => {
    const registry = createZavorthNativeConfigStateRegistryFixture();
    const projections = registry.toDashboardProjection();
    const serializedPublicProjection = JSON.stringify(projections);

    expect(projections).toHaveLength(registry.list().length);
    projections.forEach((projection) => {
      expect(projection.nativeContract).toBe('ZavorthNativeConfigStateDashboardProjection/v1');
      expect(projection.commandCenterConsumable).toBe(true);
      expect(projection.sourceIdentityPublic).toBe(false);
      expect(projection.secretRawValueSerialized).toBe(false);
      expect(projection.executionAuthority).toBe(false);
      expect(projection.label).not.toContain('ExternalExecutor');
    });
    expect(serializedPublicProjection).not.toContain('ExternalExecutor');
    expect(serializedPublicProjection).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('keeps provenance internal, redacted, and evidence-only', () => {
    const normalized = normalizeZavorthNativeConfigStateRegistryFixture();

    normalized.registry.records.forEach((record) => {
      expect(record.provenance).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeConfigStateProvenance/v1',
        sourceRuntimeNameInternal: 'ExternalExecutor',
        sourceRuntimePublicIdentity: false,
        sourceStructuresPublic: false,
        sourceIdsEvidenceOnly: true,
        sourcePathsEvidenceOnly: true,
        redacted: true,
      }));
      expect(record.runtimeExternalExecutorRequiredForConfigLookup).toBe(false);
      expect(record.runtimeExternalExecutorRequiredForSecretMetadataLookup).toBe(false);
      expect(record.sourceRuntimeAuthority).toBe(false);
      expect(record.secretRawValueRead).toBe(false);
      expect(record.secretRawValueSerialized).toBe(false);
    });
    expect(JSON.stringify(normalized)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(JSON.stringify(normalized)).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('keeps migration, copy, DB, write-back, execution, and adapter gates closed', () => {
    const normalized = normalizeZavorthNativeConfigStateRegistryFixture();

    expect(normalized.executionGate).toEqual({
      runtimeExternalExecutorRequiredForConfigLookup: false,
      runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
      sourceRuntimeAuthority: false,
      secretRawValueRead: false,
      secretRawValueSerialized: false,
      configMigrated: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      writeBackAllowed: false,
      migrationAllowed: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorizedForConfigStateMetadata: true,
      adapterRemovalAllowed: false,
    });
    expect(normalized.registry).toEqual(expect.objectContaining({
      runtimeExternalExecutorRequiredForConfigLookup: false,
      runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
      sourceRuntimeAuthority: false,
      secretRawValueRead: false,
      secretRawValueSerialized: false,
      configMigrated: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      writeBackAllowed: false,
      migrationAllowed: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorizedForConfigStateMetadata: true,
      adapterRemovalAllowed: false,
    }));
    expect(normalized.dependencyReductionProof).toEqual({
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      secretMetadataLookupWorksWithoutRawSecret: true,
      capabilityRegistryCrossReferenceWorks: true,
      integrationRegistryCrossReferenceWorks: true,
      sessionRegistryCrossReferenceWorks: true,
    });
    expect(normalized.redaction).toEqual({
      secretRawValueRead: false,
      secretRawValueSerialized: false,
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      sourcePathsEvidenceOnly: true,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-config-state-native-refresh-or-controlled-migration-dry-run-gate');
  });
});
