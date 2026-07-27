import { Database } from '../storage/Database.js';

interface WelcomeConfig {
  chat_id: string;
  welcome_message: string | null;
  goodbye_message: string | null;
  welcome_enabled: number;
  goodbye_enabled: number;
  delete_service_messages: number;
  updated_at: string;
}

interface GroupRulesConfig {
  chat_id: string;
  rules_text: string;
  updated_at: string;
}

/**
 * WelcomeService — gerencia mensagens de boas-vindas e despedida para grupos do Telegram.
 * Templates suportam variaveis: {name}, {username}, {group}, {id}
 */
export class WelcomeService {
  private db!: Database;
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_welcome (
        chat_id TEXT PRIMARY KEY,
        welcome_message TEXT,
        goodbye_message TEXT,
        welcome_enabled INTEGER NOT NULL DEFAULT 1,
        goodbye_enabled INTEGER NOT NULL DEFAULT 1,
        delete_service_messages INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS group_rules (
        chat_id TEXT PRIMARY KEY,
        rules_text TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.initialized = true;
  }

  public async setWelcomeMessage(chatId: string, template: string): Promise<void> {
    await this.init();
    this.upsertConfig(chatId, { welcome_message: template });
  }

  public async setGoodbyeMessage(chatId: string, template: string): Promise<void> {
    await this.init();
    this.upsertConfig(chatId, { goodbye_message: template });
  }

  public async setWelcomeEnabled(chatId: string, enabled: boolean): Promise<void> {
    await this.init();
    this.upsertConfig(chatId, { welcome_enabled: enabled ? 1 : 0 });
  }

  public async setGoodbyeEnabled(chatId: string, enabled: boolean): Promise<void> {
    await this.init();
    this.upsertConfig(chatId, { goodbye_enabled: enabled ? 1 : 0 });
  }

  public async setDeleteServiceMessages(chatId: string, enabled: boolean): Promise<void> {
    await this.init();
    this.upsertConfig(chatId, { delete_service_messages: enabled ? 1 : 0 });
  }

  public async getConfig(chatId: string): Promise<WelcomeConfig | null> {
    await this.init();
    return this.db.get<WelcomeConfig>(
      'SELECT * FROM group_welcome WHERE chat_id = ?',
      [chatId],
    ) || null;
  }

  public async setGroupRules(chatId: string, rulesText: string): Promise<void> {
    await this.init();
    this.upsertGroupRules(chatId, rulesText.trim());
  }

  public async getGroupRules(chatId: string): Promise<string | null> {
    await this.init();
    const config = this.db.get<GroupRulesConfig>(
      'SELECT * FROM group_rules WHERE chat_id = ?',
      [chatId],
    );
    return config?.rules_text || null;
  }

  public renderTemplate(
    template: string,
    vars: { name: string; username?: string; group?: string; id?: string },
  ): string {
    return template
      .replace(/\{name\}/gi, vars.name || 'Membro')
      .replace(/\{username\}/gi, vars.username ? `@${vars.username}` : vars.name || 'Membro')
      .replace(/\{group\}/gi, vars.group || 'o grupo')
      .replace(/\{id\}/gi, vars.id || '');
  }

  public getDefaultWelcomeMessage(): string {
    return '👋 Bem-vindo(a) ao grupo, {name}!';
  }

  public getDefaultGoodbyeMessage(): string {
    return '?? {name} left the group. See you!';
  }

  private upsertConfig(chatId: string, fields: Partial<WelcomeConfig>): void {
    const existing = this.db.get<WelcomeConfig>(
      'SELECT * FROM group_welcome WHERE chat_id = ?',
      [chatId],
    );

    if (existing) {
      const sets: string[] = [];
      const params: any[] = [];
      for (const [key, value] of Object.entries(fields)) {
        sets.push(`${key} = ?`);
        params.push(value);
      }
      sets.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(chatId);
      this.db.run(`UPDATE group_welcome SET ${sets.join(', ')} WHERE chat_id = ?`, params);
    } else {
      const allFields: any = {
        chat_id: chatId,
        welcome_message: null,
        goodbye_message: null,
        welcome_enabled: 1,
        goodbye_enabled: 1,
        delete_service_messages: 0,
        updated_at: new Date().toISOString(),
        ...fields,
      };
      this.db.run(
        `INSERT INTO group_welcome (chat_id, welcome_message, goodbye_message, welcome_enabled, goodbye_enabled, delete_service_messages, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [allFields.chat_id, allFields.welcome_message, allFields.goodbye_message,
         allFields.welcome_enabled, allFields.goodbye_enabled, allFields.delete_service_messages,
         allFields.updated_at],
      );
    }
  }

  private upsertGroupRules(chatId: string, rulesText: string): void {
    const existing = this.db.get<GroupRulesConfig>(
      'SELECT * FROM group_rules WHERE chat_id = ?',
      [chatId],
    );

    if (existing) {
      this.db.run(
        'UPDATE group_rules SET rules_text = ?, updated_at = ? WHERE chat_id = ?',
        [rulesText, new Date().toISOString(), chatId],
      );
      return;
    }

    this.db.run(
      'INSERT INTO group_rules (chat_id, rules_text, updated_at) VALUES (?, ?, ?)',
      [chatId, rulesText, new Date().toISOString()],
    );
  }
}
