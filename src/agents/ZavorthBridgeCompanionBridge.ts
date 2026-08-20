import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';type CompanionCommand =
  | 'accept-step'
  | 'reject-step'
  | 'open-conversation-picker'
  | 'open-handoff'
  | 'close-all-editors'
  | 'start-new-conversation'
  | 'open-quick-settings'
  | 'reset-session'
  | 'sync-pending-handoffs'
  | 'send-agent-prompt'
  | 'execute-command'
  | 'get-status';

type CompanionRequest = {
  id: string;
  command: CompanionCommand;
  createdAt: string;
  taskId?: string;
  targetInstanceId?: string;
  payload?: Record<string, unknown>;
};

type CompanionResult = {
  ok: boolean;
  command: CompanionCommand;
  requestId: string;
  completedAt: string;
  data?: unknown;
  error?: string;
};

type CompanionStatus = {
  ok?: boolean;
  extension?: string;
  version?: string;
  updatedAt?: string;
  windowFocused?: boolean;
  activeEditor?: string | null;
  workspaceFolders?: string[];
  hostname?: string;
  instanceId?: string;
  processId?: number;
  bridgeCommands?: string[];
  availableCommands?: string[];
  capabilities?: Record<string, boolean>;
  pendingHandoffs?: number;
  latestPendingHandoff?: string | null;
  lastOpenedHandoff?: string | null;
  lastSyncedHandoff?: string | null;
  lastRequest?: {
    command?: string;
    taskId?: string | null;
    createdAt?: string;
  } | null;
};

type ZavorthBridgeCompanionBridgeOptions = {
  requestDir?: string;
  resultDir?: string;
  runtimeDir?: string;
  pollIntervalMs?: number;
  pendingResultRetryMs?: number;
};

const DEFAULT_STATUS_MAX_AGE_MS = 10 * 60 * 1000;

export class ZavorthBridgeCompanionBridge {
  private requestDir: string;
  private resultDir: string;
  private runtimeDir: string;
  private pollIntervalMs: number;
  private pendingResultRetryMs: number;

  constructor(options: ZavorthBridgeCompanionBridgeOptions = {}) {
    this.requestDir = options.requestDir || config.zavorthBridgeControlRequestDir;
    this.resultDir = options.resultDir || config.zavorthBridgeControlResultDir;
    this.runtimeDir = options.runtimeDir || config.zavorthBridgeRuntimeDir;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
    this.pendingResultRetryMs = options.pendingResultRetryMs ?? 150;

    fs.mkdirSync(this.requestDir, { recursive: true });
    fs.mkdirSync(this.resultDir, { recursive: true });
    fs.mkdirSync(this.runtimeDir, { recursive: true });
  }

  public getStatusFilePath(): string {
    return path.join(this.runtimeDir, 'bridge-status.json');
  }

  public async readStatus(): Promise<CompanionStatus | null> {
    try {
      const raw = await fs.promises.readFile(this.getStatusFilePath(), 'utf8');
      return JSON.parse(raw) as CompanionStatus;
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Companion Bridge] JSON parse failed', error); return null; }
  }

  public async isOnline(maxAgeMs = DEFAULT_STATUS_MAX_AGE_MS): Promise<boolean> {
    const status = await this.readStatus();
    if (!status?.updatedAt) {
      return false;
    }

    const ageMs = Date.now() - Date.parse(String(status.updatedAt));
    return Number.isFinite(ageMs) && ageMs <= maxAgeMs;
  }

