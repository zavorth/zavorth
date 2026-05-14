import fs from 'node:fs';
import path from 'node:path';

const DESIGN_DOC = 'docs/160-wave-0-real-capability-snapshot-gate-design.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const AUTH_HEALTH_DOC = 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md';
const PROVISIONING_DOC = 'docs/158-wave-1-external-executor-gateway-secret-ref-provisioning.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';

const INITIAL_ROWS = [
  'plugin-capabilities',
  'provider-capabilities',
  'channel-capabilities',
  'command-http-capabilities',
  'gateway-method-capabilities',
  'worker-node-capabilities',
  'session-history-capabilities',
];

const FIXTURE_SETS = [
  'snapshot-plugin-safe-tool',
  'snapshot-dangerous-tool-blocked',
  'snapshot-provider-secretref-only',
  'snapshot-channel-degraded',
  'snapshot-worker-offline',
  'snapshot-session-history-readmodel',
  'snapshot-source-identity-evidence-only',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function lineFor(content: string, itemId: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${itemId}\``)) || '';
}

describe('Wave 0 real capability snapshot gate design', () => {
  it('records the design gate as superseded by the closed 161 snapshot', () => {
    const content = read(DESIGN_DOC);

    expect(content).toContain('Status: superseded-by-real-capability-snapshot-read-only-ok');
    expect(content).toContain(`${PROVISIONING_DOC} -> secret-present-redacted`);
    expect(content).toContain(`${AUTH_HEALTH_DOC} -> authenticated-health-ok`);
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md -> real-capability-snapshot-read-only-ok');
    expect(content).toContain('real-capability-snapshot-read-only-ok');
  });

  it('does not authorize live calls or mutable ExternalExecutor work', () => {
    const content = read(DESIGN_DOC);
    const lower = content.toLowerCase();

    [
      'reexecute 158 blocked',
      'reexecute 156 blocked',
      'ExternalExecutor start blocked',
      'gateway connection blocked',
      'live health/status/probe blocked',
      'token read blocked',
      'tool/provider/command execution blocked',
      'real capability import blocked',
      'route/handler registration blocked',
      'channel bridge real blocked',
      'session import real blocked',
      'native replacement blocked',
      'source module copy blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
    expect(content).toContain('live calls authorized: false');
    expect(lower).not.toContain('live calls authorized: true');
    expect(content).toContain('next future gate executed: true');
  });

  it('covers all initial capability snapshot rows', () => {
    const content = read(DESIGN_DOC);

    INITIAL_ROWS.forEach((rowId) => {
      const row = lineFor(content, rowId);

      expect(row).toContain(`\`${rowId}\``);
      expect(row).toContain('covered-by-161-read-only-snapshot');
      expect(row).toMatch(/Zavorth|ExternalAgent|ToolExposurePolicyInput|health|inventory|descriptor|contracts/i);
    });
  });

  it('defines deterministic fixture sets for future normalization', () => {
    const content = read(DESIGN_DOC);

    FIXTURE_SETS.forEach((fixtureId) => {
      expect(content).toContain(`\`${fixtureId}\``);
    });
    expect(content).toContain('Safe plugin metadata becomes inventory only; execution authority false.');
    expect(content).toContain('Dangerous tool/method becomes blocked policy input.');
    expect(content).toContain('History availability becomes read model metadata; import/replay false.');
  });

  it('requires Zavorth-native normalization and evidence-only source identity', () => {
    const content = read(DESIGN_DOC);

    expect(content).toContain('nativeContract: ZavorthRealCapabilitySnapshot/v1');
    expect(content).toContain('inventoryContract: ExternalAgentCapabilityInventorySnapshot');
    expect(content).toContain('policyContract: ToolExposurePolicyInput');
    expect(content).toContain('healthContract: ExternalAgentHealthSnapshot');
    expect(content).toContain('Zavorth-owned ids for every inventory row');
    expect(content).toContain('sourceEvidence');
    expect(content).toContain('sourceIdentityStoredAsEvidenceOnly: true');
    expect(content).toContain('source ids evidence-only');
  });

  it('keeps execution authority false, no source copy, no raw secret, and honest unavailable states', () => {
    const content = read(DESIGN_DOC);

    expect(content).toContain('executionAuthority: false');
    expect(content).toContain('sourceModuleCopied: false');
    expect(content).toContain('rawSecretObserved: false');
    expect(content).toContain('snapshot read-only');
    expect(content).toContain('no execution authority');
    expect(content).toContain('no source module copy');
    expect(content).toContain('no raw secret');
    expect(content).toContain('dangerous capabilities blocked or approval-gated');
    expect(content).toContain('unavailable capabilities represented honestly');
    expect(content).toContain('Zavorth remains kernel');
  });

  it('points to the 161 future gate and records that it has now executed', () => {
    const content = read(DESIGN_DOC);

    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('next future gate executed: true');
    expect(content).toContain('That future gate must still be read-only.');
  });

  it('updates follow-on tracking docs with the closed read-only snapshot state', () => {
    const pause = read(PAUSE_DOC);
    const retry = read(AUTH_HEALTH_DOC);
    const provisioning = read(PROVISIONING_DOC);
    const goNoGo = read(GO_NO_GO_DOC);

    [pause, provisioning, goNoGo].forEach((content) => {
      expect(content).toContain(DESIGN_DOC);
      expect(content).toContain('real-capability-snapshot-read-only-ok');
    });
    expect(pause).toContain('docs/161 may be used as the closed real read-only snapshot evidence');
    expect(retry).toContain('decision: authenticated-health-ok');
    expect(retry).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(provisioning).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(goNoGo).toContain('docs/161 captured the real read-only capability snapshot');
  });
});
