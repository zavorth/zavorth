import { Database } from '../storage/Database.js';
import { buildUntrustedContextBlock, sanitizeTrustPlaneText } from '../runtime/agent/security/index.js';
import { SecureStorageService } from './SecureStorageService.js';
import { VectorEmbeddingService } from './VectorEmbeddingService.js';
import { logger } from '../logger.js';

const VECTOR_DIMENSIONS = 768; // text-embedding-04 utiliza 768 dimens??es

export interface MemoryEntry {
  id: number;
  user_id: string;
  key: string;
  value: string;
  category: string;
  embedding?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  event_type?: string | null;
}

type MemoryCandidate = {
  key: string;
  value: string;
  category: string;
};

/**
 * MemoryService — memória persistente do Zavorth entre conversas.
 * Agora mantém vetores locais para recuperação por similaridade.
 */
export class MemoryService {
  private db!: Database;
  private initialized = false;
  private secureStorage = new SecureStorageService();
  private embeddingService = new VectorEmbeddingService();

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        embedding TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, key)
      )
    `);
    this.ensureColumn('user_memory', 'embedding', 'TEXT');
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_memory_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        embedding TEXT,
        event_type TEXT NOT NULL DEFAULT 'superseded',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.ensureColumn('user_memory_history', 'embedding', 'TEXT');
    this.ensureColumn('user_memory_history', 'event_type', "TEXT NOT NULL DEFAULT 'superseded'");
    this.ensureColumn('user_memory_history', 'archived_at', "TEXT NOT NULL DEFAULT (datetime('now'))");
    this.db.run('CREATE INDEX IF NOT EXISTS idx_user_memory_history_user_key ON user_memory_history(user_id, key)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_user_memory_history_archived_at ON user_memory_history(archived_at DESC)');
    
    // Nexo Cognitivo - MCC Schema
    this.db.run(`
      CREATE TABLE IF NOT EXISTS mcc_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS mcc_edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        UNIQUE(source_node_id, target_node_id, relation_type)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_mcc_edges_source ON mcc_edges(source_node_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_mcc_edges_target ON mcc_edges(target_node_id)');

    this.initialized = true;
  }

  public async remember(userId: string, key: string, value: string, category = 'general'): Promise<void> {
    await this.init();
    const normalizedKey = key.trim().toLowerCase();
    const normalizedValue = value.trim();
    const normalizedCategory = category.trim().toLowerCase() || 'general';

    if (!normalizedKey || !normalizedValue) {
      throw new Error('Chave e valor da memoria precisam ser preenchidos.');
    }

    const encryptedValue = this.secureStorage.encryptString(normalizedValue);
    const vector = await this.generateEmbedding(`${normalizedKey}\n${normalizedCategory}\n${normalizedValue}`);
    const embedding = this.serializeEmbedding(vector);
    
    const existing = this.db.get<MemoryEntry>(
      'SELECT * FROM user_memory WHERE user_id = ? AND key = ?',
      [userId, normalizedKey],
    );

    if (existing) {
      const existingValue = this.secureStorage.decryptString(existing.value) || '';
      const existingCategory = String(existing.category || '').trim().toLowerCase() || 'general';
      if (existingValue !== normalizedValue || existingCategory !== normalizedCategory) {
        this.archiveEntry(existing, 'superseded');
      }
      this.db.run(
        'UPDATE user_memory SET value = ?, category = ?, embedding = ?, updated_at = ? WHERE user_id = ? AND key = ?',
        [encryptedValue, normalizedCategory, embedding, new Date().toISOString(), userId, normalizedKey],
      );
    } else {
      this.db.run(
        'INSERT INTO user_memory (user_id, key, value, category, embedding, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, normalizedKey, encryptedValue, normalizedCategory, embedding, new Date().toISOString(), new Date().toISOString()],
      );
    }
  }

  public async recall(userId: string, key: string): Promise<string | null> {
    await this.init();
    const normalizedKey = key.trim().toLowerCase();
    const entry = this.db.get<MemoryEntry>(
      'SELECT * FROM user_memory WHERE user_id = ? AND key = ?',
      [userId, normalizedKey],
    );
    return entry ? this.mapEntry(entry).value : null;
  }

  public async listAll(userId: string): Promise<MemoryEntry[]> {
    await this.init();
    return this.db.all<MemoryEntry>(
      'SELECT * FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50',
      [userId],
    ).map((entry) => this.mapEntry(entry));
  }

  public async listRelevant(userId: string, query: string, limit: number = 8): Promise<MemoryEntry[]> {
    await this.init();
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const queryTokens = this.extractSemanticTokens(normalizedQuery);
    if (queryTokens.length === 0) {
      return [];
    }

    const queryEmbedding = await this.generateEmbedding(normalizedQuery);
    const entries = this.db.all<MemoryEntry>(
      'SELECT * FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT 80',
      [userId],
    ).map((entry) => this.mapEntry(entry));

    return entries
      .map((entry) => ({
        entry,
        score: this.scoreMemoryEntry(entry, queryTokens, queryEmbedding),
      }))
      .filter((item) => item.score > 0.45) // Threshold mais alto para embeddings reais
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => item.entry);
  }

  public async listHistory(userId: string, limit: number = 50): Promise<MemoryEntry[]> {
    await this.init();
    return this.db.all<MemoryEntry>(
      'SELECT * FROM user_memory_history WHERE user_id = ? ORDER BY archived_at DESC, updated_at DESC LIMIT ?',
      [userId, limit],
    ).map((entry) => this.mapEntry(entry));
  }

  public async listHistoricalRelevant(userId: string, query: string, limit: number = 8): Promise<MemoryEntry[]> {
    await this.init();
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const queryTokens = this.extractSemanticTokens(normalizedQuery);
    if (queryTokens.length === 0) {
      return [];
    }

    const queryEmbedding = this.buildEmbedding(normalizedQuery);
    const entries = this.db.all<MemoryEntry>(
      'SELECT * FROM user_memory_history WHERE user_id = ? ORDER BY archived_at DESC, updated_at DESC LIMIT 120',
      [userId],
    ).map((entry) => this.mapEntry(entry));

    return entries
      .map((entry) => ({
        entry,
        score: this.scoreMemoryEntry(entry, queryTokens, queryEmbedding),
      }))
      .filter((item) => item.score > 0.2)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => item.entry);
  }

  public async forget(userId: string, key: string): Promise<boolean> {
    await this.init();
    const normalizedKey = key.trim().toLowerCase();
    const existing = this.db.get<MemoryEntry>(
      'SELECT * FROM user_memory WHERE user_id = ? AND key = ?',
      [userId, normalizedKey],
    );
    if (!existing) return false;
    this.archiveEntry(existing, 'forgotten');
    this.db.run('DELETE FROM user_memory WHERE user_id = ? AND key = ?', [userId, normalizedKey]);
    return true;
  }

  public async getMemoryContext(userId: string, currentMessage: string = ''): Promise<string> {
    await this.init();
    const recentEntries = this.db.all<MemoryEntry>(
      'SELECT * FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20',
      [userId],
    ).map((entry) => this.mapEntry(entry));

    if (recentEntries.length === 0) {
      return '';
    }

    const relevantEntries = currentMessage ? await this.listRelevant(userId, currentMessage, 6) : [];
    const renderedRelevant = relevantEntries
      .map((entry) => this.renderMemoryContextLine(entry))
      .join('\n');
    const renderedRecent = recentEntries
      .filter((entry) => !relevantEntries.some((relevant) => relevant.id === entry.id))
      .slice(0, 8)
      .map((entry) => this.renderMemoryContextLine(entry))
      .join('\n');

    const sections: string[] = [];
    if (renderedRelevant) {
      sections.push('Memorias mais relevantes para esta conversa:');
      sections.push(renderedRelevant);
    }
    if (renderedRecent) {
      sections.push('Memorias recentes:');
      sections.push(renderedRecent);
    }

    return `\n\n${buildUntrustedContextBlock('MEMORIA PERSISTENTE DO USUARIO:', sections)}`;
  }

  public async autoExtract(userId: string, userMessage: string, botResponse: string): Promise<void> {
    const candidates = this.extractMemoryCandidates(userMessage, botResponse);
    for (const candidate of candidates) {
      await this.remember(userId, candidate.key, candidate.value, candidate.category);
    }
  }

  private mapEntry(entry: MemoryEntry): MemoryEntry {
    return {
      ...entry,
      value: this.secureStorage.decryptString(entry.value) || '',
    };
  }

  private renderMemoryContextLine(entry: MemoryEntry): string {
    const category = sanitizeTrustPlaneText(entry.category, { maxChars: 64 });
    const key = sanitizeTrustPlaneText(entry.key, { maxChars: 96 });
    const value = sanitizeTrustPlaneText(entry.value, { maxChars: 1000 });
    return `- [${category}] ${key}: ${value}`;
  }

  private archiveEntry(entry: MemoryEntry, eventType: 'superseded' | 'forgotten'): void {
    this.db.run(
      `INSERT INTO user_memory_history (
        user_id,
        key,
        value,
        category,
        embedding,
        event_type,
        created_at,
        updated_at,
        archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.user_id,
        entry.key,
        entry.value,
        entry.category,
        entry.embedding || null,
        eventType,
        entry.created_at,
        entry.updated_at,
        new Date().toISOString(),
      ],
    );
  }

  private extractMemoryCandidates(userMessage: string, botResponse: string): MemoryCandidate[] {
    const source = `${userMessage}\n${botResponse}`;
    const fromAutomaticAudioTranscript = /\[Audio transcrito automaticamente\]/i.test(userMessage);
    const candidates: MemoryCandidate[] = [];
    const pushCandidate = (key: string, value: string, category: string) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) {
        return;
      }
      if (fromAutomaticAudioTranscript && key === 'nome') {
        return;
      }
      candidates.push({ key, value: normalizedValue, category });
    };

    const patterns = [
      { regex: /meu nome (?:é|e) ([^\n,.!]+)/i, key: 'nome', category: 'pessoal' },
      { regex: /(?:moro|vivo) (?:em|no|na) ([^\n,.!]+)/i, key: 'localidade', category: 'pessoal' },
      { regex: /(?:trabalho|trampo) (?:com|em|na|no) ([^\n,.!]+)/i, key: 'trabalho', category: 'profissional' },
      { regex: /(?:prefiro|gosto de) ([^\n.!]+)/i, key: 'preferencia_principal', category: 'preferencia' },
      { regex: /(?:projeto atual|meu projeto atual|estou mexendo no projeto)(?: é| e|:)? ([^\n,.!]+)/i, key: 'projeto_atual', category: 'contexto' },
      { regex: /(?:meu objetivo(?: agora)?|quero agora)(?: é| e|:)? ([^\n.!]+)/i, key: 'objetivo_atual', category: 'contexto' },
      { regex: /(?:workspace|diret[oó]rio|pasta principal)(?: atual| favorita)?(?: é| e| fica em|:)? ([A-Za-z]:[^\n]+|\/[^\n]+)/i, key: 'workspace_preferido', category: 'workspace' },
      { regex: /(?:responda|fale) em ([^\n,.!]+)/i, key: 'idioma_preferido', category: 'preferencia' },
      { regex: /(?:minha stack(?: atual)?|eu uso|uso muito)(?: é| e|:)? ([^\n.!]+)/i, key: 'stack_principal', category: 'tecnologia' },
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern.regex);
      if (match?.[1]) {
        pushCandidate(pattern.key, match[1], pattern.category);
      }
    }

    const hashtags = Array.from(new Set(source.match(/#[\p{L}\p{N}_-]+/gu) || []))
      .slice(0, 4)
      .map((value) => value.replace(/^#/, ''));
    if (hashtags.length > 0) {
      pushCandidate('topicos_recentes', hashtags.join(', '), 'contexto');
    }

    return candidates;
  }

  private extractSemanticTokens(text: string): string[] {
    const stopWords = new Set([
      'para', 'com', 'que', 'uma', 'como', 'isso', 'essa', 'esse', 'aqui', 'agora', 'depois',
      'sobre', 'entre', 'quero', 'preciso', 'favor', 'telegram',
      'meu', 'minha', 'seu', 'sua', 'por', 'dos', 'das', 'nos', 'nas', 'uma', 'uns', 'umas',
    ]);

    return Array.from(
      new Set(
        String(text || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .split(/[^a-z0-9_:/\\.-]+/i)
          .map((token) => token.trim())
          .filter((token) => token.length >= 3 && !stopWords.has(token)),
      ),
    );
  }

  private scoreMemoryEntry(entry: MemoryEntry, queryTokens: string[], queryEmbedding: number[]): number {
    const haystack = `${entry.key} ${entry.value} ${entry.category}`.toLowerCase();
    let lexicalScore = 0;

    for (const token of queryTokens) {
      if (haystack.includes(token)) {
        lexicalScore += token.length >= 8 ? 1.5 : 1;
      }
    }

    const storedEmbedding = this.parseEmbedding(entry.embedding);
    // Se n??o houver embedding (ex: entrada antiga), ignoramos o score vetorial ou poder??amos gerar agora
    const vectorScore = storedEmbedding ? this.cosineSimilarity(queryEmbedding, storedEmbedding) : 0;
    
    // Pesos: Vetorial tem mais peso que l??xico no RAG real
    let score = (lexicalScore * 0.3) + (vectorScore * 10);

    if (score <= 0) {
      return 0;
    }

    const updatedAt = Date.parse(entry.updated_at || entry.created_at || '');
    if (!Number.isNaN(updatedAt)) {
      const ageDays = Math.max(0, (Date.now() - updatedAt) / (1000 * 60 * 60 * 24));
      score += ageDays < 7 ? 0.5 : ageDays < 30 ? 0.2 : 0;
    }

    return score;
  }

  private buildEmbedding(text: string): number[] {
    const vector = Array.from({ length: VECTOR_DIMENSIONS }, () => 0);
    const normalized = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const tokens = this.extractSemanticTokens(normalized);
    const grams = this.extractCharacterGrams(normalized);

    for (const token of [...tokens, ...grams]) {
      const hash = this.hashToken(token);
      const index = hash % VECTOR_DIMENSIONS;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[index] += sign * Math.max(1, Math.min(token.length, 6));
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!norm) {
      return vector;
    }

    return vector.map((value) => Number((value / norm).toFixed(6)));
  }

  private extractCharacterGrams(text: string): string[] {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    const grams: string[] = [];

    for (let index = 0; index < compact.length - 2; index += 1) {
      const gram = compact.slice(index, index + 3);
      if (/\w/.test(gram)) {
        grams.push(gram);
      }
    }

    return grams.slice(0, 128);
  }

  private hashToken(token: string): number {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (left.length !== right.length || left.length === 0) {
      return 0;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index];
      leftNorm += left[index] * left[index];
      rightNorm += right[index] * right[index];
    }

    if (!leftNorm || !rightNorm) {
      return 0;
    }

    return dot / Math.sqrt(leftNorm * rightNorm);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!VectorEmbeddingService.isConfigured()) {
      return this.buildEmbedding(text);
    }

    try {
      return await this.embeddingService.generate(text);
    } catch (error: any) {
    logger.warn('[Memory] creation failed', error);
    return this.buildEmbedding(text);
  }
  }

  private serializeEmbedding(vector: number[]): string {
    return JSON.stringify(vector);
  }

  private parseEmbedding(value: string | null | undefined): number[] | null {
    const raw = String(value || '').trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }

      const vector = parsed
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
      return vector.length === VECTOR_DIMENSIONS ? vector : null;
    } catch (error: any) { logger.warn('[Memory] JSON parse failed', error); return null; }
  }

  private ensureColumn(tableName: string, columnName: string, definition: string): void {
    const columns = this.db.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
    if (columns.some((column) => column.name === columnName)) {
      return;
    }

    this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}
