/**
 * Error Trace & Diagnostics Parser.
 * Extracts structured diagnostic findings (file, line, error code, message) from compiler outputs, test failures, and stack traces.
 * Strictly typed (Zero any) and EN-First.
 */

import type { DiagnosticFinding, DiagnosticSeverity } from './types.js';

export class ErrorTraceParser {
  /**
   * Parses raw terminal or execution output into structured diagnostic findings.
   */
  public static parse(rawOutput: string): DiagnosticFinding[] {
    if (!rawOutput || !rawOutput.trim()) {
      return [];
    }

    const findings: DiagnosticFinding[] = [];
    const lines = rawOutput.split('\n');

    let currentErrorMessage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/^✘\s*\[(ERROR|WARNING)\]/i.test(line) || /^error:/i.test(line)) {
        currentErrorMessage = line;
      }

      // 1. TypeScript / Compiler Pattern: path/to/file.ts(12,34): error TS1234: message
      const tsMatch = line.match(/^([a-zA-Z0-9_\-./\\]+)\((\d+),(\d+)\):\s+(error|warning)\s+([A-Z0-9]+):\s+(.*)$/i);
      if (tsMatch) {
        findings.push({
          filePath: tsMatch[1],
          line: parseInt(tsMatch[2], 10),
          column: parseInt(tsMatch[3], 10),
          severity: (tsMatch[4].toLowerCase() === 'warning' ? 'warning' : 'error') as DiagnosticSeverity,
          errorCode: tsMatch[5],
          message: tsMatch[6],
          rawSnippet: line,
        });
        continue;
      }

      // 2. esbuild / Rust / Clang Pattern: src/file.ts:12:34: error: message OR src/file.ts:12:34: OR src/file.ts:12:34
      const esbuildMatch = line.match(/^([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+):(\d+):(\d+):?(?:\s*(error|warning)?:\s*(.*))?$/i);
      if (esbuildMatch) {
        const sev = esbuildMatch[4] ? (esbuildMatch[4].toLowerCase() === 'warning' ? 'warning' : 'error') : 'error';
        const msg = esbuildMatch[5] || currentErrorMessage || 'Compilation diagnostic at location';
        findings.push({
          filePath: esbuildMatch[1],
          line: parseInt(esbuildMatch[2], 10),
          column: parseInt(esbuildMatch[3], 10),
          severity: sev as DiagnosticSeverity,
          message: msg,
          rawSnippet: line,
        });
        continue;
      }

      // 3. Node.js / Jest Stack Trace Pattern: at Function (path/to/file.ts:12:34)
      const stackMatch = line.match(/at\s+(?:[a-zA-Z0-9_$.<>]+\s+)?\(?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+):(\d+):(\d+)\)?/i);
      if (stackMatch && !stackMatch[1].includes('node_modules') && !stackMatch[1].includes('node:')) {
        findings.push({
          filePath: stackMatch[1],
          line: parseInt(stackMatch[2], 10),
          column: parseInt(stackMatch[3], 10),
          severity: 'error',
          message: lines[Math.max(0, i - 1)] || line,
          rawSnippet: line,
        });
        continue;
      }

      // 4. General Fatal / Error line
      if (/^(fatal|error|exception):/i.test(line)) {
        findings.push({
          severity: line.toLowerCase().startsWith('fatal') ? 'fatal' : 'error',
          message: line,
          rawSnippet: line,
        });
      }
    }

    // Deduplicate findings by filePath + line + message
    const uniqueMap = new Map<string, DiagnosticFinding>();
    for (const f of findings) {
      const key = `${f.filePath || ''}:${f.line || 0}:${f.message}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, f);
      }
    }

    return Array.from(uniqueMap.values());
  }
}
