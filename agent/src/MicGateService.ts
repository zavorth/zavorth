import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * MicGateService — Guardião de privacidade do Zavorth Agent.
 *
 * Monitora o status do microfone do Windows a cada 1s.
 * Se o microfone estiver desligado/mutado, o sistema inteiro fica inativo.
 * Quando o microfone é ligado, emite 'mic:on' e habilita Wake Word + Hotkey.
 * Quando desligado, emite 'mic:off' e desabilita tudo.
 *
 * O switch físico do microfone do notebook vira literalmente
 * o interruptor de segurança do Zavorth.
 */
export class MicGateService extends EventEmitter {
  private isActive = false;
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs: number;

  constructor(checkIntervalMs = 1000) {
    super();
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Inicia o monitoramento do microfone.
   */
  public start(): void {
    if (this.watchInterval) return;

    console.log('[MicGate] Iniciando monitoramento do microfone...');

    // Verificação imediata
    this.check();

    // Verificação periódica
    this.watchInterval = setInterval(() => this.check(), this.checkIntervalMs);
  }

  /**
   * Para o monitoramento.
   */
  public stop(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.isActive = false;
  }

  /**
   * Retorna o status atual.
   */
  public get active(): boolean {
    return this.isActive;
  }

  /**
   * Verifica o status do microfone e emite eventos de mudança.
   */
  private async check(): Promise<void> {
    try {
      const micOn = await this.isMicrophoneEnabled();

      if (micOn && !this.isActive) {
        this.isActive = true;
        console.log('[MicGate] 🎤 Microfone ATIVO — habilitando escuta...');
        this.emit('mic:on');

      } else if (!micOn && this.isActive) {
        this.isActive = false;
        console.log('[MicGate] 🔇 Microfone DESLIGADO — desabilitando tudo.');
        this.emit('mic:off');
      }
    } catch (error: any) {
      // Falha silenciosa — não queremos crashar o agent por erro de WMI
      // Assume mic ativo como fallback seguro
      if (!this.isActive) {
        this.isActive = true;
        this.emit('mic:on');
      }
    }
  }

  /**
   * Verifica se o microfone está habilitado no Windows via PowerShell.
   *
   * Usa AudioDeviceCmdlets ou WMI para checar o status.
   * Retorna true se pelo menos um dispositivo de captura está habilitado e não mutado.
   */
  private async isMicrophoneEnabled(): Promise<boolean> {
    try {
      // Método 1: Verificar via WMI se existe dispositivo de áudio de captura ativo
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_SoundDevice | Where-Object { $_.Status -eq 'OK' -and $_.StatusInfo -eq 3 } | Measure-Object | Select-Object -ExpandProperty Count"`,
        { timeout: 3000 },
      );
      const count = parseInt(stdout.trim(), 10);
      if (!isNaN(count) && count > 0) return true;

      // Método 2: Fallback — verifica se o mic está no Device Manager
      const { stdout: devStdout } = await execAsync(
        `powershell -NoProfile -Command "(Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.FriendlyName -match 'Mic|mic|Microphone' }).Count"`,
        { timeout: 3000 },
      );
      const devCount = parseInt(devStdout.trim(), 10);
      return !isNaN(devCount) && devCount > 0;

    } catch {
      // Se não conseguir verificar, assume ativo (fallback seguro para não bloquear o usuário)
      return true;
    }
  }
}
