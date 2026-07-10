import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildFeedbackTelemetryProductLoopCliSnapshot,
  formatFeedbackTelemetryProductLoopSnapshot,
  resolveFeedbackTelemetryProductLoopCliText,
} from '../../src/cli/ZavorthCliFeedbackTelemetryProductLoopRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-feedback-loop',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Feedback Telemetry Product Loop Feedback Telemetry', () => {
  it('parses feedback-product-loop text after aliases', () => {
    expect(resolveFeedbackTelemetryProductLoopCliText('feedback-product-loop "preparar opt-in"')).toBe('preparar opt-in');
    expect(resolveFeedbackTelemetryProductLoopCliText('telemetry-opt-in latest')).toBe('');
  });

  it('renders feedback product loop JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'feedback-product-loop',
      normalized: 'feedback-product-loop',
      args: 'feedback-product-loop "preparar opt-in"',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      handled: true,
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.feedback-telemetry',
      source: 'FeedbackTelemetryProductLoopService',
      status: 'opt-in-ready',
      readiness: expect.objectContaining({
        publicSiteDocsDemoSyncLinked: true,
        feedbackTelemetryContractLinked: true,
        canCollectFeedbackPreview: true,
        canSendFeedbackExternally: false,
        canEnableTelemetry: false,
      }),
      policy: expect.objectContaining({
        noTelemetryEnabled: true,
        noFeedbackSent: true,
        noExternalNetworkCall: true,
        noRawPayloadSerialized: true,
        noConsentAssumed: true,
        revokeDeleteAvailable: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth feedback-product-loop');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildFeedbackTelemetryProductLoopCliSnapshot({
      text: 'preparar opt-in',
      userId: 'grey',
      sessionId: 'session-cli-feedback-loop-human',
    });

    const text = formatFeedbackTelemetryProductLoopSnapshot(snapshot);

    expect(text).toContain('Feedback / Telemetry Opt-In / Product Loop - Feedback Telemetry');
    expect(text).toMatch(/telemetry|nao foi ligada|not enabled|Feedback/i);
    expect(text).toContain('feedback nao foi enviado');
    expect(text).toContain('payload bruto nao foi serializado');
    expect(text).toContain('Dashboard: /zavorthControl?runId=');
  });
});
