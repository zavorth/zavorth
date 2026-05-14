import { Database } from '../storage/Database.js';
import { ConfigVersioningService } from './ConfigVersioningService.js';
import { SecureStorageService } from './SecureStorageService.js';

export interface Snippet {
  id: number;
  user_id: string;
  name: string;
  content: string;
  created_at: string;
}

/**
 * SnippetService — Salva e recupera trechos de código/texto favoritos.
 */
export class SnippetService {
  private db!: Database;
  private initialized = false;
  private secureStorage = new SecureStorageService();
  private configVersioning = new ConfigVersioningService();

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_user_name
      ON snippets(user_id, name)
    `);
    this.initialized = true;
  }

  public async save(userId: string, name: string, content: string): Promise<Snippet> {
    await this.init();
    const normalizedName = name.trim();
    const normalizedContent = content.trim();

    if (!normalizedName || !normalizedContent) {
      throw new Error('Nome e conteudo do snippet precisam ser preenchidos.');
    }

    const existing = this.db.get<Snippet>(
      'SELECT * FROM snippets WHERE user_id = ? AND name = ? LIMIT 1',
      [userId, normalizedName]
    );

    if (existing) {
      this.db.run(
        'UPDATE snippets SET content = ?, created_at = ? WHERE user_id = ? AND name = ?',
        [this.secureStorage.encryptString(normalizedContent), new Date().toISOString(), userId, normalizedName]
      );
    } else {
      this.db.run(
        'INSERT INTO snippets (user_id, name, content, created_at) VALUES (?, ?, ?, ?)',
        [userId, normalizedName, this.secureStorage.encryptString(normalizedContent), new Date().toISOString()]
      );
    }

    const row = this.db.get<Snippet>(
      'SELECT * FROM snippets WHERE user_id = ? AND name = ? ORDER BY id DESC LIMIT 1',
      [userId, normalizedName]
    )!;
    const snippet = this.mapSnippet(row);
    void this.configVersioning.snapshot(`snippet-save:${normalizedName}`);
    return snippet;
  }

  public async get(userId: string, name: string): Promise<Snippet | undefined> {
    await this.init();
    const normalizedName = name.trim();
    const row = this.db.get<Snippet>(
      'SELECT * FROM snippets WHERE user_id = ? AND name = ? ORDER BY id DESC LIMIT 1',
      [userId, normalizedName]
    );
    return row ? this.mapSnippet(row) : undefined;
  }

  public async list(userId: string): Promise<Snippet[]> {
    await this.init();
    return this.db.all<Snippet>(
      'SELECT * FROM snippets WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    ).map((entry) => this.mapSnippet(entry));
  }

  public async delete(userId: string, name: string): Promise<boolean> {
    await this.init();
    const normalizedName = name.trim();
    const existing = await this.get(userId, normalizedName);
    if (!existing) return false;
    this.db.run('DELETE FROM snippets WHERE user_id = ? AND name = ?', [userId, normalizedName]);
    void this.configVersioning.snapshot(`snippet-delete:${normalizedName}`);
    return true;
  }

  private mapSnippet(row: Snippet): Snippet {
    return {
      ...row,
      content: this.secureStorage.decryptString(row.content) || '',
    };
  }
}
