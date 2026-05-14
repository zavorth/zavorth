import * as fs from 'fs';
import * as path from 'path';
import { SecurityLockService } from '../services/SecurityLockService.js';

/**
 * HoneypotMonitor - Cria e vigia arquivos "canario" (iscas).
 *
 * A vigilancia acontece no diretorio, nao no arquivo em si, para que o
 * monitor sobreviva a delete/rename/recreate do arquivo isca.
 *
 * IMPORTANTE: O honeypot NUNCA tranca o bot sozinho.
 * Ele apenas envia um alerta ao admin para que este decida o que fazer.
 */
export class HoneypotMonitor {
  private readonly honeyPath: string;
  private readonly dirPath: string;
  private watcher: fs.FSWatcher | null = null;
  private triggeredAt = 0;

  /**
   * Timestamp da ultima escrita feita pelo proprio monitor.
   * Eventos do watcher que chegam ate SELF_WRITE_WINDOW_MS apos
   * essa marca sao considerados auto-gerados e ignorados.
   */
  private lastSelfWriteAt = 0;
  private static readonly SELF_WRITE_WINDOW_MS = 300;

  /**
   * Timestamp de quando o monitor foi iniciado.
   * Eventos nos primeiros GRACE_MS milissegundos sao ignorados
   * para absorver ruido do filesystem no startup.
   */
  private startedAt = 0;
  private static readonly GRACE_MS = 2000;

  constructor(
    private securityLock: SecurityLockService,
    private botAlertCallback: (message: string) => Promise<void>,
    dataDir?: string,
  ) {
    this.dirPath = dataDir || path.resolve(process.cwd(), 'data');
    this.honeyPath = path.join(this.dirPath, 'secrets_honey.txt');
  }

  public start(): void {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }

      this.stop();
      this.createDecoyFile();
      this.startedAt = Date.now();

      const honeyFileName = path.basename(this.honeyPath);

      this.watcher = fs.watch(this.dirPath, { persistent: false }, async (eventType, filename) => {
        // Ignora eventos gerados pela propria escrita do monitor
        if (Date.now() - this.lastSelfWriteAt < HoneypotMonitor.SELF_WRITE_WINDOW_MS) {
          return;
        }

        const normalizedName = String(filename ?? '').replace(/\u0000/g, '');

        if (normalizedName && path.basename(normalizedName) !== honeyFileName) {
          return;
        }

        await this.handleAccess(eventType);
      });

      this.watcher.on('error', (err) => {
        console.error('Erro no watcher do Honeypot:', err);
      });

      console.log('Honeypot armado em:', this.honeyPath);
    } catch (error) {
      console.error('Falha ao iniciar Honeypot:', error);
    }
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private createDecoyFile(): void {
    const decoyContent = [
      '# MIGRATED SECRETS - DO NOT DELETE',
      '# This file contains unencrypted legacy backups of API keys.',
      'GEMINI_MASTER_KEY=<decoy-gemini-key-redacted>',
      'OPENAI_ADMIN_KEY=<decoy-openai-key-redacted>',
      'DB_ROOT_PASSWORD=<decoy-password-redacted>',
      'SSH_PRIVATE_KEY_PASSPHRASE=zavorth_is_watching',
    ].join('\n');

    try {
      fs.writeFileSync(this.honeyPath, decoyContent, 'utf-8');
      this.lastSelfWriteAt = Date.now();
    } catch (error) {
      console.error('Falha ao escrever a isca:', error);
    }
  }

  private async handleAccess(eventType: string): Promise<void> {
    // O self-healing da isca nao deve depender do debounce.
    if (eventType === 'rename' || !fs.existsSync(this.honeyPath)) {
      this.createDecoyFile();
      // Retorna sem alertar porque o evento foi gerado pela recriacao.
      return;
    }

    // Debounce do alerta para nao floodar o operador.
    const now = Date.now();

    // Grace period no startup para absorver ruido do FS
    if (now - this.startedAt < HoneypotMonitor.GRACE_MS) {
      return;
    }

    if (now - this.triggeredAt < 30000) {
      return;
    }
    this.triggeredAt = now;

    // NUNCA tranca o bot automaticamente.
    // Apenas envia um aviso ao admin para que ele decida.
    try {
      const alertMessage =
        `⚠️ **AVISO DE SEGURANCA: Honeypot Acionado** ⚠️\n\n` +
        `O arquivo canario sensivel (\`secrets_honey.txt\`) foi acessado.\n` +
        `Isso pode indicar que um agente autonomo esta explorando diretorios.\n\n` +
        `ℹ️ O Zavorth **continua operando normalmente**.\n` +
        `Se necessario, use \`/lock\` para trancar manualmente.`;

      await this.botAlertCallback(alertMessage);
      console.warn('Honeypot: acesso detectado no arquivo canario (apenas alerta, sem lock).');
    } catch (error: any) {
      console.error('Falha ao processar alerta de honeypot:', error.message);
    }
  }
}