  public async acceptStep(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('accept-step', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async rejectStep(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('reject-step', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async openConversationPicker(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('open-conversation-picker', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async openHandoff(
    handoffFile: string,
    taskId?: string,
    timeoutMs = 8000,
    targetInstanceId?: string,
  ): Promise<CompanionResult> {
    return this.sendRequest('open-handoff', taskId, { handoffFile }, timeoutMs, targetInstanceId);
  }

  public async closeAllEditors(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('close-all-editors', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async startNewConversation(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('start-new-conversation', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async openQuickSettings(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('open-quick-settings', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async resetSession(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('reset-session', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async syncPendingHandoffs(taskId?: string, timeoutMs = 8000, targetInstanceId?: string): Promise<CompanionResult> {
    return this.sendRequest('sync-pending-handoffs', taskId, {}, timeoutMs, targetInstanceId);
  }

  public async sendAgentPrompt(
    prompt: string,
    taskId?: string,
    timeoutMs = 8000,
    targetInstanceId?: string,
  ): Promise<CompanionResult> {
    return this.sendRequest('send-agent-prompt', taskId, { prompt }, timeoutMs, targetInstanceId);
  }

  public async executeCommand(
    command: string,
    args: any[] = [],
    taskId?: string,
    timeoutMs = 8000,
    targetInstanceId?: string,
    fireAndForget = false,
  ): Promise<CompanionResult> {
    return this.sendRequest(
      'execute-command',
      taskId,
      {
        command,
        args,
        fireAndForget,
      },
      timeoutMs,
      targetInstanceId,
    );
  }

  public async getStatus(timeoutMs = 8000): Promise<CompanionResult> {
    return this.sendRequest('get-status', undefined, {}, timeoutMs);
  }

  public async getCapabilities(maxAgeMs = DEFAULT_STATUS_MAX_AGE_MS): Promise<Record<string, boolean>> {
    const status = await this.readStatus();
    if (!status?.updatedAt) {
      return {};
    }

    const ageMs = Date.now() - Date.parse(String(status.updatedAt));
    if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) {
      return {};
    }

    return status.capabilities || {};
  }

  public async supports(capability: string, maxAgeMs = DEFAULT_STATUS_MAX_AGE_MS): Promise<boolean> {
    const capabilities = await this.getCapabilities(maxAgeMs);
    return Boolean(capabilities?.[capability]);
  }

  private async sendRequest(
    command: CompanionCommand,
    taskId?: string,
    payload: Record<string, any> = {},
    timeoutMs = 8000,
    targetInstanceId?: string,
  ): Promise<CompanionResult> {
    const resolvedInstanceId = targetInstanceId || (await this.getPreferredInstanceId());
    const id = randomUUID();
    const request: CompanionRequest = {
      id,
      command,
      createdAt: new Date().toISOString(),
      taskId,
      targetInstanceId: resolvedInstanceId,
      payload,
    };

    const requestPath = path.join(this.requestDir, `${id}.json`);
    const resultPath = path.join(this.resultDir, `${id}.json`);

    await fs.promises.writeFile(requestPath, JSON.stringify(request, null, 2), 'utf8');

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (fs.existsSync(resultPath)) {
        const raw = await fs.promises.readFile(resultPath, 'utf8');
        if (!raw.trim()) {
          await new Promise((resolve) => setTimeout(resolve, this.pendingResultRetryMs));
          continue;
        }

        let parsed: CompanionResult;
        try {
          parsed = JSON.parse(raw) as CompanionResult;
        } catch (error: unknown) {await new Promise((resolve) => setTimeout(resolve, this.pendingResultRetryMs));
          continue;
        }

        await fs.promises.unlink(requestPath).catch(() => undefined);
        await fs.promises.unlink(resultPath).catch(() => undefined);
        if (!parsed.ok) {
          throw new Error(parsed.error || `ZavorthBridge companion bridge failed while executing ${command}.`);
        }
        return parsed;
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    const status = await this.readStatus();
    const suffix = status?.updatedAt ? ` Last heartbeat: ${status.updatedAt}.` : '';
    throw new Error(`ZavorthBridge companion bridge timed out for ${command}.${suffix}`);
  }

  private async getPreferredInstanceId(maxAgeMs = DEFAULT_STATUS_MAX_AGE_MS): Promise<string | undefined> {
    const status = await this.readStatus();
    if (!status?.instanceId || !status?.updatedAt) {
      return undefined;
    }

    const ageMs = Date.now() - Date.parse(String(status.updatedAt));
    if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) {
      return undefined;
    }

    return status.instanceId;
  }
}
