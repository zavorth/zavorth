import fs from 'node:fs';
import path from 'node:path';

import {
  buildCommandCenterNativeFirstRuntimeProjection,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeRegistryConsumerExpansionPackFixture,
  evaluateZavorthNativeRegistryConsumerStaticGuard,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryConsumerStaticGuardFile,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/205-wave-3-native-registry-consumer-expansion-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PUBLIC_SURFACE_DOC = 'docs/204-wave-3-native-absorption-public-surface-hardening-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryConsumerExpansionPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const CONTROLLED_DRY_RUN_PLANNER =
  'src/runtime/external-agents/ExternalAgentControlledDryRunActionPlanner.ts';
const POLICY_PREFLIGHT_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts';
const OBSERVABILITY_PROJECTION_BOUNDARY =
  'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts';
const RUNTIME_READINESS_PROJECTION =
  'src/runtime/external-agents/ExternalAgentLiveReadinessAssimilationPack.ts';
const GATEWAY_SURFACE_CONFORMANCE =
  'src/services/GatewaySurfaceConformanceService.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function staticGuardFiles(): ZavorthNativeRegistryConsumerStaticGuardFile[] {
  return [
    {
      path: CONTROLLED_DRY_RUN_PLANNER,
      content: read(CONTROLLED_DRY_RUN_PLANNER),
      defaultConsumer: true,
    },
    {
      path: POLICY_PREFLIGHT_BOUNDARY,
      content: read(POLICY_PREFLIGHT_BOUNDARY),
      defaultConsumer: true,
    },
    {
      path: OBSERVABILITY_PROJECTION_BOUNDARY,
      content: read(OBSERVABILITY_PROJECTION_BOUNDARY),
      defaultConsumer: true,
    },
    {
      path: RUNTIME_READINESS_PROJECTION,
      content: read(RUNTIME_READINESS_PROJECTION),
      defaultConsumer: false,
    },
    {
      path: GATEWAY_SURFACE_CONFORMANCE,
      content: read(GATEWAY_SURFACE_CONFORMANCE),
      defaultConsumer: false,
    },
  ];
}

let cachedPack: ReturnType<typeof createZavorthNativeRegistryConsumerExpansionPackFixture> | undefined;
let cachedCapabilityRegistry: ReturnType<typeof createZavorthNativeCapabilityRegistryFixture> | undefined;
let cachedCommandCenter: ReturnType<typeof buildCommandCenterNativeFirstRuntimeProjection> | undefined;

function packFixture(): ReturnType<typeof createZavorthNativeRegistryConsumerExpansionPackFixture> {
  cachedPack ??= createZavorthNativeRegistryConsumerExpansionPackFixture(staticGuardFiles());
  return cachedPack;
}

function capabilityRegistryFixture(): ReturnType<typeof createZavorthNativeCapabilityRegistryFixture> {
  cachedCapabilityRegistry ??= createZavorthNativeCapabilityRegistryFixture();
  return cachedCapabilityRegistry;
}

function commandCenterFixture(): ReturnType<typeof buildCommandCenterNativeFirstRuntimeProjection> {
  cachedCommandCenter ??= buildCommandCenterNativeFirstRuntimeProjection();
  return cachedCommandCenter;
}

