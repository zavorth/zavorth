import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeExternalExecutorLiveReadOnlyProbe,
} from '../../../src/runtime/external-agents/index.js';

const LIVE_PROBE_DOC = 'docs/151-wave-1-live-read-only-external-executor-probe.md';
const SMOKE_REPORT_DOC = 'docs/152-wave-1-live-read-only-external-executor-smoke-report.md';
const BOUNDARY_PACK_DOC = 'docs/150-wave-1-sidecar-read-only-boundary-pack.md';
const TEST_DESIGN_DOC = 'docs/149-wave-1-real-sidecar-adapter-test-design.md';
const PROBE_FILE = 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function createCapturedProbe() {
  return normalizeExternalExecutorLiveReadOnlyProbe({
    generatedAt: '2026-04-28T12:30:00.000Z',
    runtimeId: 'external-executor-live-read-only-probe-runtime',
    idPrefix: 'external-executor-live-read-only',
    commandResults: [
      {
        kind: 'version',
        commandLabel: 'wsl external-executor --version',
        exitCode: 0,
        stdout: 'ExternalExecutor 0.0.0-read-only\nOPENAI_API_KEY=sk-live-secret-value',
        stderr: '',
        startedAt: '2026-04-28T12:29:50.000Z',
        completedAt: '2026-04-28T12:29:50.100Z',
      },
      {
        kind: 'health',
        commandLabel: 'wsl external-executor health --read-only',
        exitCode: 0,
        stdout: 'ready',
        stderr: '',
        startedAt: '2026-04-28T12:29:51.000Z',
        completedAt: '2026-04-28T12:29:51.100Z',
      },
      {
        kind: 'capabilities',
        commandLabel: 'wsl external-executor capabilities --read-only',
        exitCode: 0,
        stdout: 'chat.read\nmemory.inspect',
        stderr: 'token: sk-other-secret-value',
        startedAt: '2026-04-28T12:29:52.000Z',
        completedAt: '2026-04-28T12:29:52.100Z',
      },
    ],
  });
}

