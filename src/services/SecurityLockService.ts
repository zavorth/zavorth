import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger.js';

const SALT = 'zavorth-vritra-soulfire-2026';

export type LockState = {
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
};

/**
 * SecurityLockService — Tranca e destranca o Zavorth com senha.
 * 
 * Quando trancado:
 *   - Todos os comandos de execução são bloqueados
 *   - Apenas /unlock e /status funcionam
 *   - O status mostra "🔒 Trancado" sem revelar detalhes
 * 
 * Segurança:
 *   - Senha armazenada como hash SHA-256 com salt fixo
 *   - Mensagens com senha são apagadas automaticamente
 *   - Nenhum log registra a senha em texto
 */
export class SecurityLockService {
  private state: LockState = {
    locked: false,
    lockedAt: null,
    lockedBy: null,
  };

  private passwordHash: string | null = null;
  private readonly hashFilePath: string;

  constructor(dataDir?: string) {
    const dir = dataDir || path.resolve(process.cwd(), 'data');
    this.hashFilePath = path.join(dir, '.lock-hash');
    this.loadHash();
  }

  /**
   * Verifica se o bot está trancado.
   */
  public isLocked(): boolean {
    return this.state.locked;
  }

  /**
   * Retorna o estado atual do lock.
   */
  public getState(): LockState {
    return { ...this.state };
  }

  /**
   * Verifica se a senha já foi configurada.
   */
  public isPasswordConfigured(): boolean {
    return this.passwordHash !== null;
  }

  /**
   * Configura a senha pela primeira vez (ou redefine).
   * Retorna true se configurou com sucesso.
   */
  public setPassword(plainPassword: string): boolean {
    if (!plainPassword || plainPassword.length < 4) {
      return false;
    }

    this.passwordHash = this.hash(plainPassword);
    this.saveHash();
    return true;
  }

  /**
   * Tranca o bot.
   */
  public lock(userId?: string): LockState {
    this.state = {
      locked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: userId || null,
    };
    return this.getState();
  }

  /**
   * Tenta destrancar com a senha fornecida.
   * Retorna true se a senha está correta e o bot foi destrancado.
   */
  public unlock(plainPassword: string): boolean {
    if (!this.passwordHash) {
      return false;
    }

    const inputHash = this.hash(plainPassword);

    if (!crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(this.passwordHash))) {
      return false;
    }

    this.state = {
      locked: false,
      lockedAt: null,
      lockedBy: null,
    };

    return true;
  }

  /**
   * Verifica se um comando deve ser permitido quando trancado.
   */
  public isCommandAllowedWhenLocked(commandType: string): boolean {
    const allowed = new Set(['/unlock', '/status']);
    return allowed.has(commandType);
  }

  /**
   * Hash SHA-256 com salt fixo.
   */
  private hash(value: string): string {
    return crypto
      .createHash('sha256')
      .update(`${SALT}:${value}`)
      .digest('hex');
  }

  /**
   * Carrega o hash do disco (se existir).
   */
  private loadHash(): void {
    try {
      if (fs.existsSync(this.hashFilePath)) {
        const content = fs.readFileSync(this.hashFilePath, 'utf-8').trim();
        if (content.length === 64) {
          this.passwordHash = content;
        }
      }
    } catch (error) { // Silencioso — sem hash configurado logger.warn('[Security Lock] filesystem operation failed', error); }
  }

  /**
   * Salva o hash no disco.
   */
  private saveHash(): void {
    try {
      const dir = path.dirname(this.hashFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.hashFilePath, this.passwordHash || '', 'utf-8');
    } catch (error) { // Silencioso logger.warn('[Security Lock] filesystem operation failed', error); }
  }
}
