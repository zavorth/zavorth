import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AutomaticBrowserTool } from '../mcp/tools/AutomaticBrowserTool.js';
import type { LogRepository } from '../storage/LogRepository.js';

export type EchoHandsAction = 'open_app' | 'browser_search' | 'open_url' | 'protocol_run';
export type EchoHandsRisk = 'low' | 'medium' | 'high';

export type EchoHandsRequest = {
  action: EchoHandsAction;
  args?: Record<string, unknown>;
  risk?: EchoHandsRisk;
  requestId?: string;
  trusted?: boolean;
};

export type EchoHandsResult = {
  ok: boolean;
  action: EchoHandsAction;
  message: string;
  metadata: Record<string, unknown>;
  approvalRequired: boolean;
};

type BrowserToolLike = {
  handleToolCall(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
};

type ProcessLauncher = (command: string, args: string[]) => Promise<string>;

type EchoProtocol = {
  name: string;
  description: string;
  risk: EchoHandsRisk;
  actions: EchoHandsRequest[];
};

type EchoHandsServiceOptions = {
  browserTool?: BrowserToolLike;
  processLauncher?: ProcessLauncher;
  logRepo?: Pick<LogRepository, 'log'> | null;
  protocolsPath?: string;
  trustedMode?: boolean;
};

const APP_COMMANDS: Record<string, { command: string; args: string[]; risk: EchoHandsRisk }> = {
  notepad: { command: 'notepad.exe', args: [], risk: 'low' },
  calculator: { command: 'calc.exe', args: [], risk: 'low' },
  vscode: { command: 'code', args: [], risk: 'medium' },
  chrome: { command: 'chrome', args: [], risk: 'medium' },
};

const RISK_ORDER: Record<EchoHandsRisk, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export class EchoHandsService {
  private readonly browserTool: BrowserToolLike;
  private readonly processLauncher: ProcessLauncher;
  private readonly protocolsPath: string;
  private readonly trustedMode: boolean;

  constructor(private readonly options: EchoHandsServiceOptions = {}) {
    this.browserTool = options.browserTool || new AutomaticBrowserTool();
    this.processLauncher = options.processLauncher || this.launchProcess.bind(this);
    this.protocolsPath = options.protocolsPath || path.resolve(process.cwd(), 'config', 'echo-protocols.json');
    this.trustedMode = options.trustedMode || process.env.ZAVORTH_ECHO_TRUSTED === 'true';
  }

  public async execute(request: EchoHandsRequest): Promise<EchoHandsResult> {
    const action = request.action;
    const risk = this.maxRisk(request.risk || 'low', this.inferRisk(request));
    const trusted = request.trusted === true || this.trustedMode;

    if (risk === 'high') {
      return this.result(false, action, 'Ação Echo de alto risco bloqueada no V1.', {
        risk,
        requestId: request.requestId || null,
      }, false);
    }

    if (risk === 'medium' && !trusted) {
      return this.result(false, action, 'Ação Echo requer aprovação ou modo trusted.', {
        risk,
        requestId: request.requestId || null,
      }, true);
    }

    try {
      const result = await this.executeAllowed(request, risk, trusted);
      this.log('info', request, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result = this.result(false, action, message, { risk }, false);
      this.log('error', request, result);
      return result;
    }
  }

  private async executeAllowed(
    request: EchoHandsRequest,
    risk: EchoHandsRisk,
    trusted: boolean,
  ): Promise<EchoHandsResult> {
    switch (request.action) {
      case 'open_app':
        return this.openApp(request, risk);
      case 'browser_search':
        return this.browserSearch(request, risk);
      case 'open_url':
        return this.openUrl(request, risk);
      case 'protocol_run':
        return this.runProtocol(request, risk, trusted);
      default:
        return this.result(false, request.action, 'Ação Echo desconhecida.', { risk }, false);
    }
  }

  private async openApp(request: EchoHandsRequest, risk: EchoHandsRisk): Promise<EchoHandsResult> {
    const app = String(request.args?.app || '').trim().toLowerCase();
    const command = APP_COMMANDS[app];
    if (!command) {
      return this.result(false, 'open_app', `App não permitido no Echo V1: ${app || 'n/d'}.`, { risk }, false);
    }

    const output = await this.processLauncher(command.command, command.args);
    return this.result(true, 'open_app', `App iniciado: ${app}.`, { app, output, risk }, false);
  }

  private async browserSearch(request: EchoHandsRequest, risk: EchoHandsRisk): Promise<EchoHandsResult> {
    const engine = String(request.args?.engine || 'google').trim().toLowerCase();
    const query = String(request.args?.query || '').trim();
    if (!query) {
      return this.result(false, 'browser_search', 'browser_search requer query.', { risk }, false);
    }

    const response = await this.browserTool.handleToolCall('browser_search', { engine, query });
    if (response.isError) {
      return this.result(false, 'browser_search', this.readToolText(response), { engine, query, risk }, false);
    }

    return this.result(true, 'browser_search', `Busca enviada para ${engine}.`, {
      engine,
      query,
      toolResult: this.readToolText(response),
      risk,
    }, false);
  }

  private async openUrl(request: EchoHandsRequest, risk: EchoHandsRisk): Promise<EchoHandsResult> {
    const url = this.normalizeHttpUrl(request.args?.url);
    const response = await this.browserTool.handleToolCall('browser_navigate', { url });
    if (response.isError) {
      return this.result(false, 'open_url', this.readToolText(response), { url, risk }, false);
    }

    return this.result(true, 'open_url', `URL aberta: ${url}.`, {
      url,
      toolResult: this.readToolText(response),
      risk,
    }, false);
  }

  private async runProtocol(
    request: EchoHandsRequest,
    risk: EchoHandsRisk,
    trusted: boolean,
  ): Promise<EchoHandsResult> {
    const name = String(request.args?.name || '').trim();
    const protocol = this.readProtocols().find((entry) => entry.name === name);
    if (!protocol) {
      return this.result(false, 'protocol_run', `Protocolo Echo não encontrado: ${name || 'n/d'}.`, { risk }, false);
    }

    if (protocol.actions.length > 1 && !trusted) {
      return this.result(false, 'protocol_run', 'Protocolos com múltiplas ações requerem aprovação.', {
        protocol: name,
        risk: this.maxRisk(risk, protocol.risk),
      }, true);
    }

    const outcomes: EchoHandsResult[] = [];
    for (const action of protocol.actions) {
      const outcome = await this.execute({
        ...action,
        trusted,
        requestId: request.requestId,
      });
      outcomes.push(outcome);
      if (!outcome.ok) {
        return this.result(false, 'protocol_run', `Protocolo interrompido em ${action.action}.`, {
          protocol: name,
          outcomes,
        }, outcome.approvalRequired);
      }
    }

    return this.result(true, 'protocol_run', `Protocolo Echo executado: ${name}.`, {
      protocol: name,
      outcomes,
      risk: this.maxRisk(risk, protocol.risk),
    }, false);
  }

  private inferRisk(request: EchoHandsRequest): EchoHandsRisk {
    if (request.action === 'open_app') {
      const app = String(request.args?.app || '').trim().toLowerCase();
      return APP_COMMANDS[app]?.risk || 'high';
    }
    if (request.action === 'browser_search') {
      return 'low';
    }
    if (request.action === 'open_url' || request.action === 'protocol_run') {
      return 'medium';
    }
    return 'high';
  }

  private maxRisk(left: EchoHandsRisk, right: EchoHandsRisk): EchoHandsRisk {
    return RISK_ORDER[left] >= RISK_ORDER[right] ? left : right;
  }

  private readProtocols(): EchoProtocol[] {
    const raw = fs.readFileSync(this.protocolsPath, 'utf8');
    const parsed = JSON.parse(raw) as EchoProtocol[];
    return Array.isArray(parsed) ? parsed : [];
  }

  private readToolText(response: { content: Array<{ type: string; text: string }> }): string {
    return response.content
      .filter((entry) => entry.type === 'text')
      .map((entry) => entry.text)
      .join('\n');
  }

  private normalizeHttpUrl(value: unknown): string {
    const raw = String(value || '').trim();
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Echo V1 aceita apenas URLs http/https.');
    }
    return parsed.toString();
  }

  private result(
    ok: boolean,
    action: EchoHandsAction,
    message: string,
    metadata: Record<string, unknown>,
    approvalRequired: boolean,
  ): EchoHandsResult {
    return { ok, action, message, metadata, approvalRequired };
  }

  private async launchProcess(command: string, args: string[]): Promise<string> {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      let settled = false;
      child.once('error', (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          child.unref();
          resolve(`started:${command}`);
        }
      }, 50);
    });
  }

  private log(level: 'info' | 'error', request: EchoHandsRequest, result: EchoHandsResult): void {
    this.options.logRepo?.log(level, 'EchoHands', JSON.stringify({
      requestId: request.requestId || null,
      action: request.action,
      ok: result.ok,
      approvalRequired: result.approvalRequired,
    }));
  }
}
