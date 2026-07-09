import { asErrorLike } from '../utils/errorLike';
﻿import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { ChatMessage, ILlmProvider } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';

type CaptureScriptResult = {
  ok: boolean;
  screenshotPath: string;
  captureMethod: string | null;
  processId: number | null;
  windowTitle: string | null;
  width: number;
  height: number;
  error?: string | null;
};

type LocalUiReadResult = {
  ok: boolean;
  status?: string;
  hasPermissionPrompt?: boolean;
  permissionPromptSummary?: string | null;
  hasInputBar?: boolean;
  visibleModel?: string | null;
  responseText?: string | null;
  confidence?: number;
  notes?: string | null;
  uiVerified?: boolean;
  uiDiagnostics?: Record<string, any> | null;
};

export type ZavorthBridgeUiSnapshot = {
  ok: boolean;
  taskId: string;
  status: 'generating' | 'ready' | 'permission_prompt' | 'unknown' | 'error';
  hasPermissionPrompt: boolean;
  permissionPromptSummary: string | null;
  hasInputBar: boolean;
  visibleModel: string | null;
  responseText: string;
  screenshotPath: string | null;
  captureMethod: string | null;
  confidence: number;
  notes: string | null;
  rawResponse: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  uiVerified: boolean | null;
  uiDiagnostics: Record<string, any> | null;
};

type VisionPayload = {
  status?: string;
  hasPermissionPrompt?: boolean;
  permissionPromptSummary?: string | null;
  hasInputBar?: boolean;
  visibleModel?: string | null;
  responseText?: string | null;
  confidence?: number;
  notes?: string | null;
};

