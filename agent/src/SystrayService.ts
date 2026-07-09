import { EventEmitter } from 'events';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import SysTray from 'systray2';
import { t, getLanguages } from './i18n.js';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

type AgentTrayState = {
  backendOnline: boolean;
  gatewayOnline?: boolean;
  micActive: boolean;
  mode: 'idle' | 'listening' | 'processing' | 'offline';
  detail?: string;
  pendingApprovals?: number;
  budgetStatus?: 'allowed' | 'warned' | 'blocked' | 'unknown';
  lastFallback?: string | null;
  lastChannelTest?: string | null;
  lastMemoryReceipt?: string | null;
  lastRunId?: string | null;
  lastStatus?: string | null;
  configLang?: string;
};

type TrayNotificationEvent =
  | 'approval-pending'
  | 'gateway-fallback'
  | 'budget-blocked'
  | 'channel-test-result'
  | 'memory-mutation-receipt';

type TrayMenuItem = {
  title: string;
  tooltip: string;
  checked?: boolean;
  enabled?: boolean;
  hidden?: boolean;
  click?: () => void;
};

/**
 * System tray bridge for the Zavorth voice agent.
 */
export class SystrayService extends EventEmitter {
  private systray: any = null;
  private trayProcess: ReturnType<typeof exec> | null = null;
  private isRunning = false;
  private state: AgentTrayState = {
    backendOnline: false,
    micActive: false,
    mode: 'offline',
    configLang: 'auto',
  };

  public async start(): Promise<void> {
    if (this.isRunning) return;

    const started = await this.startWithSystray2();
    if (!started) {
      if (os.platform() === 'win32') {
        await this.startWithPowerShell();
      } else {
        console.warn('[Systray] Cross-platform systray2 failed, and PowerShell fallback is not supported on this OS.');
      }
    }
  }

  public stop(): void {
    if (this.systray) {
      try {
        this.systray.kill(false);
      } catch { /* ignore */ }
      this.systray = null;
    }

    if (this.trayProcess) {
      this.trayProcess.kill();
      this.trayProcess = null;
    }

    this.isRunning = false;
  }

  public updateState(patch: Partial<AgentTrayState>): void {
    const langChanged = patch.configLang !== undefined && patch.configLang !== this.state.configLang;
    this.state = { ...this.state, ...patch };
    this.setTooltip(this.buildTooltip());
    if (langChanged && !this.systray) {
      void this.rebuildPowerShellTray();
    }
  }

  public notify(event: TrayNotificationEvent, payload: Record<string, unknown> = {}): void {
    const safePayload = this.sanitizeNotificationPayload(payload);
    const notification = this.buildNotification(event, safePayload);

    if (event === 'approval-pending') {
      this.state.pendingApprovals = Number(this.state.pendingApprovals || 0) + 1;
    }
    if (event === 'gateway-fallback') {
      this.state.lastFallback = notification.body;
      this.state.gatewayOnline = true;
    }
    if (event === 'budget-blocked') {
      this.state.budgetStatus = 'blocked';
    }
    if (event === 'channel-test-result') {
      this.state.lastChannelTest = notification.body;
    }
    if (event === 'memory-mutation-receipt') {
      this.state.lastMemoryReceipt = String(safePayload.receiptId || 'memory receipt');
    }

    this.emit('notification', {
      event,
      ...notification,
      payload: safePayload,
    });
    this.setTooltip(this.buildTooltip());
    console.log(`[Systray] ${notification.title}: ${notification.body}`);
  }

  public setTooltip(text: string): void {
    if (!this.isRunning) {
      return;
    }

    if (this.systray) {
      try {
        this.rebuildSystrayMenu(text);
      } catch {
        // Tooltip updates are best effort.
      }
      return;
    }

    console.log(`[Systray] ${text}`);
  }

  public get active(): boolean {
    return this.isRunning;
  }

