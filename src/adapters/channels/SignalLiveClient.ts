import { execFile } from 'child_process';

import { config } from '../../config/index.js';

export type SignalLiveTransport = 'json-rpc' | 'signal-cli' | 'unconfigured';

export type SignalLiveClientConfig = {
  jsonRpcUrl: string;
  cliPath: string;
  accountNumber: string;
  allowedRecipients: string[];
};

export type SignalTextSendInput = {
  recipients?: string[];
  message: string;
};

export type SignalTextSendReceipt = {
  channelId: 'signal';
  transport: Exclude<SignalLiveTransport, 'unconfigured'>;
  status: 'sent';
  recipientsCount: number;
  providerConfigured: true;
  liveIo: true;
  secretValuesSerialized: false;
  responseSummary: string;
  sentAt: string;
};

type ExecFileImpl = (
  file: string,
  args: string[],
  options: { timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

type SignalLiveClientRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  execFileImpl?: ExecFileImpl;
  settings?: Partial<SignalLiveClientConfig>;
};

export class SignalLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly execFileImpl: ExecFileImpl;
  private readonly settings: SignalLiveClientConfig;

  constructor(runtime: SignalLiveClientRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
    this.execFileImpl = runtime.execFileImpl || defaultExecFile;
    this.settings = {
      jsonRpcUrl: String(runtime.settings?.jsonRpcUrl ?? config.signalJsonRpcUrl ?? '').trim(),
      cliPath: String(runtime.settings?.cliPath ?? config.signalCliPath ?? '').trim(),
      accountNumber: String(runtime.settings?.accountNumber ?? config.signalAccountNumber ?? '').trim(),
      allowedRecipients: (runtime.settings?.allowedRecipients ?? config.signalAllowedRecipients ?? [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    };
  }

  public resolveTransport(): SignalLiveTransport {
    if (this.settings.jsonRpcUrl) {
      return 'json-rpc';
    }
    if (this.settings.cliPath) {
      return 'signal-cli';
    }
    return 'unconfigured';
  }

  public isConfigured(): boolean {
    return Boolean(
      this.resolveTransport() !== 'unconfigured'
      && this.settings.accountNumber
      && this.settings.allowedRecipients.length > 0,
    );
  }

  public doctor(): {
    channelId: 'signal';
    status: 'passed' | 'missing-config';
    transport: SignalLiveTransport;
    requiredConfig: string[];
    configuredConfig: string[];
    secretValuesSerialized: false;
  } {
    const configuredConfig: string[] = [];
    if (this.settings.accountNumber) {
      configuredConfig.push('SIGNAL_ACCOUNT_NUMBER');
    }
    if (this.settings.allowedRecipients.length > 0) {
      configuredConfig.push('SIGNAL_ALLOWED_RECIPIENTS');
    }
    if (this.settings.jsonRpcUrl) {
      configuredConfig.push('SIGNAL_JSONRPC_URL');
    }
    if (this.settings.cliPath) {
      configuredConfig.push('SIGNAL_CLI_PATH');
    }

    return {
      channelId: 'signal',
      status: this.isConfigured() ? 'passed' : 'missing-config',
      transport: this.resolveTransport(),
      requiredConfig: [
        'SIGNAL_ACCOUNT_NUMBER',
        'SIGNAL_ALLOWED_RECIPIENTS',
        'SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH',
      ],
      configuredConfig,
      secretValuesSerialized: false,
    };
  }

  public buildDaemonCommand(): string | null {
    if (!this.settings.cliPath || !this.settings.accountNumber) {
      return null;
    }
    return `${this.settings.cliPath} -u ${this.settings.accountNumber} daemon --json-rpc`;
  }

  public async sendText(input: SignalTextSendInput): Promise<SignalTextSendReceipt> {
    const message = String(input.message || '').trim();
    if (!message) {
      throw new Error('Signal live send requires a non-empty message.');
    }

    const recipients = (input.recipients?.length ? input.recipients : this.settings.allowedRecipients)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      throw new Error('Signal live send requires at least one allowed recipient.');
    }
    if (!this.settings.accountNumber) {
      throw new Error('Signal live send requires SIGNAL_ACCOUNT_NUMBER.');
    }

    const transport = this.resolveTransport();
    if (transport === 'json-rpc') {
      await this.sendViaJsonRpc(recipients, message);
    } else if (transport === 'signal-cli') {
      await this.sendViaCli(recipients, message);
    } else {
      throw new Error('Signal live send requires SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH.');
    }

    return {
      channelId: 'signal',
      transport,
      status: 'sent',
      recipientsCount: recipients.length,
      providerConfigured: true,
      liveIo: true,
      secretValuesSerialized: false,
      responseSummary: `${transport} accepted ${recipients.length} recipient(s).`,
      sentAt: this.now().toISOString(),
    };
  }

  private async sendViaJsonRpc(recipients: string[], message: string): Promise<void> {
    if (!this.fetchImpl) {
      throw new Error('Signal JSON-RPC live send requires fetch in the runtime.');
    }

    const response = await this.fetchImpl(this.settings.jsonRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `zavorth-signal-${Date.now()}`,
        method: 'send',
        params: {
          account: this.settings.accountNumber,
          recipients,
          message,
        },
      }),
    });

    let payload: Record<string, any> | null = null;
    try {
      payload = await response.json() as Record<string, any>;
    } catch (error: any) { const err = error; const e = error;
      payload = null;
    }

    if (!response.ok) {
      throw new Error(`Signal JSON-RPC live send failed with HTTP ${response.status}.`);
    }
    if (payload?.error) {
      const messageText = typeof payload.error?.message === 'string'
        ? payload.error.message
        : JSON.stringify(payload.error);
      throw new Error(`Signal JSON-RPC live send failed: ${messageText}`);
    }
  }

  private async sendViaCli(recipients: string[], message: string): Promise<void> {
    const args = [
      '-u',
      this.settings.accountNumber,
      'send',
      '-m',
      message,
      ...recipients,
    ];
    await this.execFileImpl(this.settings.cliPath, args, { timeout: 30_000 });
  }
}

function defaultExecFile(
  file: string,
  args: string[],
  options: { timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });
}
