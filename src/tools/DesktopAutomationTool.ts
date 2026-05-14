import { BaseTool } from './BaseTool.js';
import { execFile } from 'child_process';
import { config } from '../config/index.js';
import path from 'path';
import fs from 'fs';
import { decideSecurityPolicy, formatSecurityPolicyReceipt } from '../security/SecurityPolicyBroker.js';

type DesktopAutomationResult = {
  ok: boolean;
  action: string;
  windowTitle: string | null;
  pid: number | null;
  message: string | null;
  details: Record<string, unknown> | null;
};

const BLOCKED_WINDOW_TITLE_PATTERNS = [
  /\bexecutar\b/i,
  /\brun\b/i,
  /\bwindows\s+power\s*shell\b/i,
  /\bpowershell\b/i,
  /\bpwsh\b/i,
  /\bprompt\s+de\s+comando\b/i,
  /\bcommand\s+prompt\b/i,
  /\bcmd(?:\.exe)?\b/i,
  /\bwindows\s+terminal\b/i,
  /\bterminal\b/i,
  /\bconhost\b/i,
  /\bwsl\b/i,
  /\bbash\b/i,
];

const BLOCKED_PRESS_KEY_PATTERNS = [
  /\bwin(?:dows)?\s*\+\s*r\b/i,
  /\{(?:lwin|rwin|win|windows)\}/i,
  /#\s*r/i,
  /^\s*\^\s*\{?esc(?:ape)?\}?\s*$/i,
];

/**
 * DesktopAutomationTool — "Computer Use" nativo para Windows.
 *
 * Permite que o agente LLM controle qualquer aplicativo Desktop
 * usando a Windows UIAutomation API (System.Windows.Automation).
 *
 * Capacidades:
 *  - Focar janelas por título ou PID
 *  - Clicar em botões, abas e elementos via texto visível na Accessibility Tree
 *  - Digitar texto (via clipboard injection)
 *  - Enviar teclas/atalhos (Enter, Tab, Ctrl+S, Alt+F4, etc.)
 *  - Capturar screenshots de janelas específicas
 *  - Listar elementos visíveis de uma janela (para reconhecimento)
 *
 * Segurança:
 *  - Herda as permissões do RemoteShellTool (mesmos IDs autorizados)
 *  - Não instala dependências externas (usa PowerShell + .NET nativo)
 */
