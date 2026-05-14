import type {
  CodexRuntimeProfile,
  CodexRuntimeTransportPlan,
} from '../../contracts/CodexRuntimeContract.js';

export class CodexStdioTransportAdapter {
  public buildPlan(profile: Partial<CodexRuntimeProfile> = {}): CodexRuntimeTransportPlan {
    const command = String(profile.appServerCommand || '').trim() || 'codex';
    const args = profile.appServerArgs && profile.appServerArgs.length > 0
      ? profile.appServerArgs
      : ['app-server', '--listen', 'stdio://'];
    const envKeys = String(profile.codexHome || '').trim() ? ['CODEX_HOME'] : [];

    return {
      kind: 'stdio-app-server',
      command,
      args,
      url: null,
      envKeys,
      headers: {},
      windowsHide: true,
      liveIoRequired: false,
      processSpawnRequired: false,
      secretValuesSerialized: false,
      readiness: 'configured',
    };
  }
}
