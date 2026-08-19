export type CodeSymbolKind = 'FUNCTION' | 'CLASS' | 'INTERFACE' | 'TYPE_ALIAS' | 'VARIABLE';

export type CodeEdgeKind = 'CALLS' | 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS';

export interface CodeSymbol {
  readonly id: string;
  readonly name: string;
  readonly kind: CodeSymbolKind;
  readonly filePath: string;
  readonly line: number;
  readonly isExported: boolean;
}

export interface CodeEdge {
  readonly fromSymbolId: string;
  readonly toSymbolId: string;
  readonly kind: CodeEdgeKind;
}

export interface SymbolImpactReport {
  readonly targetSymbol: CodeSymbol;
  readonly dependentFiles: readonly string[];
  readonly dependentSymbols: readonly CodeSymbol[];
  readonly totalImpactCount: number;
  readonly riskRecommendation: 'SAFE_LOCAL' | 'REQUIRES_CALLER_UPDATES' | 'BREAKING_PUBLIC_CONTRACT';
}

export class ZavorthCodebaseGraphService {
  private readonly symbols = new Map<string, CodeSymbol>();
  private readonly edges: CodeEdge[] = [];

  public indexSourceFile(filePath: string, sourceCode: string): readonly CodeSymbol[] {
    const lines = sourceCode.split(/\r?\n/);
    const fileSymbols: CodeSymbol[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx].trim();
      const lineNum = lineIdx + 1;
      const isExported = line.startsWith('export ');
      const effectiveLine = isExported ? line.substring(7).trim() : line;

      if (effectiveLine.startsWith('function ') || effectiveLine.startsWith('async function ')) {
        const namePart = effectiveLine.replace(/^async\s+/, '').substring(9).trim();
        const parenIdx = namePart.indexOf('(');
        const name = (parenIdx > 0 ? namePart.substring(0, parenIdx) : namePart).trim();
        if (name && name.length > 0) {
          const sym: CodeSymbol = {
            id: `${filePath}#${name}`,
            name,
            kind: 'FUNCTION',
            filePath,
            line: lineNum,
            isExported,
          };
          fileSymbols.push(sym);
          this.symbols.set(sym.id, sym);
        }
      } else if (effectiveLine.startsWith('class ')) {
        const namePart = effectiveLine.substring(6).trim();
        const spaceIdx = namePart.indexOf(' ');
        const name = (spaceIdx > 0 ? namePart.substring(0, spaceIdx) : namePart).trim();
        if (name && name.length > 0) {
          const sym: CodeSymbol = {
            id: `${filePath}#${name}`,
            name,
            kind: 'CLASS',
            filePath,
            line: lineNum,
            isExported,
          };
          fileSymbols.push(sym);
          this.symbols.set(sym.id, sym);
        }
      } else if (effectiveLine.startsWith('interface ')) {
        const namePart = effectiveLine.substring(10).trim();
        const spaceIdx = namePart.indexOf(' ');
        const name = (spaceIdx > 0 ? namePart.substring(0, spaceIdx) : namePart).trim();
        if (name && name.length > 0) {
          const sym: CodeSymbol = {
            id: `${filePath}#${name}`,
            name,
            kind: 'INTERFACE',
            filePath,
            line: lineNum,
            isExported,
          };
          fileSymbols.push(sym);
          this.symbols.set(sym.id, sym);
        }
      } else if (effectiveLine.startsWith('type ')) {
        const namePart = effectiveLine.substring(5).trim();
        const equalIdx = namePart.indexOf('=');
        const name = (equalIdx > 0 ? namePart.substring(0, equalIdx) : namePart).trim();
        if (name && name.length > 0) {
          const sym: CodeSymbol = {
            id: `${filePath}#${name}`,
            name,
            kind: 'TYPE_ALIAS',
            filePath,
            line: lineNum,
            isExported,
          };
          fileSymbols.push(sym);
          this.symbols.set(sym.id, sym);
        }
      }
    }

    return fileSymbols;
  }

  public registerCallEdge(fromSymbolId: string, toSymbolId: string, kind: CodeEdgeKind = 'CALLS'): void {
    this.edges.push({
      fromSymbolId,
      toSymbolId,
      kind,
    });
  }

  public getImpactAnalysis(filePath: string, symbolName: string): SymbolImpactReport | null {
    const targetId = `${filePath}#${symbolName}`;
    const targetSymbol = this.symbols.get(targetId);

    if (!targetSymbol) {
      return null;
    }

    const dependentSymbolIds = this.edges
      .filter((e) => e.toSymbolId === targetId)
      .map((e) => e.fromSymbolId);

    const dependentSymbols: CodeSymbol[] = [];
    const dependentFiles = new Set<string>();

    for (const depId of dependentSymbolIds) {
      const depSym = this.symbols.get(depId);
      if (depSym) {
        dependentSymbols.push(depSym);
        if (depSym.filePath !== filePath) {
          dependentFiles.add(depSym.filePath);
        }
      }
    }

    let risk: 'SAFE_LOCAL' | 'REQUIRES_CALLER_UPDATES' | 'BREAKING_PUBLIC_CONTRACT' = 'SAFE_LOCAL';

    if (targetSymbol.isExported && dependentFiles.size > 0) {
      risk = 'REQUIRES_CALLER_UPDATES';
    } else if (targetSymbol.isExported && targetSymbol.kind === 'INTERFACE') {
      risk = 'BREAKING_PUBLIC_CONTRACT';
    }

    return {
      targetSymbol,
      dependentFiles: Array.from(dependentFiles),
      dependentSymbols,
      totalImpactCount: dependentSymbols.length,
      riskRecommendation: risk,
    };
  }

  public getAllSymbols(): readonly CodeSymbol[] {
    return Array.from(this.symbols.values());
  }

  public clear(): void {
    this.symbols.clear();
    this.edges.length = 0;
  }
}