export class ZavorthBridgeUiCaptureService {
  public async captureLatestResponse(options: {
    taskId: string;
    processId?: number | null;
    windowTitle?: string | null;
    expectedModel?: string | null;
  }): Promise<ZavorthBridgeUiSnapshot> {
    const localUiRead = await this.runUiReadScript(
      options.processId || undefined,
      options.windowTitle || config.zavorthBridgeWindowTitle,
    ).catch(() => null);

    if (localUiRead?.ok) {
      const localStatus = this.normalizeStatus(localUiRead.status);
      const localResponseText = String(localUiRead.responseText || '').trim();
      const localHasPermissionPrompt = Boolean(localUiRead.hasPermissionPrompt) || localStatus === 'permission_prompt';
      const localHasInputBar = Boolean(localUiRead.hasInputBar);
      const localVisibleModel = localUiRead.visibleModel || null;

      const localLooksUseful =
        localHasPermissionPrompt ||
        localStatus === 'generating' ||
        (localStatus === 'ready' && !!localResponseText) ||
        (!!localResponseText && localHasInputBar);

      if (localLooksUseful) {
        return {
          ok: true,
          taskId: options.taskId,
          status: localStatus,
          hasPermissionPrompt: localHasPermissionPrompt,
          permissionPromptSummary: localUiRead.permissionPromptSummary || null,
          hasInputBar: localHasInputBar,
          visibleModel: localVisibleModel,
          responseText: localResponseText,
          screenshotPath: null,
          captureMethod: 'uia',
          confidence: this.normalizeConfidence(localUiRead.confidence),
          notes: localUiRead.notes ? `provider=local-uia | ${String(localUiRead.notes).trim()}` : 'provider=local-uia',
          rawResponse: JSON.stringify(localUiRead),
          errorCode: null,
          errorMessage: null,
          uiVerified: typeof localUiRead.uiVerified === 'boolean' ? localUiRead.uiVerified : null,
          uiDiagnostics:
            localUiRead.uiDiagnostics && typeof localUiRead.uiDiagnostics === 'object'
              ? localUiRead.uiDiagnostics
              : null,
        };
      }
    }

    const capturePath = path.join(
      config.zavorthBridgePromptCaptureDir,
      `${this.sanitizeTaskId(options.taskId)}_${Date.now()}.png`,
    );

    const captureResult = await this.runCaptureScript(
      capturePath,
      options.processId || undefined,
      options.windowTitle || config.zavorthBridgeWindowTitle,
    );

    if (!captureResult.ok || !captureResult.screenshotPath || !fs.existsSync(captureResult.screenshotPath)) {
      return {
        ok: false,
        taskId: options.taskId,
        status: 'error',
        hasPermissionPrompt: false,
        permissionPromptSummary: null,
        hasInputBar: false,
        visibleModel: null,
        responseText: '',
        screenshotPath: captureResult.screenshotPath || null,
        captureMethod: captureResult.captureMethod || null,
        confidence: 0,
        notes: null,
        rawResponse: null,
        errorCode: 'capture_failed',
        errorMessage: captureResult.error || 'Falha ao capturar a janela do ZavorthBridge.',
        uiVerified: null,
        uiDiagnostics: null,
      };
    }

    const inlineData = [{
      mimeType: 'image/png',
      data: await fs.promises.readFile(captureResult.screenshotPath, 'base64'),
    }];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Voce analisa screenshots do app ZavorthBridge. Responda com JSON puro, sem markdown, sem comentarios e sem texto extra. ' +
          'Extraia apenas o estado da conversa visivel no screenshot. ' +
          'Campos obrigatorios: status, hasPermissionPrompt, hasInputBar, visibleModel, responseText, confidence, notes. ' +
          'Campo opcional: permissionPromptSummary. ' +
          'status deve ser exatamente um destes: generating, ready, permission_prompt, unknown. ' +
          'Use permission_prompt se houver dialogo/prompt de permissao com botoes Allow/Deny. ' +
          'Se houver prompt de permissao, permissionPromptSummary deve resumir o pedido visivel, por exemplo acesso a pasta, diretorio ou comando. ' +
          'Use generating se o app aparentar estar gerando resposta, por exemplo com texto "Generating", indicador ativo ou botao de parar. ' +
          'Use ready se a resposta parece finalizada e o campo esta pronto para novo envio. ' +
          'responseText deve conter somente a ultima resposta visivel do assistente, sem incluir o prompt do usuario, menus, nomes de arquivo, labels de UI ou texto do seletor de modelo. ' +
          'Se nao houver resposta visivel do assistente, use string vazia em responseText. ' +
          'visibleModel deve ser o modelo visivel no composer, ou null se nao estiver claro. ' +
          'confidence deve ser um numero de 0 a 1.',
      },
      {
        role: 'user',
        content: [
          'Analise a screenshot anexada do ZavorthBridge.',
          options.expectedModel ? `O modelo esperado neste momento e: ${options.expectedModel}.` : null,
          'Retorne apenas JSON puro.',
        ].filter(Boolean).join('\n'),
        inlineData,
      },
    ];

    const analysis = await this.tryAnalyzeWithAvailableProviders(messages);

    if (!analysis.parsed) {
      return {
        ok: false,
        taskId: options.taskId,
        status: 'error',
        hasPermissionPrompt: false,
        permissionPromptSummary: null,
        hasInputBar: false,
        visibleModel: null,
        responseText: '',
        screenshotPath: captureResult.screenshotPath,
        captureMethod: captureResult.captureMethod,
        confidence: 0,
        notes: null,
        rawResponse: analysis.rawResponse,
        errorCode: analysis.errorCode,
        errorMessage: analysis.errorMessage,
        uiVerified: null,
        uiDiagnostics: null,
      };
    }

    const parsed = analysis.parsed;
    const normalizedStatus = this.normalizeStatus(parsed.status);
    return {
      ok: true,
      taskId: options.taskId,
      status: normalizedStatus,
      hasPermissionPrompt: Boolean(parsed.hasPermissionPrompt) || normalizedStatus === 'permission_prompt',
      permissionPromptSummary: parsed.permissionPromptSummary ? String(parsed.permissionPromptSummary).trim() : null,
      hasInputBar: Boolean(parsed.hasInputBar),
      visibleModel: parsed.visibleModel || null,
      responseText: String(parsed.responseText || '').trim(),
      screenshotPath: captureResult.screenshotPath,
      captureMethod: captureResult.captureMethod,
      confidence: this.normalizeConfidence(parsed.confidence),
      notes: [
        analysis.providerName ? `provider=${analysis.providerName}` : null,
        parsed.notes ? String(parsed.notes).trim() : null,
      ].filter(Boolean).join(' | ') || null,
      rawResponse: analysis.rawResponse,
      errorCode: null,
      errorMessage: null,
      uiVerified: null,
      uiDiagnostics: null,
    };
  }

  private async tryAnalyzeWithAvailableProviders(
    messages: ChatMessage[],
  ): Promise<{
    parsed: VisionPayload | null;
    rawResponse: string | null;
    providerName: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  }> {
    const providerNames: string[] = [];

    try {
      ProviderFactory.create('gemini');
      providerNames.push('gemini');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn("[auto-fix] Empty catch block", err); }

    try {
      ProviderFactory.create('openai');
      providerNames.push('openai');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn("[auto-fix] Empty catch block", err); }

    try {
      ProviderFactory.create('qwen');
      providerNames.push('qwen');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn("[auto-fix] Empty catch block", err); }

    let lastError: string | null = null;
    let lastRawResponse: string | null = null;

    for (const providerName of providerNames) {
      try {
        const provider = ProviderFactory.create(providerName) as ILlmProvider;
        const response = await provider.chat(messages);
        lastRawResponse = response.content || null;
        const parsed = this.parseVisionPayload(response.content || '');
        if (parsed) {
          return {
            parsed,
            rawResponse: response.content || null,
            providerName,
            errorCode: null,
            errorMessage: null,
          };
        }

        lastError = `O provider ${providerName} respondeu, mas sem JSON interpretavel.`;
      } catch (error: unknown) {
        logger.warn('[Zavorth Bridge Ui Capture] parsing failed', error);
    lastError = `Falha no provider ${providerName}: ${error.message}`;
  }
    }

    return {
      parsed: null,
      rawResponse: lastRawResponse,
      providerName: null,
      errorCode: 'vision_parse_failed',
      errorMessage: lastError || 'Nenhum provider multimodal conseguiu interpretar a UI do ZavorthBridge.',
    };
  }

  private runCaptureScript(
    outputPath: string,
    processId?: number,
    windowTitle = config.zavorthBridgeWindowTitle,
  ): Promise<CaptureScriptResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.zavorthBridgeCaptureScriptPath,
        '-WindowTitle',
        windowTitle,
        '-OutputPath',
        outputPath,
      ];

      if (processId && processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 2,
          timeout: 30000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            resolve(JSON.parse(stdout.trim()) as CaptureScriptResult);
          } catch (parseError: unknown) {reject(new Error(`Falha ao interpretar a captura do ZavorthBridge: ${parseError.message}`));
          }
        },
      );
    });
  }

  private runUiReadScript(
    processId?: number,
    windowTitle = config.zavorthBridgeWindowTitle,
  ): Promise<LocalUiReadResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.zavorthBridgeUiScriptPath,
        '-Mode',
        'read-latest-response',
        '-WindowTitle',
        windowTitle,
      ];

      if (processId && processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 2,
          timeout: 30000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            const parsed = JSON.parse(stdout.trim()) as {
              ok?: boolean;
              message?: string;
              verified?: boolean;
              diagnostics?: Record<string, any> | null;
            };
            const payload = JSON.parse(String(parsed.message || '{}')) as LocalUiReadResult;
            resolve({
              ...payload,
              uiVerified: typeof parsed.verified === 'boolean' ? parsed.verified : undefined,
              uiDiagnostics:
                parsed.diagnostics && typeof parsed.diagnostics === 'object' ? parsed.diagnostics : null,
            });
          } catch (parseError: unknown) {reject(new Error(`Falha ao interpretar a leitura local da UI do ZavorthBridge: ${parseError.message}`));
          }
        },
      );
    });
  }

  private parseVisionPayload(raw: string): VisionPayload | null {
    const candidate = String(raw || '').trim();
    if (!candidate) {
      return null;
    }

    const direct = this.tryParseJson(candidate);
    if (direct) {
      return direct;
    }

    const fencedMatch = candidate.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (fencedMatch) {
      const fenced = this.tryParseJson(fencedMatch[1]);
      if (fenced) {
        return fenced;
      }
    }

    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return this.tryParseJson(candidate.slice(firstBrace, lastBrace + 1));
    }

    return null;
  }

  private tryParseJson(raw: string): VisionPayload | null {
    try {
      return JSON.parse(raw) as VisionPayload;
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Ui Capture] JSON parse failed', error); return null; }
  }

  private normalizeStatus(status: string | undefined): ZavorthBridgeUiSnapshot['status'] {
    switch (String(status || '').trim().toLowerCase()) {
      case 'generating':
        return 'generating';
      case 'ready':
        return 'ready';
      case 'permission_prompt':
        return 'permission_prompt';
      default:
        return 'unknown';
    }
  }

  private normalizeConfidence(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.min(1, numeric));
  }

  private sanitizeTaskId(taskId: string): string {
    return String(taskId || 'task')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'task';
  }
}
