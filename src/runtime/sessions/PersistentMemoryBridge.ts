/**
 * PersistentMemoryBridge — Bridge between InfiniteMemoryCompressor and SessionPersistenceStore.
 *
 * Connects the in-process memory compressor with disk persistence.
 * Ensures compressed chunks survive runtime restarts.
 *
 * Usage:
 *   const bridge = new PersistentMemoryBridge({
 *     sessionId: 'ses_123',
 *     persistenceStore: new SessionPersistenceStore({ dbPath: '.zavorth/sessions.db' }),
 *   });
 *   await bridge.initialize();
 *
 *   // Connect to compressor
 *   compressor.on('memory:compressed', (chunk) => bridge.onChunkCompressed(chunk));
 */

import { EventEmitter } from 'events';
import { SessionPersistenceStore, type CompressedMemoryChunk, type SessionState } from './SessionPersistenceStore.js';
import type { MemoryChunk } from './v2/InfiniteMemoryCompressor.js';

export interface PersistentMemoryBridgeOptions {
  sessionId: string;
  persistenceStore: SessionPersistenceStore;
  autoSave?: boolean;
  autoSaveIntervalMs?: number;
}

export class PersistentMemoryBridge extends EventEmitter {
  private readonly sessionId: string;
  private readonly store: SessionPersistenceStore;
  private readonly autoSave: boolean;
  private readonly autoSaveIntervalMs: number;

  private chunks = new Map<string, CompressedMemoryChunk>();
  private dirty = false;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor(options: PersistentMemoryBridgeOptions) {
    super();
    this.sessionId = options.sessionId;
    this.store = options.persistenceStore;
    this.autoSave = options.autoSave ?? true;
    this.autoSaveIntervalMs = options.autoSaveIntervalMs ?? 30_000; // 30s
  }

  /**
   * Initializes the bridge, loading persisted chunks.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load existing chunks from disk
    const persistedChunks = await this.store.loadMemoryChunks(this.sessionId);
    for (const chunk of persistedChunks) {
      this.chunks.set(chunk.id, chunk);
    }

    // Configure auto-save
    if (this.autoSave) {
      this.autoSaveTimer = setInterval(() => {
        if (this.dirty) {
          this.save().catch((err) => this.emit('error', err));
        }
      }, this.autoSaveIntervalMs);
    }

    this.initialized = true;
    this.emit('initialized', { chunkCount: this.chunks.size });
  }

  /**
   * Called when the compressor generates a new chunk.
   */
  async onChunkCompressed(chunk: MemoryChunk): Promise<void> {
    const persistentChunk: CompressedMemoryChunk = {
      id: chunk.id,
      sessionId: chunk.sessionId,
      content: chunk.compressedSummary,
      keywords: chunk.keywords,
      timestamp: chunk.createdAt,
      tokenCount: chunk.originalTokenCount,
    };

    this.chunks.set(chunk.id, persistentChunk);
    this.dirty = true;

    this.emit('chunk:stored', persistentChunk);

    // Save immediately if auto-save is disabled
    if (!this.autoSave) {
      await this.save();
    }
  }

  /**
   * Loads all chunks for injection into the compressor.
   */
  async loadChunks(): Promise<MemoryChunk[]> {
    return Array.from(this.chunks.values()).map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      createdAt: c.timestamp,
      originalTokenCount: c.tokenCount,
      compressedSummary: c.content,
      keywords: c.keywords,
      relevanceScore: 1.0,
    }));
  }

  /**
   * Saves pending chunks to disk.
   */
  async save(): Promise<void> {
    if (!this.dirty) return;

    const allChunks = Array.from(this.chunks.values());
    await this.store.saveMemoryChunks(this.sessionId, allChunks);
    this.dirty = false;

    this.emit('saved', { chunkCount: allChunks.length });
  }

  /**
   * Saves session state.
   */
  async saveSessionState(state: SessionState): Promise<void> {
    await this.store.saveSession(state);
  }

  /**
   * Loads session state.
   */
  async loadSessionState(): Promise<SessionState | null> {
    return this.store.loadSession(this.sessionId);
  }

  /**
   * Returns statistics.
   */
  getStats(): {
    sessionId: string;
    chunkCount: number;
    isDirty: boolean;
    isInitialized: boolean;
  } {
    return {
      sessionId: this.sessionId,
      chunkCount: this.chunks.size,
      isDirty: this.dirty,
      isInitialized: this.initialized,
    };
  }

  /**
   * Destroys the bridge, stopping timers and saving final state.
   */
  async destroy(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Save final state
    if (this.dirty) {
      await this.save();
    }

    this.chunks.clear();
    this.initialized = false;

    // Release SQLite file handle (Windows) when store supports close
    if (typeof this.store.close === 'function') {
      try {
        this.store.close();
      } catch {
        // ignore
      }
    }
  }
}