export class DesktopAutomationTool extends BaseTool {
  public readonly name = 'desktop_automation';
  public readonly description =
    'Controla aplicativos de Desktop no Windows usando a UI Automation API nativa. ' +
    'Permite focar janelas, clicar em botões/abas por texto, digitar texto, enviar atalhos de teclado, ' +
    'capturar screenshots de janelas e listar elementos visíveis. Use "list-elements" primeiro para descobrir ' +
    'os nomes dos botões disponíveis antes de clicar. Use "screenshot" para verificar visualmente o estado.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['focus-window', 'click-element', 'type-text', 'press-key', 'screenshot', 'list-elements'],
        description:
          'A ação a executar. ' +
          '"focus-window": traz a janela para frente. ' +
          '"click-element": clica em um elemento pelo texto visível (requer targetText). ' +
          '"type-text": cola texto na janela ativa (requer payload). ' +
          '"press-key": envia uma tecla/atalho (requer payload no formato SendKeys, ex: "{ENTER}", "^s", "%{F4}"). ' +
          '"screenshot": captura uma foto da janela. ' +
          '"list-elements": lista até 60 elementos visíveis da janela (para descobrir nomes de botões).',
      },
      windowTitle: {
        type: 'string',
        description:
          'Título (ou parte do título) da janela alvo. Exemplos: "Calculadora", "Spotify", "Chrome", "Notepad".',
      },
      targetText: {
        type: 'string',
        description:
          'O texto visível do elemento a clicar (para action "click-element"). ' +
          'Ex: "8", "Igual", "Arquivo", "Nova Aba". Use "list-elements" para descobrir os nomes.',
      },
      payload: {
        type: 'string',
        description:
          'Para "type-text": o texto a colar. Para "press-key": a tecla no formato SendKeys ' +
          '(ex: "{ENTER}", "{TAB}", "^s" para Ctrl+S, "%{F4}" para Alt+F4, "^c" para Ctrl+C).',
      },
      processId: {
        type: 'number',
        description: 'PID do processo alvo (opcional, alternativa ao windowTitle).',
      },
    },
    required: ['action'],
    anyOf: [
      { required: ['windowTitle'] },
      { required: ['processId'] },
    ],
  };

  private readonly scriptPath: string;

  constructor() {
    super();
    this.scriptPath = path.resolve(config.projectRoot, 'scripts', 'desktop-automation.ps1');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').trim();
    const windowTitle = String(args.windowTitle || '').trim();
    const targetText = String(args.targetText || '').trim();
    const payload = String(args.payload || '').trim();
    const processId = Number(args.processId) || 0;

    if (!action) {
      return 'Erro: O parâmetro "action" é obrigatório.';
    }

    if (!windowTitle && !processId) {
      return 'Erro: Informe "windowTitle" ou "processId" para identificar a janela alvo.';
    }

    const safetyError = this.validateUiSafety(action, windowTitle, payload);
    if (safetyError) {
      return `Erro: ${safetyError}`;
    }

    if (!fs.existsSync(this.scriptPath)) {
      return `Erro: Script de automação não encontrado em "${this.scriptPath}".`;
    }

    // For screenshot, generate a default output path
    let outputPath = '';
    if (action === 'screenshot') {
      const captureDir = path.resolve(config.projectRoot, 'data', 'desktop-captures');
      fs.mkdirSync(captureDir, { recursive: true });
      outputPath = path.join(captureDir, `capture-${Date.now()}.png`);
    }

    try {
      const result = await this.runScript(action, windowTitle, targetText, payload, processId, outputPath);

      if (!result.ok) {
        return `Erro na automação: ${result.message || 'Falha desconhecida.'}`;
      }

      let response = result.message || 'Ação executada com sucesso.';

      // Enrich response based on action
      if (action === 'screenshot' && result.details) {
        const details = result.details as { screenshotPath?: string; width?: number; height?: number };
        response += `\nScreenshot: ${details.screenshotPath} (${details.width}x${details.height}px)`;
      }

      if (action === 'list-elements' && result.details) {
        const details = result.details as { elementCount?: number; elements?: Array<{ name: string; type: string }> };
        if (details.elements && details.elements.length > 0) {
          const elementList = details.elements
            .map((el) => `  • "${el.name}" (${el.type})`)
            .join('\n');
          response += `\nElementos encontrados:\n${elementList}`;
        }
      }

      if (action === 'click-element' && result.details) {
        const details = result.details as { elementName?: string; controlType?: string };
        response += `\nElemento: "${details.elementName}" (${details.controlType})`;
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Erro ao executar automação de desktop: ${errorMessage}`;
    }
  }

  private runScript(
    action: string,
    windowTitle: string,
    targetText: string,
    payload: string,
    processId: number,
    outputPath: string,
  ): Promise<DesktopAutomationResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args: string[] = [
        '-ExecutionPolicy', 'Bypass',
        '-File', this.scriptPath,
        '-Action', action,
      ];

      if (windowTitle) {
        args.push('-WindowTitle', windowTitle);
      }

      if (processId > 0) {
        args.push('-ProcessId', String(processId));
      }

      if (targetText) {
        args.push('-TargetText', targetText);
      }

      if (payload) {
        args.push('-Payload', payload);
      }

      if (outputPath) {
        args.push('-OutputPath', outputPath);
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
            const parsed = JSON.parse(stdout.trim()) as DesktopAutomationResult;
            resolve(parsed);
          } catch (parseError: unknown) {
            const msg = parseError instanceof Error ? parseError.message : String(parseError);
            reject(new Error(`Falha ao interpretar resposta do script: ${msg}`));
          }
        },
      );
    });
  }

  private validateUiSafety(action: string, windowTitle: string, payload: string): string | null {
    if (windowTitle && BLOCKED_WINDOW_TITLE_PATTERNS.some((pattern) => pattern.test(windowTitle))) {
      const decision = decideSecurityPolicy({
        surface: 'desktop-automation',
        operation: action,
        target: windowTitle,
        blocked: true,
        risk: 'forbidden',
        rule: 'DESKTOP_SENSITIVE_WINDOW_BLOCKED',
        reasons: [`Janela sensivel ou console nao pode ser alvo ("${windowTitle}").`],
      });
      return `Automacao de desktop bloqueada: janela sensivel ou console nao pode ser alvo ("${windowTitle}"). ${formatSecurityPolicyReceipt(decision.receipt)}`;
    }

    if (action === 'press-key' && payload && BLOCKED_PRESS_KEY_PATTERNS.some((pattern) => pattern.test(payload))) {
      const decision = decideSecurityPolicy({
        surface: 'desktop-automation',
        operation: action,
        target: payload,
        blocked: true,
        risk: 'forbidden',
        rule: 'DESKTOP_SHELL_LAUNCHER_SHORTCUT_BLOCKED',
        reasons: ['Atalho de launcher/shell nao permitido.'],
      });
      return `Automacao de desktop bloqueada: atalho de launcher/shell nao permitido. ${formatSecurityPolicyReceipt(decision.receipt)}`;
    }

    decideSecurityPolicy({
      surface: 'desktop-automation',
      operation: action,
      target: windowTitle || payload || 'active-window',
      rule: 'DESKTOP_UI_ACTION_ALLOWED',
      reasons: ['A acao de automacao de desktop passou pelo filtro central de UI safety.'],
    });

    return null;
  }
}
