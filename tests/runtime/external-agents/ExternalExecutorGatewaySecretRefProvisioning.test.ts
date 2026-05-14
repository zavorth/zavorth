import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalAgentExternalExecutorGatewaySecretRef,
  createFixtureExternalAgentSecretResolver,
  EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
  resolveExternalAgentSecretRef,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/158-wave-1-external-executor-gateway-secret-ref-provisioning.md';
const RETRY_DOC = 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md';
const SECRET_SENTINEL = 'synthetic-raw-credential-sentinel-that-must-not-appear';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor gateway SecretRef provisioning gate', () => {
  it('records the 158 provisioning gate as secret-present-redacted without exposing a token', () => {
    const content = read(DOC);

    expect(content).toContain('Status: secret-present-redacted');
    expect(content).toContain('docs/159-external-executor-secret-provisioning-pause.md');
    expect(content).toContain('decision: secret-present-redacted');
    expect(content).toContain('docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md');
    expect(content).toContain(RETRY_DOC);
    expect(content).toContain('SecretRef: external-executor-gateway-token');
    expect(content).toContain('WINDOWS_EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('WSL_EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('## 2026-04-28 Resume Attempt');
    expect(content).toContain('156 reexecuted: true');
    expect(content).toContain('156 decision: authenticated-health-ok');
    expect(content).toContain('161 created: true');
    expect(content).toContain('161 decision: real-capability-snapshot-read-only-ok');
    expect(content).toContain('raw token printed: false');
    expect(content).toContain('raw token written: false');
    expect(content).toContain('gateway start attempted: false');
    expect(content).toContain('gateway start attempted: true');
    expect(content).toContain('gateway start attempted: false');
    expect(content).toContain('adapter created: false');
    expect(content).toContain('live event stream opened: false');
    expect(content).not.toContain(SECRET_SENTINEL);
  });

  it('documents safe local provisioning with placeholders only', () => {
    const content = read(DOC);

    expect(content).toContain('Provisioning is operator-local and must happen outside chat/docs/logs');
    expect(content).toContain('Windows current session: set EXTERNAL_EXECUTOR_GATEWAY_TOKEN=<redacted-local-secret>');
    expect(content).toContain('WSL current session: export EXTERNAL_EXECUTOR_GATEWAY_TOKEN=<redacted-local-secret>');
    expect(content).toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('Never record the raw value, hash, length, prefix, suffix, or preview');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!missing|present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('keeps absent real provisioning as secret-unavailable with no injection plan', () => {
    const envelope = resolveExternalAgentSecretRef({
      secretRef: createExternalAgentExternalExecutorGatewaySecretRef(),
      requestedChannel: 'env-var',
      policy: {
        ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
        processStartAllowed: true,
        auditReason: '158-external-executor-gateway-secret-ref-provisioning',
      },
      generatedAt: '2026-04-28T19:00:00.000Z',
      idPrefix: 'external-executor-gateway-secret-ref-provisioning',
    });

    expect(envelope.status).toBe('secret-unavailable');
    expect(envelope.failureState).toBe('secret-unavailable');
    expect(envelope.injectionPlan).toBeNull();
    expect(envelope.redaction.rawSecretValuePresentInEnvelope).toBe(false);
    expect(envelope.redaction.rawSecretValuePresentInJson).toBe(false);
    expect(envelope.audit.rawSecretRecorded).toBe(false);
    expect(envelope.audit.rawSecretPrinted).toBe(false);
    expect(envelope.executionGate.processStarted).toBe(false);
    expect(envelope.executionGate.gatewayStarted).toBe(false);
  });

  it('proves fixture provisioning stays redacted and never serializes raw material', () => {
    const envelope = resolveExternalAgentSecretRef({
      secretRef: createExternalAgentExternalExecutorGatewaySecretRef(),
      requestedChannel: 'env-var',
      policy: {
        ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
        processStartAllowed: true,
        auditReason: '158-redaction-fixture-only',
      },
      generatedAt: '2026-04-28T19:00:00.000Z',
      idPrefix: 'external-executor-gateway-secret-ref-provisioning',
      resolver: createFixtureExternalAgentSecretResolver(SECRET_SENTINEL),
      accidentalRawInput: SECRET_SENTINEL,
    });
    const serialized = JSON.stringify(envelope);

    expect(envelope.status).toBe('resolved');
    expect(envelope.injectionPlan?.env).toEqual({
      name: 'EXTERNAL_EXECUTOR_GATEWAY_TOKEN',
      valuePreview: '[redacted-secret]',
      rawValueLogged: false,
    });
    expect(envelope.redaction).toEqual({
      required: true,
      rawSecretValuePresentInEnvelope: false,
      rawSecretValuePresentInJson: false,
      accidentalRawInputDiscarded: true,
      placeholder: '<SecretRef:external-executor-gateway-token>',
    });
    expect(serialized).not.toContain(SECRET_SENTINEL);
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!missing|present-redacted)[^\s"]+/);
  });

  it('updates 156 to point to 158 and records authenticated health closure', () => {
    const content = read(RETRY_DOC);

    expect(content).toContain(DOC);
    expect(content).toContain('`secret-present-redacted`');
    expect(content).toContain('Status: authenticated-health-ok');
    expect(content).toContain('decision: authenticated-health-ok');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
  });
});