  private async startWithSystray2(): Promise<boolean> {
    const icon = this.resolveIconPath();
    if (!icon) {
      return false;
    }

    try {
      this.systray = new SysTray({
        menu: {
          icon,
          isTemplateIcon: os.platform() === 'darwin',
          title: 'Zavorth',
          tooltip: this.buildTooltip(),
          items: this.buildMenuItems(),
        },
        debug: false,
        copyDir: false,
      });

      this.systray.onClick((action: any) => {
        if (action.item?.click) {
          action.item.click();
        }
      });

      await this.systray.ready();
      this.isRunning = true;
      console.log('[Systray] systray2 started.');
      this.emit('ready');
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.log(`[Systray] systray2 unavailable: ${err.message}`);
      this.systray = null;
      return false;
    }
  }

  private rebuildSystrayMenu(tooltip: string): void {
    if (!this.systray) return;
    this.systray.sendAction({
      type: 'update-menu',
      menu: {
        icon: this.resolveIconPath(),
        isTemplateIcon: os.platform() === 'darwin',
        title: 'Zavorth',
        tooltip,
        items: this.buildMenuItems(),
      },
    });
  }

  private buildMenuItems(): any[] {
    const configLang = this.state.configLang || 'auto';
    const languages = getLanguages();

    const langSubmenuItems = [
      {
        title: 'Auto (System Language)',
        tooltip: 'Detect system language automatically',
        checked: configLang === 'auto',
        enabled: true,
        click: () => this.emit('change-lang', 'auto'),
      },
      ...Object.entries(languages).map(([code, friendlyName]) => ({
        title: friendlyName,
        tooltip: `Switch to ${friendlyName}`,
        checked: configLang === code,
        enabled: true,
        click: () => this.emit('change-lang', code),
      })),
    ];

    return [
      {
        title: this.state.backendOnline ? 'Backend online' : 'Backend offline',
        enabled: false,
        tooltip: this.state.detail || '',
      },
      {
        title: this.state.gatewayOnline === false ? 'Gateway offline' : 'Gateway online',
        enabled: false,
        tooltip: 'Local gateway status',
      },
      {
        title: this.state.micActive ? t('tray_mic_active') : t('tray_mic_disabled'),
        tooltip: 'Microphone status',
        enabled: false,
      },
      {
        title: `Budget: ${this.state.budgetStatus || 'unknown'}`,
        tooltip: 'AI Gateway budget status',
        enabled: false,
      },
      {
        title: `Fallback: ${this.shortText(this.state.lastFallback, 'none')}`,
        tooltip: 'Last model fallback',
        enabled: false,
      },
      {
        title: `Echo: ${this.state.pendingApprovals || 0} approval(s) | run ${this.shortId(this.state.lastRunId)}`,
        tooltip: this.state.lastStatus ? t('tray_last_status', { status: this.state.lastStatus }) : t('tray_no_recent_run'),
        enabled: false,
      },
      {
        title: t('tray_status_title'),
        tooltip: t('tray_status_tooltip'),
        click: () => this.emit('status'),
      },
      {
        title: this.state.micActive ? t('tray_toggle_mic_off') : t('tray_toggle_mic_on'),
        tooltip: 'Toggle mic gate monitoring',
        click: () => this.emit('toggle-mic'),
      },
      {
        title: t('tray_open_dashboard'),
        tooltip: t('tray_open_dashboard_tooltip'),
        click: () => this.emit('open-dashboard'),
      },
      {
        title: t('tray_open_control'),
        tooltip: t('tray_open_control_tooltip'),
        click: () => this.emit('open-control'),
      },
      {
        title: 'Language / Idioma',
        tooltip: 'Select interface language / Selecionar idioma da interface',
        items: langSubmenuItems,
      },
      (SysTray as any).separator,
      {
        title: t('tray_exit'),
        tooltip: t('tray_exit_tooltip'),
        click: () => this.emit('exit'),
      },
    ];
  }

