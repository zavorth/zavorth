/**
 * TypeScript In-Memory Language Server.
 * Uses TypeScript LanguageService for sub-50ms diagnostics, definitions, and references.
 */

import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import type {
  ILanguageServer,
  LspDiagnostic,
  LspLocation,
  LspSeverity,
} from './LspDiagnosticsContract.js';

export class TypeScriptLanguageServer implements ILanguageServer {
  public readonly language = 'typescript';
  public readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];

  private workspaceRoot: string = process.cwd();
  private languageService: ts.LanguageService | null = null;
  private files: Map<string, { version: number; content: string }> = new Map();
  private compilerOptions: ts.CompilerOptions = {};

  async initialize(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;
    this.loadCompilerOptions();
    this.setupLanguageService();
  }

  private loadCompilerOptions(): void {
    const configPath = ts.findConfigFile(this.workspaceRoot, ts.sys.fileExists, 'tsconfig.json');
    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      );
      this.compilerOptions = parsed.options;
    } else {
      this.compilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowJs: true,
        skipLibCheck: true,
      };
    }
  }

  private setupLanguageService(): void {
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => Array.from(this.files.keys()),
      getScriptVersion: (fileName) => {
        const file = this.files.get(path.normalize(fileName));
        return file ? String(file.version) : '0';
      },
      getScriptSnapshot: (fileName) => {
        const normalized = path.normalize(fileName);
        let file = this.files.get(normalized);

        if (!file && fs.existsSync(normalized)) {
          try {
            const content = fs.readFileSync(normalized, 'utf-8');
            file = { version: 1, content };
            this.files.set(normalized, file);
          } catch {
            return undefined;
          }
        }

        if (!file) return undefined;
        return ts.ScriptSnapshot.fromString(file.content);
      },
      getCurrentDirectory: () => this.workspaceRoot,
      getCompilationSettings: () => this.compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: (p) => fs.existsSync(p),
      readFile: (p) => {
        try {
          return fs.readFileSync(p, 'utf-8');
        } catch {
          return undefined;
        }
      },
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    this.languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  /**
   * Updates file content in the in-memory language service.
   */
  updateFile(filePath: string, content: string): void {
    const normalized = path.normalize(filePath);
    const existing = this.files.get(normalized);
    this.files.set(normalized, {
      version: (existing?.version || 0) + 1,
      content,
    });
  }

  async getDiagnostics(targetFiles?: string[]): Promise<LspDiagnostic[]> {
    if (!this.languageService) return [];

    const fileList = targetFiles && targetFiles.length > 0
      ? targetFiles.map((f) => path.normalize(f))
      : Array.from(this.files.keys());

    const diagnostics: LspDiagnostic[] = [];

    for (const fileName of fileList) {
      if (!fs.existsSync(fileName) && !this.files.has(fileName)) continue;

      try {
        const syntactic = this.languageService.getSyntacticDiagnostics(fileName);
        const semantic = this.languageService.getSemanticDiagnostics(fileName);
        const all = [...syntactic, ...semantic];

        for (const diag of all) {
          if (!diag.file || diag.start === undefined) continue;

          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
          const message = typeof diag.messageText === 'string'
            ? diag.messageText
            : diag.messageText.messageText;

          let severity: LspSeverity = 'error';
          if (diag.category === ts.DiagnosticCategory.Warning) severity = 'warning';
          if (diag.category === ts.DiagnosticCategory.Suggestion) severity = 'hint';
          if (diag.category === ts.DiagnosticCategory.Message) severity = 'info';

          diagnostics.push({
            file: fileName,
            line: line + 1,
            column: character + 1,
            message,
            severity,
            code: diag.code,
          });
        }
      } catch {
        // Safe skip on single file diagnostic failure
      }
    }

    return diagnostics;
  }

  async getDefinition(file: string, line: number, column: number): Promise<LspLocation | null> {
    if (!this.languageService) return null;
    const normalized = path.normalize(file);

    try {
      const sourceFile = this.getSourceFile(normalized);
      if (!sourceFile) return null;

      const position = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);
      const defs = this.languageService.getDefinitionAtPosition(normalized, position);
      if (!defs || defs.length === 0) return null;

      const def = defs[0];
      const targetSource = this.getSourceFile(def.fileName);
      if (!targetSource) return null;

      const { line: startLine, character: startCol } = targetSource.getLineAndCharacterOfPosition(def.textSpan.start);
      return {
        file: def.fileName,
        line: startLine + 1,
        column: startCol + 1,
      };
    } catch {
      return null;
    }
  }

  async findReferences(file: string, line: number, column: number): Promise<LspLocation[]> {
    if (!this.languageService) return [];
    const normalized = path.normalize(file);

    try {
      const sourceFile = this.getSourceFile(normalized);
      if (!sourceFile) return [];

      const position = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);
      const refEntries = this.languageService.findReferences(normalized, position);
      if (!refEntries) return [];

      const locations: LspLocation[] = [];
      for (const entry of refEntries) {
        for (const ref of entry.references) {
          const targetSource = this.getSourceFile(ref.fileName);
          if (!targetSource) continue;

          const { line: refLine, character: refCol } = targetSource.getLineAndCharacterOfPosition(ref.textSpan.start);
          locations.push({
            file: ref.fileName,
            line: refLine + 1,
            column: refCol + 1,
          });
        }
      }
      return locations;
    } catch {
      return [];
    }
  }

  private getSourceFile(fileName: string): ts.SourceFile | undefined {
    if (!this.languageService) return undefined;
    const program = this.languageService.getProgram();
    return program?.getSourceFile(fileName);
  }

  dispose(): void {
    if (this.languageService) {
      this.languageService.dispose();
      this.languageService = null;
    }
    this.files.clear();
  }
}