describe('ExternalExecutor live read-only probe gate', () => {
  it('documents the first live contact as a separated read-only manual smoke gate', () => {
    const content = read(LIVE_PROBE_DOC);

    expect(content).toContain('Status: wave-1-live-read-only-external-executor-probe-ready-with-manual-smoke');
    expect(content).toContain(SMOKE_REPORT_DOC);
    expect(content).toContain(TEST_DESIGN_DOC);
    expect(content).toContain(BOUNDARY_PACK_DOC);
    expect(content).toContain('The `150` boundary pack must pass before any ExternalExecutor live contact is attempted.');
    expect(content).toContain('read-only only');
    expect(content).toContain('Manual smoke is optional and environment-gated.');
    expect(content).toContain('It is not part of CI.');
    expect(content).toContain('version, status, health, capabilities');
    expect(content).toContain('Do not run setup, install, login, auth, configure, write, send, tool');
    expect(content).toContain('real adapter remains blocked');
    expect(content).toContain('live event stream remains blocked');
    expect(content).toContain('action dispatch remains blocked');
  });

  it('records the real WSL smoke evidence as degraded and read-only', () => {
    const content = read(SMOKE_REPORT_DOC);

    expect(content).toContain('Status: wave-1-live-read-only-external-executor-smoke-degraded');
    expect(content).toContain(LIVE_PROBE_DOC);
    expect(content).toContain('/home/grey/.local/bin/external-executor');
    expect(content).toContain('ExternalExecutor 2026.4.26 (c7d77f8)');
    expect(content).toContain('`help:ok`, `version:ok`, `status:timeout`, `health:failed`, `capabilities:unavailable`');
    expect(content).toContain('Health status | `degraded`');
    expect(content).toContain('capabilities plural is unavailable and was not executed');
    expect(content).toContain('sidecarProcessStarted: false');
    expect(content).toContain('mutableHttpOrWebSocketOpened: false');
    expect(content).toContain('externalToolExecuted: false');
    expect(content).toContain('sourceModulesCopied: false');
    expect(content).toContain('adapterRemoved: false');
    expect(content).toContain('no real adapter is authorized');
    expect(content).not.toContain('real adapter: go');
    expect(content).not.toContain('live event stream: go');
  });

  it('exports the normalizer and keeps implementation normalizer-only', () => {
    const probe = read(PROBE_FILE);
    const index = read(INDEX_FILE);

    expect(probe).toContain('normalizeExternalExecutorLiveReadOnlyProbe');
    expect(probe).toContain("nativeContract: 'ZavorthExternalExecutorLiveReadOnlyProbe/v1'");
    expect(probe).toContain('normalizerExecutedLiveCommand: false');
    expect(probe).toContain('manualSmokeOnly: true');
    expect(index).toContain("from './ExternalAgentExternalExecutorLiveReadOnlyProbe.js'");
    expect(index).toContain('ExternalExecutorReadOnlyProbeNormalization');
  });

  it('normalizes captured stdout/stderr/status code into Zavorth read-only contracts', () => {
    const normalized = createCapturedProbe();

    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveReadOnlyProbe/v1',
      runtimeId: 'external-executor-live-read-only-probe-runtime',
      liveContactSeparatedFromBoundaryPack: true,
      normalizerExecutedLiveCommand: false,
      normalizedIntoReadOnlyBoundaryContracts: true,
      sourceModulesCopied: false,
      adapterRemoved: false,
    }));
    expect(normalized.commands).toEqual([
      expect.objectContaining({
        kind: 'version',
        exitCode: 0,
        status: 'ok',
        statusCodeCaptured: true,
        stdoutCaptured: true,
        stderrCaptured: false,
        stdoutStoredAsEvidenceOnly: true,
        rawOutputStored: false,
        commandExecutedOutsideNormalizer: true,
        mutationAllowed: false,
      }),
      expect.objectContaining({
        kind: 'health',
        status: 'ok',
      }),
      expect.objectContaining({
        kind: 'capabilities',
        stdoutCaptured: true,
        stderrCaptured: true,
        stderrStoredAsEvidenceOnly: true,
      }),
    ]);
    expect(normalized.health).toEqual(expect.objectContaining({
      runtimeId: 'external-executor-live-read-only-probe-runtime',
      status: 'ready',
      capabilities: {
        total: 2,
        trusted: 0,
        safe: 2,
        quarantined: 0,
      },
    }));
    expect(normalized.capabilitySnapshot).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarCapabilitySnapshot/v1',
      observedCapabilityCount: 2,
      stdoutParsedAsEvidenceOnly: true,
      sourceModulesLoaded: false,
      externalToolsExecuted: false,
    }));
  });

  it('redacts secret-looking output and stores no raw credential evidence', () => {
    const normalized = createCapturedProbe();
    const serialized = JSON.stringify(normalized);

    expect(normalized.commands[0]?.stdoutPreview).toContain('OPENAI_API_KEY=[redacted-secret]');
    expect(normalized.commands[2]?.stderrPreview).toContain('token=[redacted-secret]');
    expect(normalized.commands.every((command) => command.secretLikeOutputRedacted)).toBe(true);
    expect(normalized.capabilitySnapshot.secretLikeOutputRedacted).toBe(true);
    expect(serialized).not.toContain('sk-live-secret-value');
    expect(serialized).not.toContain('sk-other-secret-value');
  });

  it('keeps every mutating/live execution path blocked by the probe execution gate', () => {
    const normalized = createCapturedProbe();

    expect(normalized.executionGate).toEqual(expect.objectContaining({
      manualSmokeOnly: true,
      sidecarOptional: true,
      zavorthRunsWithoutSidecar: true,
      sidecarProcessStarted: false,
      sourceRuntimeConnected: false,
      externalExecutorLiveCalled: false,
      httpConnectionOpened: false,
      websocketConnectionOpened: false,
      externalCommandExecuted: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
      sourceHandlerLoaded: false,
      sourceHttpRouteRegistered: false,
      sourceGatewayMethodDispatched: false,
      sourceServiceLaunched: false,
      rawSecretsRead: false,
      configMigrated: false,
      stateMigrated: false,
      sourceModulesCopied: false,
      adapterRemoved: false,
      actionReachedExecutor: false,
      readOnlyCommandsCaptured: true,
      daemonStarted: false,
      mutableHttpOrWebSocketOpened: false,
      messageSent: false,
      pluginInstalled: false,
      dataMigrated: false,
    }));
  });

  it('represents help output and unavailable read-only commands without improvising execution', () => {
    const normalized = normalizeExternalExecutorLiveReadOnlyProbe({
      generatedAt: '2026-04-28T12:31:00.000Z',
      runtimeId: 'external-executor-live-read-only-probe-runtime',
      idPrefix: 'external-executor-live-read-only',
      commandResults: [
        {
          kind: 'help',
          commandLabel: 'wsl external-executor --help',
          exitCode: 0,
          stdout: 'Usage: external-executor [options] [command]',
          stderr: '',
          startedAt: '2026-04-28T12:30:50.000Z',
          completedAt: '2026-04-28T12:30:50.100Z',
        },
        {
          kind: 'capabilities',
          commandLabel: 'wsl external-executor capabilities',
          exitCode: null,
          stdout: '',
          stderr: 'unavailable: command not listed by help; not executed',
          startedAt: '2026-04-28T12:30:51.000Z',
          completedAt: '2026-04-28T12:30:51.000Z',
          attempted: false,
        },
      ],
    });

    expect(normalized.commands).toEqual([
      expect.objectContaining({
        kind: 'help',
        status: 'ok',
        commandAttempted: true,
        commandExecutedOutsideNormalizer: true,
      }),
      expect.objectContaining({
        kind: 'capabilities',
        exitCode: null,
        status: 'unavailable',
        commandAttempted: false,
        commandExecutedOutsideNormalizer: false,
        stderrStoredAsEvidenceOnly: true,
      }),
    ]);
    expect(normalized.health.status).toBe('degraded');
    expect(normalized.observability.readOnlyProbeRows).toEqual([
      expect.objectContaining({ kind: 'help', readOnly: true, status: 'ok' }),
      expect.objectContaining({ kind: 'capabilities', readOnly: true, status: 'unavailable' }),
    ]);
  });

  it('projects read-only observability without executable Command Center controls', () => {
    const normalized = createCapturedProbe();

    expect(normalized.observability).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarObservabilityProjection/v1',
      commandCenter: {
        readOnly: true,
        rows: [],
        executableControlsExposed: false,
      },
    }));
    expect(normalized.observability.readOnlyProbeRows).toEqual([
      expect.objectContaining({ kind: 'version', readOnly: true, status: 'ok' }),
      expect.objectContaining({ kind: 'health', readOnly: true, status: 'ok' }),
      expect.objectContaining({ kind: 'capabilities', readOnly: true, status: 'ok' }),
    ]);
  });
});
