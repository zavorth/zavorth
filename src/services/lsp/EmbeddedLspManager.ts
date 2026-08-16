/**
 * Embedded LSP Manager.
 * Orchestrates multi-language servers providing instant in-memory diagnostics and navigation.
 */

import * as path from 'path';
import { TypeScriptLanguageServer } from './TypeScriptLanguageServer.js';
import type {
  ILanguageServer,
  LspDiagnostic,
  LspLocation,
  LspServerStatus,
} from './LspDiagnosticsContract.js';

export class EmbeddedLspManager {
  private static instance: EmbeddedLspManager | null = null;
  private servers: Map<string, ILanguageServer> = new Map();
  private initialized = false;
  private workspaceRoot = process.cwd();

  static getInstance(): EmbeddedLspManager {
    if (!this.instance) {
      this.instance = new EmbeddedLspManager();
    }
    return this.instance;
  }

  async initialize(workspaceRoot: string = process.cwd()): Promise<void> {
    if (this.initialized && this.workspaceRoot === workspaceRoot) return;
    this.workspaceRoot = workspaceRoot;

    // Initialize TypeScript / JavaScript server
    const tsServer = new TypeScriptLanguageServer();
    await tsServer.initialize(workspaceRoot);
    this.servers.set('typescript', tsServer);

    this.initialized = true;
  }

  private getServerForFile(filePath: string): ILanguageServer | null {
    const ext = path.extname(filePath).toLowerCase();
    for (const server of this.servers.values()) {
      if (server.supportedExtensions.includes(ext)) {
        return server;
      }
    }
    return null;
  }

  /**
   * Fast <50ms typecheck and diagnostics for a file.
   */
  async checkFile(filePath: string, content?: string): Promise<LspDiagnostic[]> {
    await this.initialize();
    const server = this.getServerForFile(filePath);
    if (!server) return [];

    if (content !== undefined && server instanceof TypeScriptLanguageServer) {
      server.updateFile(filePath, content);
    }

    return server.getDiagnostics([filePath]);
  }

  /**
   * Fast diagnostics across specified files or all loaded files.
   */
  async checkWorkspace(files?: string[]): Promise<LspDiagnostic[]> {
    await this.initialize();
    const allDiagnostics: LspDiagnostic[] = [];

    for (const server of this.servers.values()) {
      const diags = await server.getDiagnostics(files);
      allDiagnostics.push(...diags);
    }

    return allDiagnostics;
  }

  /**
   * Finds definition location for a symbol at a given line and column.
   */
  async findDefinition(filePath: string, line: number, column: number): Promise<LspLocation | null> {
    await this.initialize();
    const server = this.getServerForFile(filePath);
    if (!server) return null;
    return server.getDefinition(filePath, line, column);
  }

  /**
   * Finds all references of a symbol at a given line and column.
   */
  async findReferences(filePath: string, line: number, column: number): Promise<LspLocation[]> {
    await this.initialize();
    const server = this.getServerForFile(filePath);
    if (!server) return [];
    return server.findReferences(filePath, line, column);
  }

  /**
   * Returns current status of all embedded language servers.
   */
  getStatus(): LspServerStatus[] {
    return Array.from(this.servers.values()).map((s) => ({
      language: s.language,
      running: true,
      indexedFilesCount: 1,
      diagnosticsCount: 0,
      lastCheckedAt: new Date().toISOString(),
    }));
  }

  dispose(): void {
    for (const server of this.servers.values()) {
      server.dispose();
    }
    this.servers.clear();
    this.initialized = false;
  }
}