describe('Wave 3 native registry consumer expansion pack', () => {
  it('documents 205 as a single native registry consumer expansion pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-consumer-expansion-ready');
    expect(content).toContain('ZavorthNativeRegistryConsumerExpansionPack.ts');
    expect(content).toContain('ZavorthNativeRegistryConsumerExpansionPack/v1');
    expect(content).toContain('ZavorthNativeRegistryExpandedConsumerIntegration/v1');
    expect(content).toContain('ZavorthNativeRegistryConsumerStaticGuard/v1');
    expect(content).toContain('nativeRegistryConsumerExpansionPackCreated=true');
    expect(content).toContain('additionalNativeFirstConsumersIntegrated=true');
    expect(content).toContain('minimumAdditionalConsumers=2');
    expect(content).toContain('adapterDefaultPathForExpandedConsumers=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForExpandedConsumerLookup=false');
    expect(content).toContain('Adapter decommission readiness follow-up:');
    expect(content).toContain('docs/206-wave-3-adapter-decommission-readiness-pack.md');
    expect(content).toContain('Do not advance beyond the adapter decommission readiness pack');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous public surface hardening pack for 205', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/205-wave-3-native-registry-consumer-expansion-pack.md');
    expect(read(PAUSE_DOC)).toContain('`205` is the native registry consumer expansion pack');
    expect(read(PUBLIC_SURFACE_DOC)).toContain('Native registry consumer expansion follow-up:');
    expect(read(PUBLIC_SURFACE_DOC)).toContain('docs/205-wave-3-native-registry-consumer-expansion-pack.md');
    expect(read(PUBLIC_SURFACE_DOC)).toContain('Do not advance beyond the native registry consumer expansion pack');
  });

  it('exports the consumer expansion boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryConsumerExpansionPack/v1');
    expect(boundary).toContain('ZavorthNativeRegistryExpandedConsumerIntegration/v1');
    expect(boundary).toContain('ZavorthNativeRegistryConsumerStaticGuard/v1');
    expect(index).toContain("from './ZavorthNativeRegistryConsumerExpansionPack.js'");
    expect(index).toContain('ZavorthNativeRegistryConsumerExpansionNormalization');
  });

  it('integrates at least two internal consumers beyond Command Center on native registries by default', () => {
    const pack = packFixture();
    const integratedConsumers = pack.integratedNativeFirstConsumers();

    expect(pack.normalization.decision).toBe('native-registry-consumer-expansion-ready');
    expect(integratedConsumers.length).toBeGreaterThanOrEqual(2);
    expect(integratedConsumers.map((consumer) => consumer.consumerId)).toEqual(expect.arrayContaining([
      'controlled-dry-run-action-planner',
      'command-http-policy-preflight',
      'command-http-observability-projection',
    ]));
    integratedConsumers.forEach((consumer) => {
      expect(consumer.nativeRegistryDefault).toBe(true);
      expect(consumer.nativeRegistryRecordsConsumed).toBeGreaterThan(0);
      expect(consumer.adapterCalledForDefaultLookup).toBe(false);
      expect(consumer.adapterDefaultPathForExpandedConsumers).toBe(false);
      expect(consumer.runtimeExternalExecutorRequiredForExpandedConsumerLookup).toBe(false);
      expect(consumer.fallbackAdapterExplicitOnly).toBe(true);
      expect(consumer.executionAuthority).toBe(false);
      expect(consumer.rawSecretSerialized).toBe(false);
    });
  });

  it('lets policy/planner consumers classify capabilities from Zavorth native registry inputs', () => {
    const pack = packFixture();
    const registry = capabilityRegistryFixture();
    const plannerInputs = registry.toPlannerInputs();
    const classifications = new Set(plannerInputs.map((input) => input.classification));

    expect(plannerInputs.length).toBeGreaterThan(0);
    expect(classifications.size).toBeGreaterThan(1);
    expect(pack.lookupConsumer('controlled-dry-run-action-planner')).toEqual(expect.objectContaining({
      policyPlannerClassifiesCapabilitiesUsingRegistry: true,
      consumedRegistryKinds: ['capability-registry'],
      adapterCalledForDefaultLookup: false,
    }));
    expect(pack.lookupConsumer('command-http-policy-preflight')).toEqual(expect.objectContaining({
      policyPlannerClassifiesCapabilitiesUsingRegistry: true,
      consumedRegistryKinds: ['capability-registry', 'config-state-registry'],
      adapterCalledForDefaultLookup: false,
    }));
  });

  it('lets observability consume integration/session/config native metadata without adapter default', () => {
    const pack = packFixture();
    const observability = pack.lookupConsumer('command-http-observability-projection');

    expect(observability).toEqual(expect.objectContaining({
      observabilityConsumesNativeMetadata: true,
      consumedRegistryKinds: ['integration-registry', 'session-history-registry', 'config-state-registry'],
      adapterCalledForDefaultLookup: false,
      adapterDefaultPathForExpandedConsumers: false,
      runtimeExternalExecutorRequiredForExpandedConsumerLookup: false,
    }));
    expect(observability?.nativeRegistryRecordsConsumed).toBeGreaterThan(0);
  });

  it('passes static guard for expanded consumers and catches default adapter regressions', () => {
    const pack = packFixture();
    const regression = evaluateZavorthNativeRegistryConsumerStaticGuard([
      {
        path: 'src/runtime/external-agents/regressionConsumer.ts',
        defaultConsumer: true,
        content: [
          "import { FixtureExternalAgentAdapter } from './FixtureExternalAgentAdapter';",
          'const regression = {',
          '  adapterCalledForDefaultLookup: true,',
          '  externalSourceLiveCalledForDefaultPath: true,',
          "  source: 'external-executor-live-adapter',",
          "  label: 'ExternalExecutor Adapter',",
          '};',
        ].join('\n'),
      },
    ]);

    expect(pack.adapterDefaultGuardPassed()).toBe(true);
    expect(pack.normalization.staticGuard.passed).toBe(true);
    expect(pack.normalization.staticGuard.findings).toHaveLength(0);
    expect(regression.passed).toBe(false);
    expect(regression.findings.map((finding) => finding.pattern)).toEqual(expect.arrayContaining([
      'FixtureExternalAgentAdapter default import',
      'default adapter call true',
      'live source runtime default path true',
      'public external-executor source',
      'public ExternalExecutor label',
    ]));
  });

  it('keeps Command Center native-first while expansion consumers avoid adapter defaults', () => {
    const pack = packFixture();
    const commandCenter = commandCenterFixture();

    expect(commandCenter.policy.commandCenterDefaultAdapterCall).toBe(false);
    expect(commandCenter.policy.externalSourceRequiredForCommandCenterRender).toBe(false);
    expect(commandCenter.policy.externalSourceRequiredForCommandCenterLookup).toBe(false);
    expect(commandCenter.nativeRegistryConsumer.adapterFallbackExplicitOnly).toBe(true);
    expect(pack.normalization.adapterPolicy).toEqual(expect.objectContaining({
      adapterRefreshAllowed: true,
      adapterReconciliationAllowed: true,
      adapterFallbackRequiresExplicitMode: true,
      adapterDefaultPathForExpandedConsumers: false,
      adapterRemovalGlobalAllowed: false,
    }));
  });

  it('does not grant execution, external mutation, state migration, source copy, or raw secret serialization', () => {
    const pack = packFixture();
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.executionGate).toEqual({
      nativeRegistryConsumerExpansionPackCreated: true,
      additionalNativeFirstConsumersIntegrated: true,
      minimumAdditionalConsumers: 2,
      adapterDefaultPathForExpandedConsumers: false,
      runtimeExternalExecutorRequiredForExpandedConsumerLookup: false,
      adapterRefreshAllowed: true,
      adapterRemovalGlobalAllowed: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      externalMutationActuallyPerformed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toContain('<redacted-local-secret>');
  });
});
