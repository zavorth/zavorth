import { Database } from './Database.js';
import { SecureStorageService } from '../services/SecureStorageService.js';

export interface SystemLog {
  id?: number;
  timestamp?: string;
  level: 'info' | 'warn' | 'error' | 'security';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

export class LogRepository {
  private db!: Database;
  private secureStorage = new SecureStorageService();

  public async init(): Promise<void> {
    this.db = await Database.getInstance();
  }

  public log(level: SystemLog['level'], category: string, message: string, metadata?: Record<string, any>): void {
    if (!this.db) {
      const dbInstance = (Database as any).instance;
      if (dbInstance) {
        this.db = dbInstance;
      } else {
        if (level === 'error' || level === 'security') {
          console.warn(`[${level.toUpperCase()}] [${category}] ${message} (DB not ready)`);
        } else {
          console.log(`[${level.toUpperCase()}] [${category}] ${message} (DB not ready)`);
        }
        return;
      }
    }
    const encryptedMessage = this.secureStorage.encryptString(message);
    const metaStr = metadata ? this.secureStorage.encryptJson(metadata) : null;
    this.db.run(
      'INSERT INTO system_logs (level, category, message, metadata) VALUES (?, ?, ?, ?)',
      [level, category, encryptedMessage, metaStr]
    );
    if (level === 'error' || level === 'security') {
      console.warn(`[${level.toUpperCase()}] [${category}] ${message}`);
    } else {
      console.log(`[${level.toUpperCase()}] [${category}] ${message}`);
    }
  }

  public getRecentLogs(limit: number = 50): SystemLog[] {
    const raw = this.db.all('SELECT * FROM system_logs ORDER BY id DESC LIMIT ?', [limit]);
    return raw.map((r: any) => ({
      ...r,
      message: this.secureStorage.decryptString(r.message) || '',
      metadata: r.metadata ? this.secureStorage.decryptJson(r.metadata) : undefined
    }));
  }
}
