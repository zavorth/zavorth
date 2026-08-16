/**
 * Session Persistence Service.
 * Manages local session records, message history, forks, metrics, and session todos.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'node:crypto';

export interface SessionTokensUsage {
  input: number;
  output: number;
  reasoning: number;
  cache_read: number;
  cache_write: number;
}

export interface TodoRecord {
  id: string;
  sessionId: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  timeCreated: string;
  timeUpdated: string;
}

export interface SessionRecord {
  id: string;
  parentId?: string | null;
  title: string;
  directory: string;
  model: string;
  variant: string;
  cost: number;
  tokens: SessionTokensUsage;
  todos: TodoRecord[];
  messagesCount: number;
  timeCreated: string;
  timeUpdated: string;
}

export class SessionPersistenceService {
  private static storageDir: string | null = null;
  private static cache: Map<string, SessionRecord> = new Map();
  private static initialized = false;

  /**
   * Resolves storage directory for sessions (~/.zavorth/sessions or .zavorth/sessions).
   */
  static getStorageDir(): string {
    if (this.storageDir) return this.storageDir;
    const base = path.join(os.homedir(), '.zavorth', 'sessions');
    if (!fs.existsSync(base)) {
      try {
        fs.mkdirSync(base, { recursive: true });
      } catch {
        // Fallback to local cwd
        const local = path.join(process.cwd(), '.zavorth', 'sessions');
        fs.mkdirSync(local, { recursive: true });
        this.storageDir = local;
        return local;
      }
    }
    this.storageDir = base;
    return base;
  }

  private static getFilePath(id: string): string {
    return path.join(this.getStorageDir(), `${id}.json`);
  }

  private static init(): void {
    if (this.initialized) return;
    this.initialized = true;
    const dir = this.getStorageDir();
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
            const data: SessionRecord = JSON.parse(raw);
            if (data.id) {
              this.cache.set(data.id, data);
            }
          } catch {
            // Ignore malformed files
          }
        }
      }
    } catch {
      // Storage directory may be empty
    }
  }

  /**
   * Creates a new session record.
   */
  static createSession(params: Partial<SessionRecord> = {}): SessionRecord {
    this.init();
    const id = params.id || `ses_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const record: SessionRecord = {
      id,
      parentId: params.parentId || null,
      title: params.title || 'New Conversation',
      directory: params.directory || process.cwd(),
      model: params.model || 'Claude 3.7 Sonnet',
      variant: params.variant || 'medium',
      cost: params.cost || 0,
      tokens: params.tokens || {
        input: 0,
        output: 0,
        reasoning: 0,
        cache_read: 0,
        cache_write: 0,
      },
      todos: params.todos || [],
      messagesCount: params.messagesCount || 0,
      timeCreated: params.timeCreated || now,
      timeUpdated: now,
    };

    this.cache.set(id, record);
    this.saveToDisk(record);
    return record;
  }

  /**
   * Retrieves a session by ID.
   */
  static getSession(id: string): SessionRecord | null {
    this.init();
    return this.cache.get(id) || null;
  }

  /**
   * Lists all sessions sorted by last updated time (most recent first).
   */
  static listSessions(limit = 50): SessionRecord[] {
    this.init();
    return Array.from(this.cache.values())
      .sort((a, b) => new Date(b.timeUpdated).getTime() - new Date(a.timeUpdated).getTime())
      .slice(0, limit);
  }

  /**
   * Updates an existing session record.
   */
  static updateSession(id: string, updates: Partial<SessionRecord>): SessionRecord | null {
    this.init();
    const existing = this.cache.get(id);
    if (!existing) return null;

    const updated: SessionRecord = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      timeUpdated: new Date().toISOString(),
    };

    this.cache.set(id, updated);
    this.saveToDisk(updated);
    return updated;
  }

  /**
   * Forks a session into a child branch (for branching workflows).
   */
  static forkSession(parentId: string, newTitle?: string): SessionRecord | null {
    this.init();
    const parent = this.cache.get(parentId);
    if (!parent) return null;

    const forkId = `ses_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const forked: SessionRecord = {
      id: forkId,
      parentId: parent.id,
      title: newTitle || `Branch of ${parent.title}`,
      directory: parent.directory,
      model: parent.model,
      variant: parent.variant,
      cost: parent.cost,
      tokens: { ...parent.tokens },
      todos: parent.todos.map((t) => ({ ...t, id: `todo_${crypto.randomBytes(4).toString('hex')}` })),
      messagesCount: parent.messagesCount,
      timeCreated: now,
      timeUpdated: now,
    };

    this.cache.set(forkId, forked);
    this.saveToDisk(forked);
    return forked;
  }

  /**
   * Deletes a session by ID.
   */
  static deleteSession(id: string): boolean {
    this.init();
    if (!this.cache.has(id)) return false;
    this.cache.delete(id);
    try {
      const filePath = this.getFilePath(id);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Adds a todo task to a session.
   */
  static addTodo(sessionId: string, content: string): TodoRecord | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const todo: TodoRecord = {
      id: `todo_${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      content: content.trim(),
      status: 'pending',
      timeCreated: new Date().toISOString(),
      timeUpdated: new Date().toISOString(),
    };

    session.todos.push(todo);
    this.updateSession(sessionId, { todos: session.todos });
    return todo;
  }

  /**
   * Updates a todo status.
   */
  static updateTodoStatus(sessionId: string, todoId: string, status: TodoRecord['status']): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const todo = session.todos.find((t) => t.id === todoId || t.content.toLowerCase().includes(todoId.toLowerCase()));
    if (!todo) return false;

    todo.status = status;
    todo.timeUpdated = new Date().toISOString();
    this.updateSession(sessionId, { todos: session.todos });
    return true;
  }

  private static saveToDisk(record: SessionRecord): void {
    try {
      const filePath = this.getFilePath(record.id);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    } catch {
      // Non-blocking disk write
    }
  }

  /**
   * Resets in-memory cache and temporary test files (for testing).
   */
  static resetForTesting(): void {
    try {
      const dir = this.getStorageDir();
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.endsWith('.json') && f.startsWith('ses_')) {
            try {
              fs.unlinkSync(path.join(dir, f));
            } catch {
              // Ignore file lock in test
            }
          }
        }
      }
    } catch {
      // Ignore
    }
    this.cache.clear();
    this.initialized = false;
  }
}
