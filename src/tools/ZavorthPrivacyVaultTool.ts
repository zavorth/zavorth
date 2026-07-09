import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface VaultEntry {
  id: string;
  name: string;
  category: 'api_key' | 'token' | 'password' | 'certificate' | 'ssh_key' | 'connection_string' | 'other';
  encrypted_value: string;
  iv: string;
  created_at: string;
  updated_at: string;
  last_accessed: string | null;
  access_count: number;
  expires_at: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export class ZavorthPrivacyVaultTool extends BaseTool {
  public readonly name = 'zavorth_privacy_vault';

  public readonly description =
    'Privacy Vault — encrypted storage for secrets, API keys, credentials with audit logging, rotation, and access control.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'store', 'retrieve', 'list', 'delete', 'rotate', 'search', 'export', 'audit_log'.",
      },
      name: {
        type: 'string',
        description: 'Name/label for the secret.',
      },
      value: {
        type: 'string',
        description: 'Secret value to store.',
      },
      category: {
        type: 'string',
        description: "Category: 'api_key', 'token', 'password', 'certificate', 'ssh_key', 'connection_string', 'other'.",
      },
      secret_id: {
        type: 'string',
        description: 'Secret ID for retrieve/delete/rotate.',
      },
      tags: {
        type: 'string',
        description: 'JSON array of tags.',
      },
      expires_in_days: {
        type: 'number',
        description: 'Days until expiration.',
      },
      new_value: {
        type: 'string',
        description: 'New value for rotate action.',
      },
      query: {
        type: 'string',
        description: 'Search query.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private readonly vaultPath: string;
  private readonly auditPath: string;
  private readonly algorithm = 'aes-256-cbc';
  private encryptionKey: Buffer;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'vault');
    this.vaultPath = path.join(this.storageDir, 'vault.enc');
    this.auditPath = path.join(this.storageDir, 'audit.json');
    this.ensureDir();
    this.encryptionKey = this.deriveKey();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private deriveKey(): Buffer {
    const keyPath = path.join(this.storageDir, '.vault-key');
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key);
    return key;
  }

  private encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encrypted, iv: iv.toString('hex') };
  }

  private decrypt(encrypted: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private loadVault(): VaultEntry[] {
    if (!fs.existsSync(this.vaultPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(this.vaultPath, 'utf-8'));
      return data as VaultEntry[];
    } catch (error: any) { logger.warn('[Zavorth Privacy Vault] JSON parse failed', error); return []; }
  }

  private saveVault(entries: VaultEntry[]): void {
    fs.writeFileSync(this.vaultPath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  private logAudit(action: string, entryId: string, details: string): void {
    let auditLog: Array<{ timestamp: string; action: string; entry_id: string; details: string }> = [];
    if (fs.existsSync(this.auditPath)) {
      try { auditLog = JSON.parse(fs.readFileSync(this.auditPath, 'utf-8')); } catch (error: any) { /* ignore */ logger.warn('[Zavorth Privacy Vault] JSON parse failed', error); }
    }
    auditLog.push({ timestamp: new Date().toISOString(), action, entry_id: entryId, details });
    fs.writeFileSync(this.auditPath, JSON.stringify(auditLog.slice(-500), null, 2), 'utf-8');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'store': return this.store(args);
      case 'retrieve': return this.retrieve(args);
      case 'list': return this.listEntries();
      case 'delete': return this.deleteEntry(args);
      case 'rotate': return this.rotate(args);
      case 'search': return this.search(args);
      case 'export': return this.exportVault();
      case 'audit_log': return this.getAuditLog();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private store(args: Record<string, unknown>): string {
    const name = String(args.name || '');
    const value = String(args.value || '');
    if (!name) return 'Error: "name" is required.';
    if (!value) return 'Error: "value" is required.';

    const { encrypted, iv } = this.encrypt(value);
    const category = String(args.category || 'other') as VaultEntry['category'];
    let tags: string[] = [];
    if (typeof args.tags === 'string') { try { tags = JSON.parse(args.tags); } catch (error: any) { /* ignore */ logger.warn('[Zavorth Privacy Vault] JSON parse failed', error); } }

    const expiresAt = typeof args.expires_in_days === 'number'
      ? new Date(Date.now() + args.expires_in_days * 86400000).toISOString()
      : null;

    const id = `vault_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry: VaultEntry = {
      id, name, category, encrypted_value: encrypted, iv,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_accessed: null, access_count: 0,
      expires_at: expiresAt, tags, metadata: {},
    };

    const entries = this.loadVault();
    entries.push(entry);
    this.saveVault(entries);
    this.logAudit('store', id, `Stored "${name}" (${category})`);

    return `Secret "${name}" stored with ID ${id}. Category: ${category}${expiresAt ? `, expires: ${expiresAt}` : ''}`;
  }

  private retrieve(args: Record<string, unknown>): string {
    const secretId = String(args.secret_id || '');
    if (!secretId) return 'Error: "secret_id" is required.';

    const entries = this.loadVault();
    const entry = entries.find((e) => e.id === secretId);
    if (!entry) return `Error: secret "${secretId}" not found.`;

    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      return `Error: secret "${secretId}" has expired.`;
    }

    const value = this.decrypt(entry.encrypted_value, entry.iv);
    entry.last_accessed = new Date().toISOString();
    entry.access_count++;
    this.saveVault(entries);
    this.logAudit('retrieve', secretId, `Retrieved "${entry.name}"`);

    return `Secret "${entry.name}": ${value}`;
  }

  private listEntries(): string {
    const entries = this.loadVault();
    if (entries.length === 0) return 'Vault is empty.';

    const lines: string[] = [`Vault Entries (${entries.length}):`];
    for (const e of entries) {
      const expired = e.expires_at && new Date(e.expires_at) < new Date() ? ' ⏰' : '';
      lines.push(`  ${e.id}: ${e.name} [${e.category}]${expired} accesses:${e.access_count}`);
    }
    return lines.join('\n');
  }

  private deleteEntry(args: Record<string, unknown>): string {
    const secretId = String(args.secret_id || '');
    if (!secretId) return 'Error: "secret_id" is required.';

    const entries = this.loadVault();
    const index = entries.findIndex((e) => e.id === secretId);
    if (index === -1) return `Error: secret "${secretId}" not found.`;

    const name = entries[index].name;
    entries.splice(index, 1);
    this.saveVault(entries);
    this.logAudit('delete', secretId, `Deleted "${name}"`);

    return `Secret "${name}" (${secretId}) deleted from vault.`;
  }

  private rotate(args: Record<string, unknown>): string {
    const secretId = String(args.secret_id || '');
    const newValue = String(args.new_value || '');
    if (!secretId) return 'Error: "secret_id" is required.';
    if (!newValue) return 'Error: "new_value" is required.';

    const entries = this.loadVault();
    const entry = entries.find((e) => e.id === secretId);
    if (!entry) return `Error: secret "${secretId}" not found.`;

    const { encrypted, iv } = this.encrypt(newValue);
    entry.encrypted_value = encrypted;
    entry.iv = iv;
    entry.updated_at = new Date().toISOString();
    this.saveVault(entries);
    this.logAudit('rotate', secretId, `Rotated "${entry.name}"`);

    return `Secret "${entry.name}" rotated successfully.`;
  }

  private search(args: Record<string, unknown>): string {
    const query = String(args.query || '').toLowerCase();
    if (!query) return 'Error: "query" is required.';

    const entries = this.loadVault();
    const results = entries.filter((e) =>
      e.name.toLowerCase().includes(query) ||
      e.category.includes(query) ||
      e.tags.some((t) => t.toLowerCase().includes(query))
    );

    if (results.length === 0) return `No secrets found for "${query}".`;

    const lines: string[] = [`Search results for "${query}" (${results.length}):`];
    for (const e of results) {
      lines.push(`  ${e.id}: ${e.name} [${e.category}]`);
    }
    return lines.join('\n');
  }

  private exportVault(): string {
    const entries = this.loadVault();
    const exportData = entries.map((e) => ({
      name: e.name,
      category: e.category,
      tags: e.tags,
      created_at: e.created_at,
    }));

    const outputPath = path.join(this.storageDir, 'vault-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return `Vault metadata exported to ${outputPath} (${entries.length} entries, values excluded for security).`;
  }

  private getAuditLog(): string {
    if (!fs.existsSync(this.auditPath)) return 'No audit log entries.';

    const log = JSON.parse(fs.readFileSync(this.auditPath, 'utf-8')) as Array<{
      timestamp: string; action: string; entry_id: string; details: string;
    }>;

    const lines: string[] = [`Audit Log (${log.length} entries):`];
    for (const entry of log.slice(-20)) {
      const icon = { store: '📥', retrieve: '📤', delete: '🗑️', rotate: '🔄' }[entry.action] || '📝';
      lines.push(`  ${icon} [${entry.timestamp}] ${entry.action}: ${entry.details}`);
    }
    return lines.join('\n');
  }
}
