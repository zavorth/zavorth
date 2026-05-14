import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeExternalExecutorLiveReadOnlyProbe,
} from '../../../src/runtime/external-agents/index.js';

const CONTROLLED_START_DOC = 'docs/154-wave-1-controlled-ephemeral-external-executor-gateway-start.md';
const DIAGNOSTICS_DOC = 'docs/153-wave-1-external-executor-read-only-diagnostics-gate.md';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor controlled ephemeral gateway start gate', () => {
  it('records an ephemeral foreground gateway start without authorizing persistent runtime work', () => {
    const content = read(CONTROLLED_START_DOC);

    expect(content).toContain('Status: wave-1-controlled-ephemeral-external-executor-gateway-start-health-still-degraded');
    expect(content).toContain(DIAGNOSTICS_DOC);
    expect(content).toContain('decision: gateway-not-running');
    expect(content).toContain('external-executor gateway run --port 18789 --bind loopback --ws-log compact');
    expect(content).toContain('Persistent start commands | not used');
    expect(content).toContain('`--force`, `--dev`, `--reset` | not used');
    expect(content).toMatch(/does\s+not authorize a persistent daemon/);
    expect(content).toContain('permanent adapter');
    expect(content).toContain('prolonged live event');
    expect(content).toContain('tool execution');
  });

  it('records preflight, listener, PID, probe, config, and cleanup evidence', () => {
    const content = read(CONTROLLED_START_DOC);

    expect(content).toContain('Preexisting ExternalExecutor/gateway process | none');
    expect(content).toContain('Preexisting listener on `18789` or `19001` | none');
    expect(content).toContain('Windows runner PID | `19428`');
    expect(content).toContain('Linux ExternalExecutor CLI PID | `468`');
    expect(content).toContain('Linux gateway PID | `490`');
    expect(content).toContain('Listener | `127.0.0.1:18789` and `[::1]:18789`');
    expect(content).toContain('Config overwrite: /home/grey/.external-executor/external-executor.json');
    expect(content).toContain('pre-gate hash restored');
    expect(content).toContain('ExternalExecutor/gateway process after cleanup | none');
    expect(content).toContain('Listener on `18789` after cleanup | none');
  });

  it('classifies probes as degraded and blocks the next live-runtime steps', () => {
    const content = read(CONTROLLED_START_DOC);

    expect(content).toContain('Gateway health');
    expect(content).toContain('explicit URL requires explicit credentials');
    expect(content).toContain('Gateway status');
    expect(content).toContain('RPC `ok: false`');
    expect(content).toContain('Gateway capability probe');
    expect(content).toContain('capability `unknown`');
    expect(content).toContain('decision: health-still-degraded');
    expect(content).toContain('cleanup completed: true');
    expect(content).toContain('config side effect restored: true');
    expect(content).toContain('no adapter, event');
    expect(content).toContain('provider execution');
    expect(content).toContain('native replacement gate is recommended');
  });

  it('normalizes the captured probe fixture with existing Zavorth contracts', () => {
    const normalized = normalizeExternalExecutorLiveReadOnlyProbe({
      generatedAt: '2026-04-28T15:31:26.787Z',
      runtimeId: 'external-executor-controlled-ephemeral-gateway-start',
      idPrefix: 'external-executor-controlled-ephemeral-gateway-start',
      commandResults: [
        {
          kind: 'version',
          commandLabel: 'external-executor --version',
          exitCode: 0,
          stdout: 'ExternalExecutor 2026.4.26 (c7d77f8)\n',
          stderr: '',
          startedAt: '2026-04-28T15:31:06.972Z',
          completedAt: '2026-04-28T15:31:07.133Z',
        },
        {
          kind: 'health',
          commandLabel: 'external-executor gateway health --json --timeout 3000 --url ws://127.0.0.1:18789',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: gateway url override requires explicit credentials',
          startedAt: '2026-04-28T15:31:07.133Z',
          completedAt: '2026-04-28T15:31:11.194Z',
        },
        {
          kind: 'status',
          commandLabel: 'external-executor gateway status --json --timeout 3000 --url ws://127.0.0.1:18789',
          exitCode: 0,
          stdout: 'service stopped; port busy; rpc timeout; listener pid 490',
          stderr: '',
          startedAt: '2026-04-28T15:31:11.194Z',
          completedAt: '2026-04-28T15:31:15.271Z',
        },
        {
          kind: 'capabilities',
          commandLabel: 'external-executor gateway probe --json --timeout 3000 --url ws://127.0.0.1:18789',
          exitCode: 1,
          stdout: 'capability unknown; connect timeout',
          stderr: '',
          startedAt: '2026-04-28T15:31:15.271Z',
          completedAt: '2026-04-28T15:31:22.818Z',
        },
      ],
    });

    expect(normalized.nativeContract).toBe('ZavorthExternalExecutorLiveReadOnlyProbe/v1');
    expect(normalized.health.status).toBe('degraded');
    expect(normalized.health.diagnostics?.notes).toEqual(expect.arrayContaining([
      'version:ok',
      'health:failed',
      'status:ok',
      'capabilities:failed',
    ]));
    expect(normalized.capabilitySnapshot).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarCapabilitySnapshot/v1',
      observedCapabilityCount: 0,
      sourceModulesLoaded: false,
      externalToolsExecuted: false,
    }));
    expect(normalized.executionGate).toEqual(expect.objectContaining({
      sidecarProcessStarted: false,
      sourceRuntimeConnected: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
      rawSecretsRead: false,
      configMigrated: false,
      stateMigrated: false,
      sourceModulesCopied: false,
      adapterRemoved: false,
      actionReachedExecutor: false,
    }));
  });

  it('links the diagnostic gate to the executed 154 follow-up without granting further work', () => {
    const content = read(DIAGNOSTICS_DOC);

    expect(content).toContain(CONTROLLED_START_DOC);
    expect(content).toContain('Its final decision is');
    expect(content).toContain('health-still-degraded');
    expect(content).toContain('no real adapter');
    expect(content).toContain('event bridge');
    expect(content).toContain('action dispatch');
  });
});