  private async startWithPowerShell(): Promise<void> {
    try {
      const psScript = this.buildPowerShellTrayScript();

      this.trayProcess = exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`,
        { timeout: 0 },
      );

      this.trayProcess.stdout?.on('data', (data: string) => {
        const action = data.toString().trim();
        if (action.startsWith('LANG_CHANGE:')) {
          const lang = action.split(':')[1];
          this.emit('change-lang', lang);
          return;
        }
        switch (action) {
          case 'TRAY_CLICK':
          case 'TRAY_STATUS':
            this.emit('status');
            break;
          case 'TRAY_EXIT':
            this.emit('exit');
            break;
          case 'TRAY_TOGGLE_MIC':
            this.emit('toggle-mic');
            break;
          case 'TRAY_OPEN_DASHBOARD':
            this.emit('open-dashboard');
            break;
          case 'TRAY_OPEN_CONTROL':
            this.emit('open-control');
            break;
          case 'TRAY_READY':
            this.isRunning = true;
            console.log('[Systray] PowerShell tray started.');
            this.emit('ready');
            break;
        }
      });

      this.trayProcess.on('exit', () => {
        this.isRunning = false;
        this.trayProcess = null;
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error(t('systray_icon_failed', { message: String(err.message || 'Unexpected error') }));
    }
  }

  private async rebuildPowerShellTray(): Promise<void> {
    if (os.platform() !== 'win32') return;
    if (this.trayProcess) {
      this.trayProcess.removeAllListeners('exit');
      this.trayProcess.kill();
      this.trayProcess = null;
      this.isRunning = false;
    }
    await this.startWithPowerShell();
  }

  private buildTooltip(): string {
    const backend = this.state.backendOnline ? 'backend online' : 'backend offline';
    const gateway = this.state.gatewayOnline === false ? 'gateway offline' : 'gateway online';
    const mic = this.state.micActive ? t('mic_active') : t('mic_disabled');
    const approvals = `${this.state.pendingApprovals || 0} approvals`;
    const budget = `budget ${this.state.budgetStatus || 'unknown'}`;
    const run = this.state.lastRunId ? `run ${this.shortId(this.state.lastRunId)}` : t('tray_no_recent_run');
    return `Zavorth Agent - ${this.state.mode} - ${backend} - ${gateway} - ${mic} - ${approvals} - ${budget} - ${run}`;
  }

  private shortId(value: string | null | undefined): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '-';
    }
    return normalized.length <= 12 ? normalized : `${normalized.slice(0, 8)}...`;
  }

  private shortText(value: string | null | undefined, fallback: string): string {
    const normalized = this.sanitizeNotificationText(value || '').trim();
    if (!normalized) {
      return fallback;
    }
    return normalized.length <= 28 ? normalized : `${normalized.slice(0, 25)}...`;
  }

  private buildNotification(event: TrayNotificationEvent, payload: Record<string, unknown>): { title: string; body: string } {
    if (event === 'approval-pending') {
      return {
        title: 'Zavorth needs approval',
        body: this.sanitizeNotificationText(String(payload.action || payload.summary || 'pending action')),
      };
    }
    if (event === 'gateway-fallback') {
      return {
        title: 'Model fallback used',
        body: this.sanitizeNotificationText(`${payload.from || 'primary'} -> ${payload.to || 'fallback'}`),
      };
    }
    if (event === 'budget-blocked') {
      return {
        title: 'Budget blocked call',
        body: this.sanitizeNotificationText(String(payload.reason || 'daily budget blocked')),
      };
    }
    if (event === 'channel-test-result') {
      return {
        title: 'Channel test finished',
        body: this.sanitizeNotificationText(`${payload.channelId || 'channel'}: ${payload.status || 'unknown'}`),
      };
    }
    return {
      title: 'Memory updated',
      body: this.sanitizeNotificationText(String(payload.receiptId || 'receipt created')),
    };
  }

  private sanitizeNotificationPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (/(prompt|memoryContent|content|secret|token|apiKey|authorization|password|path)/i.test(key)) {
        output[key] = '[redacted]';
      } else if (typeof value === 'string') {
        output[key] = this.sanitizeNotificationText(value);
      } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
        output[key] = value;
      }
    }
    return output;
  }

  private sanitizeNotificationText(value: string): string {
    return String(value || '')
      .replace(/[A-Za-z]:\\[^\n\r]+/g, '[local path]')
      .replace(/\/(?:Users|home|var|tmp|opt)\/[^\n\r\s]+/gi, '[local path]')
      .replace(/AIzaSy[A-Za-z0-9_-]{20,}/g, '[redacted-api-key]')
      .replace(/\b(sk|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{20,}\b/g, '[redacted-token]')
      .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[redacted-token]')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
  }

  private resolveIconPath(): string | null {
    const iconName = os.platform() === 'win32' ? 'zavorth.ico' : 'zavorth.png';
    const candidates = [
      path.join(process.cwd(), 'assets', iconName),
      path.join(process.cwd(), iconName),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  private buildPowerShellTrayScript(): string {
    const configLang = this.state.configLang || 'auto';
    const languages = getLanguages();

    let langItemsScript = '';
    
    // Add Auto item
    const autoCheckedStr = configLang === 'auto' ? '$true' : '$false';
    langItemsScript += `
      $autoItem = $langSubmenu.DropDownItems.Add('Auto (System Language)')
      $autoItem.Checked = ${autoCheckedStr}
      $autoItem.Add_Click({ Write-Host 'LANG_CHANGE:auto' })
    `;

    // Add each dynamic language
    for (const [code, friendlyName] of Object.entries(languages)) {
      const checkedStr = configLang === code ? '$true' : '$false';
      const escapeName = friendlyName.replace(/'/g, "''");
      langItemsScript += `
        $lang_${code} = $langSubmenu.DropDownItems.Add('${escapeName}')
        $lang_${code}.Checked = ${checkedStr}
        $lang_${code}.Add_Click({ Write-Host 'LANG_CHANGE:${code}' })
      `;
    }

    return `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing

      $icon = New-Object System.Windows.Forms.NotifyIcon
      $icon.Icon = [System.Drawing.SystemIcons]::Application
      $icon.Text = '${this.buildTooltip().replace(/'/g, "''")}'
      $icon.Visible = $true

