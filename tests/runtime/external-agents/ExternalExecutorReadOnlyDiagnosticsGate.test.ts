import fs from 'node:fs';
import path from 'node:path';

const DIAGNOSTICS_DOC = 'docs/153-wave-1-external-executor-read-only-diagnostics-gate.md';
const SMOKE_REPORT_DOC = 'docs/152-wave-1-live-read-only-external-executor-smoke-report.md';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor read-only diagnostics gate', () => {
  it('records a read-only diagnostic gate after the degraded smoke', () => {
    const content = read(DIAGNOSTICS_DOC);

    expect(content).toContain('Status: wave-1-external-executor-read-only-diagnostics-gate-gateway-not-running');
    expect(content).toContain(SMOKE_REPORT_DOC);
    expect(content).toContain('diagnostic and read-only');
    expect(content).toContain('does not start a daemon');
    expect(content).toContain('start a');
    expect(content).toContain('connect to a live WebSocket');
    expect(content).toContain('execute tools');
    expect(content).toContain('alter config/state/secrets');
    expect(content).toContain('create a real');
    expect(content).toContain('authorize live event streams');
  });

  it('lists only help, process, port, config, and log diagnostics as verified commands', () => {
    const content = read(DIAGNOSTICS_DOC);

    [
      'external-executor --help',
      'external-executor status --help',
      'external-executor health --help',
      'external-executor gateway --help',
      'external-executor daemon --help',
      'external-executor gateway status --help',
      'external-executor gateway probe --help',
      'external-executor daemon status --help',
      'ps -eo pid,ppid,comm,args',
      'ss -ltnp',
      'stat /home/grey/.external-executor/external-executor.json',
      '/home/grey/.external-executor/logs/config-health.json',
    ].forEach((evidence) => {
      expect(content).toContain(evidence);
    });
    expect(content).toContain('Commands intentionally not executed');
    expect(content).toContain('external-executor gateway run');
    expect(content).toContain('external-executor gateway start');
    expect(content).toContain('external-executor daemon start');
    expect(content).toContain('external-executor doctor');
  });

  it('classifies the degraded health failure as gateway-not-running', () => {
    const content = read(DIAGNOSTICS_DOC);

    expect(content).toContain('decision: gateway-not-running');
    expect(content).toContain('gateway-command-unknown: false');
    expect(content).toContain('config-missing: false');
    expect(content).toContain('auth-missing: not-primary');
    expect(content).toContain('unknown: false');
    expect(content).toContain('No ExternalExecutor or gateway process found');
    expect(content).toContain('Port check found no listener on `18789` or dev port `19001`');
    expect(content).toContain('`gateway.port: 18789`');
    expect(content).toContain('`gateway.mode: local`');
    expect(content).toContain('`gateway.bind: loopback`');
  });

  it('recommends a separate controlled-start preflight without authorizing start', () => {
    const content = read(DIAGNOSTICS_DOC);

    expect(content).toContain('docs/154-wave-1-controlled-ephemeral-external-executor-gateway-start.md');
    expect(content).toContain('preflight first, not a blind start');
    expect(content).toContain('This `153` gate does not authorize that future start.');
    expect(content).toContain('daemon start blocked');
    expect(content).toContain('gateway start blocked');
    expect(content).toContain('gateway run blocked');
    expect(content).toContain('live WebSocket connection blocked');
    expect(content).toContain('real adapter blocked');
    expect(content).toContain('adapter removal blocked');
  });

  it('updates the smoke report with the diagnostic decision', () => {
    const content = read(SMOKE_REPORT_DOC);

    expect(content).toContain(DIAGNOSTICS_DOC);
    expect(content).toContain('decision: gateway-not-running');
    expect(content).toContain('no ExternalExecutor gateway/daemon process is');
    expect(content).toContain('no listener is bound to `18789`');
    expect(content).toContain('does not');
    expect(content).toContain('authorize daemon start');
    expect(content).toContain('real adapter creation');
  });
});
