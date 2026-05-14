import fs from 'node:fs';
import path from 'node:path';

const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const HEALTH_RETRY_DOC = 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md';
const PROVISIONING_DOC = 'docs/158-wave-1-external-executor-gateway-secret-ref-provisioning.md';
const CAPABILITY_SNAPSHOT_DESIGN_DOC = 'docs/160-wave-0-real-capability-snapshot-gate-design.md';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor secret provisioning operational pause', () => {
  it('records the resolved read-only snapshot state in the pause doc', () => {
    const content = read(PAUSE_DOC);

    expect(content).toContain('Status: resolved-through-real-read-only-snapshot');
    expect(content).toContain('Canonical state:');
    expect(content).toContain('real-capability-snapshot-read-only-ok');
    expect(content).toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN is present-redacted in Windows User scope and WSL');
    expect(content).toContain('returned authenticated-health-ok');
    expect(content).toContain('docs/155');
    expect(content).toContain('docs/157');
    expect(content).toContain('docs/158');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
  });

  it('lists blocked work, allowed work, resume sequence, and security guarantees', () => {
    const content = read(PAUSE_DOC);

    [
      'asking token in chat blocked',
      'raw token print blocked',
      'unsupervised gateway start blocked',
      'unauthorized authenticated health/status/probe blocked',
      'real sidecar blocked',
      'real adapter blocked',
      'live event stream blocked',
      'mutable capability import blocked',
      'channel bridge blocked',
      'session import blocked',
      'provider execution blocked',
      'command execution blocked',
      'native replacement blocked',
      'mutable execution blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('local operator may provision EXTERNAL_EXECUTOR_GATEWAY_TOKEN by secure local mechanism');
    expect(content).toContain('presence-only checks may report missing or present-redacted');
    expect(content).toContain('docs/161 may be used as the closed real read-only snapshot evidence');
    expect(content).toContain('docs/160 may prepare future capability snapshot design without live calls');
    expect(content).toContain('Keep `EXTERNAL_EXECUTOR_GATEWAY_TOKEN` provisioned locally by secure mechanism');
    expect(content).toContain('Open a new explicit gate before any retry, adapter, event bridge');
    expect(content).toContain('Latest resume attempt:');
    expect(content).toContain('WINDOWS_EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('WSL_EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('docs/156 reexecuted: true');
    expect(content).toContain('docs/156 decision: authenticated-health-ok');
    expect(content).toContain('listener observed: true');
    expect(content).toContain('docs/161 created: true');
    expect(content).toContain('docs/161 decision: real-capability-snapshot-read-only-ok');
    expect(content).toContain(CAPABILITY_SNAPSHOT_DESIGN_DOC);
    expect(content).toContain('real-capability-snapshot-read-only-ok');
    expect(content).toContain('No token value is requested in chat');
    expect(content).toContain('No token value is written to docs, tests, logs, metadata, or git');
  });

  it('propagates the resolved state into 117, 156, and 158', () => {
    const goNoGo = read(GO_NO_GO_DOC);
    const retry = read(HEALTH_RETRY_DOC);
    const provisioning = read(PROVISIONING_DOC);

    expect(goNoGo).toContain('Status: real-capability-snapshot-read-only-ok');
    expect(goNoGo).toContain(PAUSE_DOC);
    expect(goNoGo).toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN is present-redacted in Windows User scope');
    expect(goNoGo).toContain('Latest operational retry:');
    expect(goNoGo).toContain('docs/161 created: true');
    expect(goNoGo).toContain('docs/161 decision: real-capability-snapshot-read-only-ok');
    expect(goNoGo).toContain(CAPABILITY_SNAPSHOT_DESIGN_DOC);
    expect(retry).toContain('Status: authenticated-health-ok');
    expect(retry).toContain('decision: authenticated-health-ok');
    expect(retry).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(provisioning).toContain('## 2026-04-28 Resume Attempt');
    expect(provisioning).toContain('Current state is:');
    expect(provisioning).toContain('real-capability-snapshot-read-only-ok');
    expect(provisioning).toContain('161 created: true');
    expect(provisioning).toContain(CAPABILITY_SNAPSHOT_DESIGN_DOC);
  });
});
