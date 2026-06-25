import { logger } from '../logger.js';
import { execFile } from 'child_process';

export class DndService {
  private static buffer: { chatId: string | number, message: string }[] = [];
  private static manualDnd = false;
  private static watcher: NodeJS.Timeout | null = null;
  public static botApiAccessor: any = null;
  private static lastUserMessageTime = 0;

  private static cachedDndState = false;
  private static lastCheckTime = 0;

  public static markUserActive() {
    this.lastUserMessageTime = Date.now();
  }

  public static toggleManualDnd(): boolean {
    this.manualDnd = !this.manualDnd;
    return this.manualDnd;
  }

  public static async isDndActive(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return false;
    }

    // Se o usuario mandou mensagem no Telegram nos ultimos 60 segundos, ele esta com o celular na mao e quer respostas, bypass no DND.
    if (Date.now() - this.lastUserMessageTime < 60000) {
      return false;
    }

    if (this.manualDnd) return true;
    
    // Cache the DND result for 5 seconds to avoid freezing the Node Event Loop with exec calls
    if (Date.now() - this.lastCheckTime < 5000) {
       return this.cachedDndState;
    }

    this.lastCheckTime = Date.now();

    return new Promise((resolve) => {
      const psScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win {
            [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
            [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
            [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
        }
"@
        $hwnd = [Win]::GetForegroundWindow()
        if ($hwnd -eq 0) { Write-Output "false"; exit }
        $rect = New-Object Win+RECT
        [Win]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
        $w = $rect.Right - $rect.Left
        $h = $rect.Bottom - $rect.Top
        $sw = [Win]::GetSystemMetrics(0)
        $sh = [Win]::GetSystemMetrics(1)
        if ($w -ge $sw -and $h -ge $sh -and $w -gt 0) { Write-Output "true" } else { Write-Output "false" }
      `;
      execFile('powershell.exe', ['-NoProfile', '-Command', psScript], { windowsHide: true }, (err, stdout) => {
        if (err) {
           this.cachedDndState = false;
           return resolve(false);
        }
        this.cachedDndState = stdout.trim() === 'true';
        resolve(this.cachedDndState);
      });
    });
  }

  public static async queueMessageOrSend(botApi: any, chatId: string | number, message: string, originalSenderId?: string): Promise<boolean> {
    const isDnd = await this.isDndActive();
    if (isDnd) {
      this.buffer.push({ chatId, message });
      return true; // was queued
    }
    return false; // not queued, proceed normal sending
  }

  public static getAndClearBuffer(): { chatId: string | number, message: string }[] {
    const copy = [...this.buffer];
    this.buffer = [];
    return copy;
  }

  public static startWatcher(botApi: any) {
    this.botApiAccessor = botApi;
    if (!this.watcher) {
      this.watcher = setInterval(async () => {
        if (this.buffer.length === 0) return;
        if (await this.isDndActive()) return;

        // Limpa e agrupa
        const messagesToFlush = this.getAndClearBuffer();
        const groupedByChat: Record<string, string[]> = {};
        for (const msg of messagesToFlush) {
          const key = String(msg.chatId);
          if (!groupedByChat[key]) groupedByChat[key] = [];
          groupedByChat[key].push(msg.message);
        }

        for (const [chatId, messages] of Object.entries(groupedByChat)) {
          const combined = "🔇 **Resumo do Modo Não Perturbe** (Janela Cheia Detectada)\n\n" + messages.map((m, i) => `🔹 [Notificação ${i+1}]\n${m}`).join("\n\n---\n");
          try {
            await this.botApiAccessor.sendMessage(chatId, combined.substring(0, 3900));
          } catch(e) {
             logger.warn("Falha ao flushar DND buffer: ", e);
          }
        }
      }, 15000);
    }
  }
}
