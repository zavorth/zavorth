import fs from 'node:fs';
import path from 'node:path';

import {
  buildZavorthControlZavorthControlViewModel,
} from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/index.js';
import {
  ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
  buildZavorthControlNativeFirstRuntimeProjection,
  createZavorthControlNativeFirstConsumerIntegrationFixtureSource,
} from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/index.js';

const PAUSE_DOC = 'docs/external-executor-secret-provisioning.md';
const PROJECTION = 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.ts';
const PROJECTION_INDEX = 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/index.ts';
const ZAVORTH_CONTROL_INDEX = 'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ZavorthControl native-first consumer integration', () => {
  it('documents the native-first external executor secret posture in product docs', () => {
    const content = read(PAUSE_DOC);

    expect(content).toContain('Zavorth does not migrate or expose raw secrets');
    expect(content).toContain('SecretRef');
    expect(content).toContain('every live invocation produces a receipt');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the native-first projection consumer from the ZavorthControl package', () => {
    expect(read(PROJECTION)).toContain('ZavorthControlNativeFirstConsumerIntegration/v1');
    expect(read(PROJECTION)).toContain('buildZavorthControlNativeFirstRuntimeProjection');
    expect(read(PROJECTION_INDEX)).toContain('buildZavorthControlNativeFirstRuntimeProjection');
    expect(read(ZAVORTH_CONTROL_INDEX)).toContain('buildZavorthControlNativeFirstRuntimeProjection');
  });

  it('builds a ZavorthControl runtime projection from native registries by default', () => {
    const source = createZavorthControlNativeFirstConsumerIntegrationFixtureSource();
    const result = buildZavorthControlNativeFirstRuntimeProjection(source);

    expect(source.adapterCalledForDefaultLookup).toBe(false);
    expect(source.adapterCalledForDefaultRender).toBe(false);
    expect(source.externalSourceLiveCalledForDefaultPath).toBe(false);
    expect(result.nativeContract).toBe('ZavorthControlNativeFirstConsumerIntegration/v1');
    expect(result.projection.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      label: 'Zavorth Native Registry Projection',
      version: ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
    }));
    expect(result.projection.capabilities.length).toBeGreaterThan(0);
    expect(result.projection.integrations.length).toBeGreaterThan(0);
    expect(result.projection.sessions.length).toBeGreaterThan(0);
    expect(result.projection.messages.length).toBeGreaterThan(0);
    expect(result.projection.health?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'native-first-zavorthControl',
        status: 'ready',
      }),
      expect.objectContaining({
        id: 'native-registry-only',
        status: 'ready',
      }),
    ]));
  });

  it('keeps adapter refresh explicit and outside the default render/lookup path', () => {
    const result = buildZavorthControlNativeFirstRuntimeProjection();

    expect(result.policy).toEqual({
      zavorthControlNativeFirstEnabled: true,
      zavorthControlDefaultAdapterCall: false,
      externalSourceRequiredForZavorthControlRender: false,
      externalSourceRequiredForZavorthControlLookup: false,
      adapterRefreshAllowed: false,
      adapterRemovalAllowed: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(result.nativeRegistryConsumer).toEqual({
      capabilityCardsFromNativeRegistry: true,
      zavorthControlViewsFromNativeRegistry: true,
      integrationMetadataFromNativeRegistry: true,
      sessionHistoryMetadataFromNativeRegistry: true,
      configStateMetadataFromNativeRegistry: true,
      adapterFallbackExplicitOnly: true,
    });
    expect(result.projection.runtimeWarnings).toEqual([]);
  });

  it('renders the zavorthControl view model without public ExternalExecutor identity', () => {
    const result = buildZavorthControlNativeFirstRuntimeProjection();
    const viewModel = buildZavorthControlZavorthControlViewModel(result.adapterInput);
    const serializedViewModel = JSON.stringify(viewModel);

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      label: 'Zavorth Native Registry Projection',
    }));
    expect(viewModel.runtime.status).toBe('ready');
    expect(viewModel.toolExposure.tools.length).toBeGreaterThan(0);
    expect(viewModel.integrations.length).toBeGreaterThan(0);
    expect(viewModel.sessions.length).toBeGreaterThan(0);
    expect(viewModel.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringMatching(/^\[(redacted-content|unavailable)\]$/),
      }),
    ]));
    expect(serializedViewModel).not.toContain('ExternalExecutor');
    expect(serializedViewModel).not.toContain('external_executor');
    expect(serializedViewModel).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serializedViewModel).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });

  it('preserves degraded and unavailable registry states as renderable zavorthControl rows', () => {
    const result = buildZavorthControlNativeFirstRuntimeProjection();
    const viewModel = buildZavorthControlZavorthControlViewModel(result.adapterInput);

    expect(result.projection.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: expect.stringMatching(/^(error|status)$/),
      }),
    ]));
    expect(viewModel.health.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'native-registry-only',
        status: 'ready',
      }),
      expect.objectContaining({
        id: 'zavorthControl-registry-degraded-rows',
        status: 'degraded',
      }),
    ]));
    expect(viewModel.runtime.blockers).toEqual([]);
  });

  it('does not perform execution, migration, source copy, or raw secret serialization', () => {
    const result = buildZavorthControlNativeFirstRuntimeProjection();
    const serialized = JSON.stringify(result);

    expect(result.policy.executionAuthority).toBe(false);
    expect(result.policy.messageActuallySent).toBe(false);
    expect(result.policy.providerActuallyExecuted).toBe(false);
    expect(result.policy.commandActuallyExecuted).toBe(false);
    expect(result.policy.toolActuallyExecuted).toBe(false);
    expect(result.policy.stateMigrated).toBe(false);
    expect(result.policy.sourceModuleCopied).toBe(false);
    expect(result.policy.rawSecretSerialized).toBe(false);
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });
});
