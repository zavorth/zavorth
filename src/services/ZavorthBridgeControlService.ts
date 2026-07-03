import { logger } from '../logger.js';
import fs from 'fs';
import { execFile } from 'child_process';
import { config } from '../config/index.js';
import { ZavorthBridgeCompanionBridge } from '../agents/ZavorthBridgeCompanionBridge.js';
import { ZavorthBridgePreferenceStore } from '../agents/ZavorthBridgePreferenceStore.js';
import { ZavorthBridgeWindowAutomator } from '../agents/ZavorthBridgeWindowAutomator.js';
import type { AutomationDiagnostics } from '../agents/ZavorthBridgeWindowAutomator.js';
import { RemoteModeManager } from './RemoteModeManager.js';
import { loadOptionalDependency } from './OptionalCapabilityGuard.js';
import { WindowsSessionService, type WindowsSessionStatus } from './WindowsSessionService.js';

type SqlJsModule = {
  default: () => Promise<{
    Database: new (data?: Buffer) => {
      run(sql: string, params?: unknown[]): void;
      export(): ArrayBuffer;
      close(): void;
    };
  }>;
  Database: new (data?: Buffer) => {
    run(sql: string, params?: unknown[]): void;
    export(): ArrayBuffer;
    close(): void;
  };
};

export type ZavorthBridgeControlAction = 'open' | 'status' | 'restart' | 'set-model';

type AllowedModelEntry = {
  key: string;
  label: string;
  aliases: string[];
  sentinelKey?: string;
};

type AllowedModelFile = {
  models: AllowedModelEntry[];
};

export type ZavorthBridgeControlResult = {
  ok: boolean;
  action: ZavorthBridgeControlAction;
  phase: string;
  verified: boolean;
  changed?: boolean;
  appInstalled: boolean;
  processFound: boolean;
  windowFound: boolean;
  processId: number | null;
  windowTitle: string | null;
  selectedModel: string | null;
  modelKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  logFile: string | null;
  diagnostics: AutomationDiagnostics | Record<string, unknown> | null;
  remoteModeActive?: boolean | null;
  sessionAccessible?: boolean | null;
  desktopName?: string | null;
  sessionMessage?: string | null;
  allowedModels?: string[];
  message?: string | null;
};

type ResolvedAllowedModel = AllowedModelEntry & {
  normalizedAliases: string[];
};

type ZavorthBridgeInteractionPreflight = {
  ok: boolean;
  action: ZavorthBridgeControlAction | 'prompt';
  remoteModeActive: boolean | null;
  sessionAccessible: boolean | null;
  desktopName: string | null;
  sessionMessage: string | null;
  processId: number | null;
  windowTitle: string | null;
  statusResult: ZavorthBridgeControlResult | null;
  diagnostics: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  message: string | null;
};

export class ZavorthBridgeControlService {
  private bridge: ZavorthBridgeCompanionBridge;
  private preferenceStore: ZavorthBridgePreferenceStore;
  private automator: ZavorthBridgeWindowAutomator;
  private remoteModeManager: RemoteModeManager;
  private windowsSessionService: WindowsSessionService;

  constructor() {
    this.bridge = new ZavorthBridgeCompanionBridge();
    this.preferenceStore = new ZavorthBridgePreferenceStore();
    this.automator = new ZavorthBridgeWindowAutomator();
    this.remoteModeManager = new RemoteModeManager();
    this.windowsSessionService = new WindowsSessionService();
  }

  public async open(): Promise<ZavorthBridgeControlResult> {
    const preflight = await this.ensureInteractiveSession('open');
    return this.materializePreflightResult('open', preflight);
  }

