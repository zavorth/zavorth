import type {
  ZavorthMlxTtsRuntimeReceipt,
} from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';

type Runtime = {
  now?: () => Date;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
};

export class ZavorthMlxTtsRuntimeAdapter {
  private readonly now: () => Date;
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.platform = runtime.platform || process.platform;
    this.env = runtime.env || process.env;
  }

  public buildReadinessReceipt(): ZavorthMlxTtsRuntimeReceipt {
    const commandRef = this.commandRef();
    const isMac = this.platform === 'darwin';
    if (!isMac) {
      return this.receipt({
        status: 'unsupported',
        commandRef,
        approvalRequired: true,
        reason: 'MLX TTS is macOS-only and remains an optional runtime on this host.',
      });
    }
    if (!commandRef) {
      return this.receipt({
        status: 'owner-gated',
        commandRef,
        approvalRequired: true,
        reason: 'MLX TTS requires an owner-selected command reference before it can be used.',
      });
    }
    return this.receipt({
      status: 'available',
      commandRef,
      approvalRequired: true,
      reason: 'MLX TTS command reference is configured, but execution still requires explicit approval.',
    });
  }

  public buildPreviewReceipt(input: {
    text: string;
    approvalId?: string | null;
  }): ZavorthMlxTtsRuntimeReceipt {
    const readiness = this.buildReadinessReceipt();
    if (!input.approvalId) {
      return this.receipt({
        status: 'blocked',
        commandRef: readiness.commandRef,
        approvalRequired: true,
        reason: 'MLX TTS preview requires an approvalId; no process was spawned.',
      });
    }
    return this.receipt({
      status: readiness.status === 'available' ? 'available' : readiness.status,
      commandRef: readiness.commandRef,
      approvalRequired: true,
      reason: readiness.status === 'available'
        ? `Approved MLX TTS dry receipt for ${String(input.text || '').length} character(s); execution is intentionally delegated to a future live command.`
        : readiness.reason,
    });
  }

  private commandRef(): string | null {
    const keys = ['ZAVORTH_MLX_TTS_COMMAND', 'MLX_TTS_COMMAND'];
    for (const key of keys) {
      if (String(this.env[key] || '').trim()) return key;
    }
    return null;
  }

  private receipt(input: {
    status: ZavorthMlxTtsRuntimeReceipt['status'];
    commandRef: string | null;
    approvalRequired: boolean;
    reason: string;
  }): ZavorthMlxTtsRuntimeReceipt {
    return {
      id: `zavorth.native-companion.mlx-tts.${this.now().getTime()}.receipt`,
      status: input.status,
      platform: this.platform,
      commandRef: input.commandRef,
      approvalRequired: input.approvalRequired,
      processSpawned: false,
      enabledByDefault: false,
      artifactFirst: true,
      secretValuesSerialized: false,
      reason: input.reason,
    };
  }
}
