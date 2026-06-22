import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface ScreenshotResult {
  success: boolean;
  image_base64?: string;
  error?: string;
}

interface ClickResult {
  success: boolean;
  action_performed: string;
  error?: string;
}

export class ZavorthComputerUseTool extends BaseTool {
  public readonly name = 'zavorth_computer_use';

  public readonly description =
    'Controla o desktop do usuario via screenshot + interacao. Permite capturar tela, clicar, digitar, arrastar, rolar, usar atalhos e navegar por coordenadas. Integrado ao ComputerControlPlane e approval system do Zavorth.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'screenshot', 'click', 'double_click', 'right_click', 'type', 'press_key', 'scroll', 'drag', 'move_mouse', 'find_on_screen', 'wait', 'get_screen_size'.",
      },
      x: {
        type: 'number',
        description: 'Coordenada X do pixel.',
      },
      y: {
        type: 'number',
        description: 'Coordenada Y do pixel.',
      },
      x2: {
        type: 'number',
        description: 'Coordenada X2 de destino (para drag).',
      },
      y2: {
        type: 'number',
        description: 'Coordenada Y2 de destino (para drag).',
      },
      text: {
        type: 'string',
        description: 'Texto para digitar ou procurar na tela.',
      },
      key: {
        type: 'string',
        description: "Tecla para pressionar: 'enter', 'tab', 'escape', 'backspace', 'delete', 'space', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown', 'f1'-'f12', ou combinacao como 'ctrl+c', 'cmd+shift+a'.",
      },
      direction: {
        type: 'string',
        description: "Direcao do scroll: 'up', 'down', 'left', 'right'.",
      },
      amount: {
        type: 'number',
        description: 'Quantidade de scroll (clicks/linhas). Default: 3.',
      },
      wait_ms: {
        type: 'number',
        description: 'Tempo de espera em ms (para wait). Default: 1000.',
      },
      confidence: {
        type: 'number',
        description: 'Nivel de confianca para find_on_screen (0-1). Default: 0.8.',
      },
      region: {
        type: 'string',
        description: "JSON {x, y, width, height} para restringir screenshot/find a uma regiao.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = [
      'screenshot', 'click', 'double_click', 'right_click', 'type',
      'press_key', 'scroll', 'drag', 'move_mouse', 'find_on_screen',
      'wait', 'get_screen_size',
    ];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
    }

    const dangerousKeys = ['alt+f4', 'cmd+q', 'ctrl+alt+delete', 'ctrl+c', 'cmd+c'];
    if (action === 'press_key' && typeof args.key === 'string') {
      const keyLower = args.key.toLowerCase();
      if (dangerousKeys.includes(keyLower)) {
        return `Erro: tecla "${args.key}" requer aprovacao explicita. Use zavorth_action com approval para teclas perigosas.`;
      }
    }

    try {
      switch (action) {
        case 'screenshot': return await this.screenshot(args);
        case 'click': return await this.click(args, 'left');
        case 'double_click': return await this.click(args, 'double');
        case 'right_click': return await this.click(args, 'right');
        case 'type': return await this.typeText(args);
        case 'press_key': return await this.pressKey(args);
        case 'scroll': return await this.scroll(args);
        case 'drag': return await this.drag(args);
        case 'move_mouse': return await this.moveMouse(args);
        case 'find_on_screen': return await this.findOnScreen(args);
        case 'wait': return this.wait(args);
        case 'get_screen_size': return await this.getScreenSize();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no ComputerUse: ${message}`;
    }
  }

  private async screenshot(args: Record<string, unknown>): Promise<string> {
    let region: { x: number; y: number; width: number; height: number } | undefined;
    if (typeof args.region === 'string') {
      try { region = JSON.parse(args.region); } catch { /* ignore */ }
    }

    const result = await this.executeDesktopCommand('screenshot', { region });
    if (!result.success) return `Erro ao capturar tela: ${result.error}`;

    return `Screenshot capturado com sucesso. Tamanho: ${result.image_base64 ? Math.round(result.image_base64.length * 0.75 / 1024) : 0}KB. Use a imagem para analise visual.`;
  }

  private async click(args: Record<string, unknown>, clickType: 'left' | 'double' | 'right'): Promise<string> {
    const x = Number(args.x);
    const y = Number(args.y);
    if (isNaN(x) || isNaN(y)) return 'Erro: "x" e "y" sao obrigatorios para click.';

    const result = await this.executeDesktopCommand('click', { x, y, click_type: clickType });
    if (!result.success) return `Erro ao clicar: ${result.error}`;

    const typeLabel = { left: 'clique', double: 'duplo-clique', right: 'clique-direito' }[clickType];
    return `${typeLabel} executado em (${x}, ${y}).`;
  }

  private async typeText(args: Record<string, unknown>): Promise<string> {
    const text = String(args.text || '');
    if (!text) return 'Erro: "text" e obrigatorio para type.';

    const result = await this.executeDesktopCommand('type', { text });
    if (!result.success) return `Erro ao digitar: ${result.error}`;

    return `Texto digitado: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`;
  }

  private async pressKey(args: Record<string, unknown>): Promise<string> {
    const key = String(args.key || '');
    if (!key) return 'Erro: "key" e obrigatorio para press_key.';

    const result = await this.executeDesktopCommand('press_key', { key });
    if (!result.success) return `Erro ao pressionar tecla: ${result.error}`;

    return `Tecla "${key}" pressionada.`;
  }

  private async scroll(args: Record<string, unknown>): Promise<string> {
    const direction = String(args.direction || 'down');
    const amount = Number(args.amount || 3);
    const x = typeof args.x === 'number' ? args.x : undefined;
    const y = typeof args.y === 'number' ? args.y : undefined;

    const result = await this.executeDesktopCommand('scroll', { direction, amount, x, y });
    if (!result.success) return `Erro ao rolar: ${result.error}`;

    return `Scroll ${direction} x${amount}${x !== undefined && y !== undefined ? ` em (${x}, ${y})` : ''}.`;
  }

  private async drag(args: Record<string, unknown>): Promise<string> {
    const x = Number(args.x);
    const y = Number(args.y);
    const x2 = Number(args.x2);
    const y2 = Number(args.y2);

    if (isNaN(x) || isNaN(y) || isNaN(x2) || isNaN(y2)) {
      return 'Erro: "x", "y", "x2", "y2" sao obrigatorios para drag.';
    }

    const result = await this.executeDesktopCommand('drag', { x, y, x2, y2 });
    if (!result.success) return `Erro ao arrastar: ${result.error}`;

    return `Arrastado de (${x}, ${y}) para (${x2}, ${y2}).`;
  }

  private async moveMouse(args: Record<string, unknown>): Promise<string> {
    const x = Number(args.x);
    const y = Number(args.y);
    if (isNaN(x) || isNaN(y)) return 'Erro: "x" e "y" sao obrigatorios para move_mouse.';

    const result = await this.executeDesktopCommand('move_mouse', { x, y });
    if (!result.success) return `Erro ao mover mouse: ${result.error}`;

    return `Mouse movido para (${x}, ${y}).`;
  }

  private async findOnScreen(args: Record<string, unknown>): Promise<string> {
    const text = String(args.text || '');
    if (!text) return 'Erro: "text" e obrigatorio para find_on_screen.';

    const confidence = typeof args.confidence === 'number' ? args.confidence : 0.8;

    const result = await this.executeDesktopCommand('find_on_screen', { text, confidence });
    if (!result.success) return `Erro ao procurar na tela: ${result.error}`;

    return `Elemento "${text}" encontrado na tela.`;
  }

  private async wait(args: Record<string, unknown>): Promise<string> {
    const waitMs = typeof args.wait_ms === 'number' ? args.wait_ms : 1000;
    if (waitMs > 30000) return 'Erro: wait maximo de 30 segundos.';
    if (waitMs < 0) return 'Erro: wait_ms deve ser positivo.';

    await new Promise(r => setTimeout(r, waitMs));
    return `Aguardado ${waitMs}ms.`;
  }

  private async getScreenSize(): Promise<string> {
    const result = await this.executeDesktopCommand('get_screen_size', {});
    if (!result.success) return `Erro ao obter tamanho da tela: ${result.error}`;

    return `Tamanho da tela obtido.`;
  }

  private async executeDesktopCommand(
    command: string,
    params: Record<string, unknown>,
  ): Promise<ClickResult & Partial<ScreenshotResult>> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return this.executeMacOS(command, params);
    } else if (platform === 'win32') {
      return this.executeWindows(command, params);
    } else if (platform === 'linux') {
      return this.executeLinux(command, params);
    }

    return { success: false, action_performed: command, error: `Plataforma "${platform}" nao suportada.` };
  }

  private async executeMacOS(command: string, params: Record<string, unknown>): Promise<ClickResult & Partial<ScreenshotResult>> {
    const { execFileSync } = require('child_process');
    const os = require('os');

    try {
      switch (command) {
        case 'screenshot': {
          const tmpFile = path.join(os.tmpdir(), `zavorth_screenshot_${Date.now()}.png`);
          try {
            execFileSync('screencapture', ['-x', tmpFile], { timeout: 10000 });
            const fs = require('fs');
            const buffer = fs.readFileSync(tmpFile);
            return { success: true, action_performed: 'screenshot', image_base64: buffer.toString('base64') };
          } finally {
            try { require('fs').unlinkSync(tmpFile); } catch { /* ignore */ }
          }
        }
        case 'click': {
          const { x, y, click_type } = params;
          const clickCount = click_type === 'double' ? 2 : 1;
          const button = click_type === 'right' ? 'rc' : 'c';
          execFileSync('cliclick', [button + ':' + x + ',' + y], { timeout: 5000 });
          if (clickCount === 2) execFileSync('cliclick', ['dc:' + x + ',' + y], { timeout: 5000 });
          return { success: true, action_performed: `click_${click_type} at (${x},${y})` };
        }
        case 'type': {
          const { text } = params;
          execFileSync('cliclick', ['t:' + String(text)], { timeout: 10000 });
          return { success: true, action_performed: 'type' };
        }
        case 'press_key': {
          const { key } = params;
          execFileSync('cliclick', ['kp:' + key], { timeout: 5000 });
          return { success: true, action_performed: `press_key ${key}` };
        }
        case 'scroll': {
          const { direction, amount, x, y } = params;
          const scrollDir = direction === 'up' ? '+' : '-';
          if (x !== undefined && y !== undefined) {
            execFileSync('cliclick', ['m:' + x + ',' + y], { timeout: 5000 });
          }
          execFileSync('cliclick', [scrollDir + String(amount)], { timeout: 5000 });
          return { success: true, action_performed: `scroll ${direction} ${amount}` };
        }
        case 'get_screen_size': {
          const result = execFileSync('system_profiler', ['SPDisplaysDataType'], { timeout: 5000 }).toString();
          const resolution = result.split('\n').find((l: string) => l.includes('Resolution'));
          return { success: true, action_performed: `screen_size: ${(resolution || '').trim()}` };
        }
        default:
          return { success: false, action_performed: command, error: `Comando "${command}" nao suportado no macOS.` };
      }
    } catch (error: unknown) {
      return { success: false, action_performed: command, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeWindows(command: string, params: Record<string, unknown>): Promise<ClickResult & Partial<ScreenshotResult>> {
    const { execFileSync } = require('child_process');
    const os = require('os');

    try {
      switch (command) {
        case 'screenshot': {
          const tmpFile = path.join(os.tmpdir(), `zavorth_screenshot_${Date.now()}.png`);
          const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('${tmpFile.replace(/\\/g, '\\\\')}'); $g.Dispose(); $b.Dispose()`;
          try {
            execFileSync('powershell', ['-Command', script], { timeout: 15000 });
            const fs = require('fs');
            const buffer = fs.readFileSync(tmpFile);
            return { success: true, action_performed: 'screenshot', image_base64: buffer.toString('base64') };
          } finally {
            try { require('fs').unlinkSync(tmpFile); } catch { /* ignore */ }
          }
        }
        case 'click': {
          const { x, y, click_type } = params;
          const clickCount = click_type === 'double' ? 2 : 1;
          const downFlag = click_type === 'right' ? '0x0008' : '0x0002';
          const upFlag = click_type === 'right' ? '0x0010' : '0x0004';
          const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); Start-Sleep -Milliseconds 50; $sig=@'[DllImport("user32.dll")]public static extern void mouse_event(uint dwFlags,int dx,int dy,uint dwData,int dwExtraInfo);'@; $t=Add-Type -MemberDefinition $sig -Name 'Mouse' -Namespace 'Win32' -PassThru; $t::mouse_event(${downFlag},0,0,0,0); $t::mouse_event(${upFlag},0,0,0,0)`;
          execFileSync('powershell', ['-Command', script], { timeout: 10000 });
          if (clickCount === 2) {
            const dblScript = `Start-Sleep -Milliseconds 50; $sig=@'[DllImport("user32.dll")]public static extern void mouse_event(uint dwFlags,int dx,int dy,uint dwData,int dwExtraInfo);'@; $t=Add-Type -MemberDefinition $sig -Name 'Mouse2' -Namespace 'Win32' -PassThru; $t::mouse_event(0x0002,0,0,0,0); $t::mouse_event(0x0004,0,0,0,0)`;
            execFileSync('powershell', ['-Command', dblScript], { timeout: 10000 });
          }
          return { success: true, action_performed: `click_${click_type} at (${x},${y})` };
        }
        case 'type': {
          const { text } = params;
          const escaped = String(text).replace(/'/g, "''");
          const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
          execFileSync('powershell', ['-Command', script], { timeout: 10000 });
          return { success: true, action_performed: 'type' };
        }
        case 'press_key': {
          const { key } = params;
          const keyMap: Record<string, string> = {
            enter: '{ENTER}', tab: '{TAB}', escape: '{ESC}', backspace: '{BACKSPACE}',
            delete: '{DELETE}', space: ' ', up: '{UP}', down: '{DOWN}',
            left: '{LEFT}', right: '{RIGHT}', home: '{HOME}', end: '{END}',
            pageup: '{PGUP}', pagedown: '{PGDN}',
          };
          const sendKey = keyMap[String(key).toLowerCase()] || String(key);
          const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')`;
          execFileSync('powershell', ['-Command', script], { timeout: 5000 });
          return { success: true, action_performed: `press_key ${key}` };
        }
        case 'scroll': {
          const { direction, amount } = params;
          const scrollAmount = direction === 'up' ? Number(amount) * 120 : -Number(amount) * 120;
          const script = `$sig=@'[DllImport("user32.dll")]public static extern void mouse_event(uint dwFlags,int dx,int dy,int dwData,int dwExtraInfo);'@; $t=Add-Type -MemberDefinition $sig -Name 'Scroll' -Namespace 'Win32' -PassThru; $t::mouse_event(0x0800,0,0,${scrollAmount},0)`;
          execFileSync('powershell', ['-Command', script], { timeout: 5000 });
          return { success: true, action_performed: `scroll ${direction} ${amount}` };
        }
        case 'get_screen_size': {
          const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | Select-Object Width,Height | ConvertTo-Json`;
          const result = execFileSync('powershell', ['-Command', script], { timeout: 5000 }).toString();
          return { success: true, action_performed: `screen_size: ${result.trim()}` };
        }
        default:
          return { success: false, action_performed: command, error: `Comando "${command}" nao suportado no Windows.` };
      }
    } catch (error: unknown) {
      return { success: false, action_performed: command, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeLinux(command: string, params: Record<string, unknown>): Promise<ClickResult & Partial<ScreenshotResult>> {
    const { execFileSync } = require('child_process');
    const os = require('os');

    try {
      switch (command) {
        case 'screenshot': {
          const tmpFile = path.join(os.tmpdir(), `zavorth_screenshot_${Date.now()}.png`);
          try {
            try {
              execFileSync('import', ['-window', 'root', tmpFile], { timeout: 10000 });
            } catch {
              execFileSync('scrot', [tmpFile], { timeout: 10000 });
            }
            const fs = require('fs');
            const buffer = fs.readFileSync(tmpFile);
            return { success: true, action_performed: 'screenshot', image_base64: buffer.toString('base64') };
          } finally {
            try { require('fs').unlinkSync(tmpFile); } catch { /* ignore */ }
          }
        }
        case 'click': {
          const { x, y, click_type } = params;
          const button = click_type === 'right' ? 3 : 1;
          const clickCount = click_type === 'double' ? 2 : 1;
          execFileSync('xdotool', ['mousemove', String(x), String(y), 'click', '--repeat', String(clickCount), String(button)], { timeout: 5000 });
          return { success: true, action_performed: `click_${click_type} at (${x},${y})` };
        }
        case 'type': {
          const { text } = params;
          execFileSync('xdotool', ['type', '--clearmodifiers', String(text)], { timeout: 10000 });
          return { success: true, action_performed: 'type' };
        }
        case 'press_key': {
          const { key } = params;
          execFileSync('xdotool', ['key', '--clearmodifiers', String(key)], { timeout: 5000 });
          return { success: true, action_performed: `press_key ${key}` };
        }
        case 'scroll': {
          const { direction, amount } = params;
          const button = direction === 'up' ? 4 : 5;
          for (let i = 0; i < Number(amount); i++) {
            execFileSync('xdotool', ['click', String(button)], { timeout: 5000 });
          }
          return { success: true, action_performed: `scroll ${direction} ${amount}` };
        }
        case 'get_screen_size': {
          const result = execFileSync('xdotool', ['getdisplaygeometry'], { timeout: 5000 }).toString();
          return { success: true, action_performed: `screen_size: ${result.trim()}` };
        }
        default:
          return { success: false, action_performed: command, error: `Comando "${command}" nao suportado no Linux.` };
      }
    } catch (error: unknown) {
      return { success: false, action_performed: command, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