  public async status(): Promise<ZavorthBridgeControlResult> {
    const [statusResult, remoteModeStatus, sessionStatus] = await Promise.all([
      this.runScript('status'),
      this.remoteModeManager.status().catch(() => null),
      this.readWindowsSessionStatus(),
    ]);

    return this.decorateResult(statusResult, {
      remoteModeActive: remoteModeStatus?.active ?? null,
      sessionAccessible: sessionStatus?.accessible ?? null,
      desktopName: sessionStatus?.desktopName ?? null,
      sessionMessage: sessionStatus?.message ?? null,
      diagnostics: {
        ...(this.asDiagnostics(statusResult.diagnostics) || {}),
        remoteModeActive: remoteModeStatus?.active ?? null,
        sessionAccessible: sessionStatus?.accessible ?? null,
        desktopName: sessionStatus?.desktopName ?? null,
      },
    });
  }

  public async restart(): Promise<ZavorthBridgeControlResult> {
    const preflight = await this.ensureInteractiveSession('restart');
    if (!preflight.ok) {
      return this.materializePreflightResult('restart', preflight);
    }

    const restartResult = await this.runScript('restart');
    await this.focusInteractiveWindow((restartResult.processId ?? preflight.processId) ?? undefined).catch(() => undefined);
    return this.decorateResult(restartResult, preflight);
  }

  public async setModel(input: string): Promise<ZavorthBridgeControlResult> {
    const models = await this.getAllowedModels();
    const resolved = this.resolveAllowedModel(input, models);

    if (!resolved) {
      return {
        ok: false,
        action: 'set-model',
        phase: 'validation',
        verified: false,
        appInstalled: fs.existsSync(config.zavorthBridgeCliPath),
        processFound: false,
        windowFound: false,
        processId: null,
        windowTitle: null,
        selectedModel: null,
        modelKey: null,
        errorCode: 'model_not_allowed',
        errorMessage: `Modelo nao permitido: ${input}`,
        logFile: null,
        diagnostics: null,
        remoteModeActive: null,
        sessionAccessible: null,
        desktopName: null,
        sessionMessage: null,
        allowedModels: models.map((model) => model.key),
        message: 'A troca nao foi executada porque o modelo solicitado nao esta na allowlist.',
      };
    }

    const preflight = await this.ensureInteractiveSession('set-model');
    if (!preflight.ok) {
      const failure = this.materializePreflightResult('set-model', preflight);
      failure.selectedModel = resolved.label;
      failure.modelKey = resolved.key;
      failure.allowedModels = models.map((entry) => entry.key);
      return failure;
    }

    const nativeResult = await this.trySetModelViaStoredPreference(resolved);
    if (nativeResult?.ok && nativeResult.verified) {
      await this.stabilizePromptSurface().catch(() => undefined);
      await this.preferenceStore.setPreferredModel(resolved.label);
      return this.decorateResult(nativeResult, preflight);
    }

    await this.prepareSurface();
    const result = this.decorateResult(await this.runScript('set-model', resolved), preflight);

    if (result.ok && result.verified) {
      await this.stabilizePromptSurface().catch(() => undefined);
      await this.preferenceStore.setPreferredModel(resolved.label);
    }

    return result;
  }

  public async ensurePromptInteractionReady(currentProcessId?: number | null): Promise<ZavorthBridgeInteractionPreflight> {
    return this.ensureInteractiveSession('prompt', currentProcessId ?? undefined);
  }

  private async prepareSurface(): Promise<void> {
    if (!(await this.bridge.isOnline())) {
      return;
    }

    const status = await this.bridge.readStatus();
    const targetInstanceId = status?.instanceId;
    const commands = [
      'workbench.action.closeAllEditors',
      'zavorthBridge.openAgent',
    ];

    for (const command of commands) {
      await this.bridge.executeCommand(command, [], undefined, 5000, targetInstanceId).catch(() => undefined);
    }
  }

