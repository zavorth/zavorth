/**
 * Embedded LSP Contract.
 * Common interfaces for Language Server Protocol diagnostics, symbol definitions, and references.
 */

export type LspSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface LspDiagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: LspSeverity;
  code?: number | string;
}

export interface LspLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  preview?: string;
}

export interface LspSymbolDefinition {
  name: string;
  kind?: string;
  location: LspLocation;
}

export interface LspServerStatus {
  language: string;
  running: boolean;
  indexedFilesCount: number;
  diagnosticsCount: number;
  lastCheckedAt?: string;
}

export interface ILanguageServer {
  readonly language: string;
  readonly supportedExtensions: string[];
  initialize(workspaceRoot: string): Promise<void>;
  getDiagnostics(files?: string[]): Promise<LspDiagnostic[]>;
  getDefinition(file: string, line: number, column: number): Promise<LspLocation | null>;
  findReferences(file: string, line: number, column: number): Promise<LspLocation[]>;
  dispose(): void;
}
