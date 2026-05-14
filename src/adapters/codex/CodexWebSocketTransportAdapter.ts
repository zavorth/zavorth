import type {
  CodexRuntimeProfile,
  CodexRuntimeTransportPlan,
} from '../../contracts/CodexRuntimeContract.js';

export class CodexWebSocketTransportAdapter {
  public buildPlan(profile: Partial<CodexRuntimeProfile> = {}): CodexRuntimeTransportPlan {
    const url = String(profile.appServerUrl || '').trim() || null;
    return {
      kind: 'websocket-app-server',
      command: null,
      args: [],
      url,
      envKeys: [],
      headers: this.redactHeaders(profile.headers || {}),
      windowsHide: true,
      liveIoRequired: false,
      processSpawnRequired: false,
      secretValuesSerialized: false,
      readiness: url ? 'configured' : 'missing-endpoint',
    };
  }

  private redactHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      redacted[key] = /authorization|token|cookie|key|secret/i.test(key)
        ? '[redacted]'
        : String(value);
    }
    return redacted;
  }
}