  private async ensureInteractiveSession(
    action: ZavorthBridgeControlAction | 'prompt',
    preferredProcessId?: number,
  ): Promise<ZavorthBridgeInteractionPreflight> {
    const [remoteModeStatus, sessionStatus] = await Promise.all([
      this.remoteModeManager.status().catch(() => null),
      this.readWindowsSessionStatus(),
    ]);

    if (sessionStatus && !sessionStatus.accessible) {
      return {
        ok: false,
        action,
        remoteModeActive: remoteModeStatus?.active ?? null,
        sessionAccessible: false,
        desktopName: sessionStatus.desktopName ?? null,
        sessionMessage: sessionStatus.message,
        processId: null,
        windowTitle: null,
        statusResult: null,
        diagnostics: {
          remoteModeActive: remoteModeStatus?.active ?? null,
          sessionAccessible: false,
          desktopName: sessionStatus.desktopName ?? null,
        },
        errorCode: 'session_not_accessible',
        errorMessage:
          sessionStatus.desktopName && sessionStatus.desktopName !== 'Default'
            ? `A sessao do Windows nao esta no desktop interativo (desktop atual: ${sessionStatus.desktopName}).`
            : sessionStatus.message || 'A sessao do Windows nao esta acessivel para automacao do ZavorthBridge.',
        message: remoteModeStatus?.active === false
          ? 'Ative o modo remoto com /remote on e mantenha a sessao desbloqueada antes de usar o ZavorthBridge de longe.'
          : 'Desbloqueie a sessao do Windows antes de usar o ZavorthBridge.',
      };
    }

    let statusResult = await this.runScript('status').catch(() => null);
    if (preferredProcessId && (!statusResult || statusResult.processId !== preferredProcessId)) {
      const targetedStatus = await this.runScript('status').catch(() => null);
      if (targetedStatus?.processId === preferredProcessId) {
        statusResult = targetedStatus;
      }
    }

    let effectiveResult = statusResult;
    if (!effectiveResult || !effectiveResult.processFound || !effectiveResult.windowFound) {
      effectiveResult = await this.runScript('open');
    }

    if (!effectiveResult.ok) {
      return {
        ok: false,
        action,
        remoteModeActive: remoteModeStatus?.active ?? null,
        sessionAccessible: sessionStatus?.accessible ?? null,
        desktopName: sessionStatus?.desktopName ?? null,
        sessionMessage: sessionStatus?.message ?? null,
        processId: effectiveResult.processId,
        windowTitle: effectiveResult.windowTitle,
        statusResult: effectiveResult,
        diagnostics: this.asDiagnostics(effectiveResult.diagnostics),
        errorCode: effectiveResult.errorCode || 'app_not_ready',
        errorMessage: effectiveResult.errorMessage || effectiveResult.message || 'Nao foi possivel preparar a janela do ZavorthBridge.',
        message: effectiveResult.message || null,
      };
    }

    try {
      await this.focusInteractiveWindow(effectiveResult.processId ?? preferredProcessId ?? undefined);
    } catch (error: unknown) {
      return {
        ok: false,
        action,
        remoteModeActive: remoteModeStatus?.active ?? null,
        sessionAccessible: sessionStatus?.accessible ?? null,
        desktopName: sessionStatus?.desktopName ?? null,
        sessionMessage: sessionStatus?.message ?? null,
        processId: effectiveResult.processId,
        windowTitle: effectiveResult.windowTitle,
        statusResult: effectiveResult,
        diagnostics: {
          ...(this.asDiagnostics(effectiveResult.diagnostics) || {}),
          focusFailed: true,
        },
        errorCode: 'window_focus_failed',
        errorMessage: error instanceof Error ? error.message : 'A janela do ZavorthBridge nao respondeu ao foco.',
        message: 'O ZavorthBridge foi encontrado, mas o Zavorth nao conseguiu trazer a janela para uma superficie operavel.',
      };
    }

    return {
      ok: true,
      action,
      remoteModeActive: remoteModeStatus?.active ?? null,
      sessionAccessible: sessionStatus?.accessible ?? null,
      desktopName: sessionStatus?.desktopName ?? null,
      sessionMessage: sessionStatus?.message ?? null,
      processId: effectiveResult.processId,
      windowTitle: effectiveResult.windowTitle,
      statusResult: effectiveResult,
      diagnostics: {
        ...(this.asDiagnostics(effectiveResult.diagnostics) || {}),
        remoteModeActive: remoteModeStatus?.active ?? null,
        sessionAccessible: sessionStatus?.accessible ?? null,
        desktopName: sessionStatus?.desktopName ?? null,
      },
      errorCode: null,
      errorMessage: null,
      message: remoteModeStatus?.active === false
        ? 'Sessao acessivel, mas o modo remoto esta inativo. Para uso fora de casa, prefira /remote on.'
        : sessionStatus?.message || 'Sessao acessivel e janela do ZavorthBridge pronta.',
    };
  }