      $menu = New-Object System.Windows.Forms.ContextMenuStrip
      $statusItem = $menu.Items.Add('${t('tray_status_title').replace(/'/g, "''")}')
      $statusItem.Add_Click({ Write-Host 'TRAY_STATUS' })
      $micItem = $menu.Items.Add('${(this.state.micActive ? t('tray_toggle_mic_off') : t('tray_toggle_mic_on')).replace(/'/g, "''")}')
      $micItem.Add_Click({ Write-Host 'TRAY_TOGGLE_MIC' })
      $dashItem = $menu.Items.Add('${t('tray_open_dashboard').replace(/'/g, "''")}')
      $dashItem.Add_Click({ Write-Host 'TRAY_OPEN_DASHBOARD' })
      $controlItem = $menu.Items.Add('${t('tray_open_control').replace(/'/g, "''")}')
      $controlItem.Add_Click({ Write-Host 'TRAY_OPEN_CONTROL' })
      
      $langSubmenu = New-Object System.Windows.Forms.ToolStripMenuItem('Language / Idioma')
      ${langItemsScript}
      [void]$menu.Items.Add($langSubmenu)

      $menu.Items.Add('-')
      $exitItem = $menu.Items.Add('${t('tray_exit').replace(/'/g, "''")}')
      $exitItem.Add_Click({
        Write-Host 'TRAY_EXIT'
        $icon.Visible = $false
        $icon.Dispose()
        [System.Windows.Forms.Application]::Exit()
      })

      $icon.ContextMenuStrip = $menu
      $icon.Add_Click({
        if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
          Write-Host 'TRAY_CLICK'
        }
      })

      Write-Host 'TRAY_READY'
      [System.Windows.Forms.Application]::Run()
    `.replace(/\n/g, '; ').replace(/;(\s*;)+/g, '; ').replace(/"/g, '\\"');
  }
}