  private async focusInteractiveWindow(processId?: number): Promise<void> {
    await this.automator.focusWindow(300, processId || 0);
  }

  private async readWindowsSessionStatus(): Promise<WindowsSessionStatus | null> {
    return this.windowsSessionService.status().catch(() => null);
  }

  private materializePreflightResult(
    action: ZavorthBridgeControlAction,
    preflight: ZavorthBridgeInteractionPreflight,
  ): ZavorthBridgeControlResult {
    const base = preflight.statusResult || {
      ok: false,
      action,
      phase: 'preflight',
      verified: false,
      appInstalled: fs.existsSync(config.zavorthBridgeCliPath),
      processFound: Boolean(preflight.processId),
      windowFound: Boolean(preflight.windowTitle),
      processId: preflight.processId,
      windowTitle: preflight.windowTitle,
      selectedModel: null,
      modelKey: null,
      errorCode: preflight.errorCode,
      errorMessage: preflight.errorMessage,
      logFile: null,
      diagnostics: preflight.diagnostics,
      message: preflight.message,
    } as ZavorthBridgeControlResult;

    return this.decorateResult(
      {
        ...base,
        action,
        ok: preflight.ok && base.ok,
        phase: preflight.ok ? base.phase : 'preflight',
        errorCode: preflight.ok ? base.errorCode : (preflight.errorCode || base.errorCode),
        errorMessage: preflight.ok ? base.errorMessage : (preflight.errorMessage || base.errorMessage),
        message: preflight.ok ? base.message : (preflight.message || base.message),
        diagnostics: preflight.diagnostics || base.diagnostics,
      },
      preflight,
    );
  }

  private decorateResult(
    result: ZavorthBridgeControlResult,
    preflight: Pick<ZavorthBridgeInteractionPreflight, 'remoteModeActive' | 'sessionAccessible' | 'desktopName' | 'sessionMessage' | 'diagnostics'>,
  ): ZavorthBridgeControlResult {
    return {
      ...result,
      remoteModeActive: preflight.remoteModeActive ?? result.remoteModeActive ?? null,
      sessionAccessible: preflight.sessionAccessible ?? result.sessionAccessible ?? null,
      desktopName: preflight.desktopName ?? result.desktopName ?? null,
      sessionMessage: preflight.sessionMessage ?? result.sessionMessage ?? null,
      diagnostics: {
        ...(this.asDiagnostics(result.diagnostics) || {}),
        ...(preflight.diagnostics || {}),
      },
    };
  }

  private asDiagnostics(
    diagnostics: AutomationDiagnostics | Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!diagnostics || typeof diagnostics !== 'object') {
      return null;
    }

    return { ...diagnostics };
  }

  private async stabilizePromptSurface(): Promise<void> {
    if (!(await this.bridge.isOnline())) {
      return;
    }

    const status = await this.bridge.readStatus();
    const targetInstanceId = status?.instanceId;

    if (
      config.zavorthBridgeStartNewConversationPerTask &&
      (await this.bridge.supports('canStartNewConversation'))
    ) {
      await this.bridge.startNewConversation(undefined, 8000, targetInstanceId).catch(() => undefined);
    } else {
      await this.bridge.executeCommand('zavorthBridge.openAgent', [], undefined, 5000, targetInstanceId).catch(() => undefined);
    }
  }

  private async trySetModelViaStoredPreference(
    model: ResolvedAllowedModel,
  ): Promise<ZavorthBridgeControlResult | null> {
    if (!model.sentinelKey) {
      return null;
    }

    try {
      await this.updateStoredModelPreference(model.sentinelKey);
      const restartResult = await this.runScript('restart');
      await this.prepareSurface();
      const verifyResult = await this.runUiScript('verify-model', model.label, restartResult.processId || undefined);

      if (verifyResult.verified) {
        return {
          ok: true,
          action: 'set-model',
          phase: 'completed',
          verified: true,
          changed: true,
          appInstalled: restartResult.appInstalled,
          processFound: restartResult.processFound,
          windowFound: restartResult.windowFound,
          processId: restartResult.processId,
          windowTitle: restartResult.windowTitle,
          selectedModel: model.label,
          modelKey: model.key,
          errorCode: null,
          errorMessage: null,
          logFile: restartResult.logFile,
          diagnostics: verifyResult.diagnostics || null,
          allowedModels: (await this.getAllowedModels()).map((entry) => entry.key),
          message: verifyResult.message || `Modelo confirmado: ${model.label}.`,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private async getAllowedModels(): Promise<ResolvedAllowedModel[]> {
    try {
      if (!fs.existsSync(config.zavorthBridgeAllowedModelsPath)) {
        return [];
      }

      const raw = await fs.promises.readFile(config.zavorthBridgeAllowedModelsPath, 'utf8');
      const parsed = this.parseJsonPayload<AllowedModelFile>(raw, 'allowed models');
      const models = Array.isArray(parsed.models) ? parsed.models : [];

      return models
        .filter((model) => typeof model?.key === 'string' && typeof model?.label === 'string')
        .map((model) => ({
          ...model,
          aliases: Array.isArray(model.aliases) ? model.aliases : [],
          normalizedAliases: Array.from(
            new Set(
              [model.key, model.label, ...(Array.isArray(model.aliases) ? model.aliases : [])]
                .map((value) => this.normalizeModelToken(value))
                .filter(Boolean),
            ),
          ),
        }));
    } catch (error) {
      logger.warn(`[ZavorthBridgeControlService] Falha ao carregar modelos permitidos: ${error}`);
      return [];
    }
  }

  private resolveAllowedModel(input: string, models: ResolvedAllowedModel[]): ResolvedAllowedModel | null {
    const normalized = this.normalizeModelToken(input);
    if (!normalized) {
      return null;
    }

    return models.find((model) => model.normalizedAliases.includes(normalized)) || null;
  }

  private normalizeModelToken(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async updateStoredModelPreference(sentinelKey: string): Promise<void> {
    await fs.promises.mkdir(config.zavorthBridgeControlRuntimeDir, { recursive: true });
    const backupPath = `${config.zavorthBridgeControlRuntimeDir}\\state.vscdb.backup`;
    await fs.promises.copyFile(config.zavorthBridgeStateDbPath, backupPath);

    const initSqlJs = (
      await loadOptionalDependency<SqlJsModule>(
        'sql.js',
        'remote',
        'O editor de estado remoto do ZavorthBridge depende do pacote sql.js opcional.',
      )
    ).default;
    const SQL = await initSqlJs();
    const currentDb = await fs.promises.readFile(config.zavorthBridgeStateDbPath);
    const db = new SQL.Database(currentDb);
    db.run('update ItemTable set value = ? where key = ?', [
      this.buildModelPreferenceValue(sentinelKey),
      'zavorthBridgeUnifiedStateSync.modelPreferences',
    ]);
    const nextDb = Buffer.from(db.export());
    db.close();
    await fs.promises.writeFile(config.zavorthBridgeStateDbPath, nextDb);
  }

  private buildModelPreferenceValue(sentinelKey: string): string {
    const fieldName = Buffer.from('last_selected_agent_model_sentinel_key', 'utf8');
    const sentinel = Buffer.from(sentinelKey, 'utf8');
    return Buffer.concat([
      Buffer.from([0x0a, 0x30, 0x0a, 0x26]),
      fieldName,
      Buffer.from([0x12, 0x06, 0x0a, 0x04]),
      sentinel,
    ]).toString('base64');
  }

  private runUiScript(
    mode: 'verify-model',
    text: string,
    processId?: number,
  ): Promise<{
    ok: boolean;
    verified: boolean;
    message?: string;
    diagnostics?: AutomationDiagnostics | Record<string, unknown> | null;
  }> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.zavorthBridgeUiScriptPath,
        '-Mode',
        mode,
        '-WindowTitle',
        config.zavorthBridgeWindowTitle,
        '-Text',
        text,
      ];

      if (processId && processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 4,
          timeout: 120000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            resolve(this.parseJsonPayload(stdout, 'ZavorthBridge UI result'));
          } catch (parseError: unknown) {
            reject(new Error(`Failed to parse ZavorthBridge UI result: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
          }
        },
      );
    });
  }

  private runScript(
    action: ZavorthBridgeControlAction,
    model?: ResolvedAllowedModel,
  ): Promise<ZavorthBridgeControlResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.zavorthBridgeControlScriptPath,
        '-Action',
        action,
        '-ExecutablePath',
        config.zavorthBridgeCliPath,
        '-AllowedModelsPath',
        config.zavorthBridgeAllowedModelsPath,
        '-UiScriptPath',
        config.zavorthBridgeUiScriptPath,
        '-AutoHotkeyPath',
        config.zavorthBridgeAutoHotkeyPath,
        '-AutoHotkeyScriptPath',
        config.zavorthBridgeAutoHotkeyScriptPath,
        '-WindowTitle',
        config.zavorthBridgeWindowTitle,
        '-LogDir',
        config.zavorthBridgeControlLogsDir,
        '-WorkspacePath',
        config.defaultWorkspace,
      ];

      if (config.zavorthBridgeProfileName) {
        args.push('-ProfileName', config.zavorthBridgeProfileName);
      }

      if (model) {
        args.push('-ModelKey', model.key);
      }

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 4,
          timeout: 120000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            const parsed = this.parseJsonPayload<ZavorthBridgeControlResult>(stdout, 'ZavorthBridge control result');
            resolve(parsed);
          } catch (parseError: unknown) {
            reject(new Error(`Failed to parse ZavorthBridge control result: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
          }
        },
      );
    });
  }

  private parseJsonPayload<T>(raw: string, sourceLabel: string): T {
    const candidate = this.extractBalancedJsonPayload(String(raw || '').replace(/^\uFEFF/, '').trim());
    if (!candidate) {
      throw new Error(`No JSON payload returned from ${sourceLabel}.`);
    }

    return JSON.parse(candidate) as T;
  }

  private extractBalancedJsonPayload(raw: string): string | null {
    if (!raw) {
      return null;
    }

    const startCandidates = [raw.indexOf('{'), raw.indexOf('[')].filter((index) => index >= 0);
    if (startCandidates.length === 0) {
      return null;
    }

    const startIndex = Math.min(...startCandidates);
    const opening = raw[startIndex];
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < raw.length; i += 1) {
      const char = raw[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === opening) {
        depth += 1;
      } else if (char === closing) {
        depth -= 1;
        if (depth === 0) {
          return raw.slice(startIndex, i + 1);
        }
      }
    }

    return raw.slice(startIndex).trim() || null;
  }
}
