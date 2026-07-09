import { asErrorLike } from '../utils/errorLike';
﻿import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthCodeIntelligenceTool extends BaseTool {
  public readonly name = 'zavorth_code_intelligence';

  public readonly description =
    'Code intelligence — AST parsing, code formatting, dependency analysis, complexity metrics, and test discovery.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'analyze', 'format', 'lint', 'find_tests', 'complexity', 'dependencies', 'symbols', 'diff'.",
      },
      file_path: {
        type: 'string',
        description: 'Path to file or directory.',
      },
      language: {
        type: 'string',
        description: "Language: 'typescript', 'javascript', 'python', 'go', 'rust', 'auto'. Default: 'auto'.",
      },
      format_style: {
        type: 'string',
        description: "Format style: 'prettier', 'eslint-fix', 'black', 'rustfmt'.",
      },
      depth: {
        type: 'number',
        description: 'Analysis depth (1-5). Default: 3.',
      },
      include_tests: {
        type: 'boolean',
        description: 'Include test files in analysis. Default: false.',
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json', 'markdown'. Default: 'text'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const filePath = String(args.file_path || '.');

    switch (action) {
      case 'analyze': return this.analyzeCode(filePath, args);
      case 'format': return await this.formatCode(filePath, args);
      case 'lint': return await this.lintCode(filePath);
      case 'find_tests': return this.findTests(filePath);
      case 'complexity': return this.analyzeComplexity(filePath);
      case 'dependencies': return this.analyzeDependencies(filePath);
      case 'symbols': return this.extractSymbols(filePath);
      case 'diff': return this.showDiff(filePath);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private analyzeCode(filePath: string, args: Record<string, unknown>): string {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return `Error: "${filePath}" not found.`;

    const stat = fs.statSync(resolved);
    const lines: string[] = [`Code Analysis: ${filePath}`, ''];

    if (stat.isDirectory()) {
      const files = this.listFiles(resolved, ['.ts', '.js', '.py', '.go', '.rs']);
      const totalSize = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
      lines.push(`  Files: ${files.length}`);
      lines.push(`  Total size: ${(totalSize / 1024).toFixed(1)} KB`);

      const byExt: Record<string, number> = {};
      for (const f of files) {
        const ext = path.extname(f);
        byExt[ext] = (byExt[ext] || 0) + 1;
      }
      for (const [ext, count] of Object.entries(byExt)) {
        lines.push(`  ${ext}: ${count} files`);
      }
    } else {
      const content = fs.readFileSync(resolved, 'utf-8');
      const codeLines = content.split('\n');
      const nonEmpty = codeLines.filter((l) => l.trim().length > 0);
      const commentLines = codeLines.filter((l) => /^\s*(\/\/|#|\/\*|\*)/.test(l));

      lines.push(`  Lines: ${codeLines.length}`);
      lines.push(`  Non-empty: ${nonEmpty.length}`);
      lines.push(`  Comments: ${commentLines.length}`);
      lines.push(`  Size: ${(stat.size / 1024).toFixed(1)} KB`);
      lines.push(`  Language: ${this.detectLanguage(resolved)}`);
    }

    return lines.join('\n');
  }

  private async formatCode(filePath: string, args: Record<string, unknown>): Promise<string> {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return `Error: "${filePath}" not found.`;

    const style = String(args.format_style || 'prettier');

    try {
      const { execFileSync } = await import('child_process');
      let cmd: string;
      let cmdArgs: string[];

      switch (style) {
        case 'prettier':
          cmd = 'npx';
          cmdArgs = ['prettier', '--write', resolved];
          break;
        case 'eslint-fix':
          cmd = 'npx';
          cmdArgs = ['eslint', '--fix', resolved];
          break;
        case 'black':
          cmd = 'python3';
          cmdArgs = ['-m', 'black', resolved];
          break;
        case 'rustfmt':
          cmd = 'rustfmt';
          cmdArgs = [resolved];
          break;
        default:
          return `Error: format style "${style}" not supported.`;
      }

      execFileSync(cmd, cmdArgs, { timeout: 60000 });
      return `Formatted ${filePath} with ${style}.`;
    } catch ($1: unknown) { logger.warn('[Zavorth Code Intelligence] process execution failed', error); return ''; }
  }

  private async lintCode(filePath: string): Promise<string> {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return `Error: "${filePath}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('npx', ['eslint', '--format=compact', resolved], {
        timeout: 60000,
        maxBuffer: 5 * 1024 * 1024,
      }).toString();

      if (!result.trim()) return `No lint issues found in ${filePath}.`;
      return `Lint results for ${filePath}:\n${result.slice(0, 3000)}`;
    } catch (error: unknown) { const e = asErrorLike(error);
      const err = error as { stdout?: Buffer; message?: string };
      const output = err.stdout?.toString() || err.message || '';
      if (!output.trim()) return `No lint issues found in ${filePath}.`;
      return `Lint results for ${filePath}:\n${output.slice(0, 3000)}`;
    }
  }

  private findTests(dirPath: string): string {
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) return `Error: "${dirPath}" not found.`;

    const testPatterns = ['.test.ts', '.test.js', '.spec.ts', '.spec.js', '_test.py', '_test.go', '.test.rs'];
    const files = this.listFiles(resolved);
    const testFiles = files.filter((f) => testPatterns.some((p) => f.endsWith(p)));

    if (testFiles.length === 0) return `No test files found in ${dirPath}.`;

    const lines: string[] = [`Test files in ${dirPath} (${testFiles.length}):`];
    for (const f of testFiles.slice(0, 50)) {
      const rel = path.relative(resolved, f);
      lines.push(`  ${rel}`);
    }
    return lines.join('\n');
  }

  private analyzeComplexity(filePath: string): string {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return `Error: "${filePath}" not found.`;

    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');

    let functions = 0;
    let branches = 0;
    let loops = 0;
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(export\s+)?(async\s+)?function\s|^(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?\(/.test(trimmed)) functions++;
      if (/^(if|else if|switch|case)\s/.test(trimmed)) branches++;
      if (/^(for|while|do)\s/.test(trimmed)) loops++;
      if (trimmed.includes('{')) currentDepth++;
      if (trimmed.includes('}')) currentDepth--;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    const complexity = functions + branches * 2 + loops * 3;

    return [
      `Complexity Analysis: ${filePath}`,
      `  Functions: ${functions}`,
      `  Branches: ${branches}`,
      `  Loops: ${loops}`,
      `  Max nesting depth: ${maxDepth}`,
      `  Cyclomatic complexity: ${complexity}`,
      `  Rating: ${complexity < 10 ? 'Simple' : complexity < 20 ? 'Moderate' : complexity < 50 ? 'Complex' : 'Very Complex'}`,
    ].join('\n');
  }

  private analyzeDependencies(dirPath: string): string {
    const resolved = path.resolve(dirPath);
    const pkgPath = path.join(resolved, 'package.json');
    const reqPath = path.join(resolved, 'requirements.txt');
    const goPath = path.join(resolved, 'go.mod');

    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      return [
        `Dependencies (${pkg.name || 'unknown'}):`,
        `  Production: ${deps.length}`,
        `  Dev: ${devDeps.length}`,
        '',
        'Production:',
        ...deps.slice(0, 20).map((d) => `  ${d}: ${(pkg.dependencies as Record<string, string>)[d]}`),
      ].join('\n');
    }

    if (fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf-8');
      const deps = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      return `Python dependencies: ${deps.length}\n${deps.slice(0, 20).join('\n')}`;
    }

    if (fs.existsSync(goPath)) {
      const content = fs.readFileSync(goPath, 'utf-8');
      const requires = content.match(/require\s+(\S+)\s+(\S+)/g) || [];
      return `Go dependencies: ${requires.length}\n${requires.slice(0, 20).join('\n')}`;
    }

    return `No dependency file found in ${dirPath}.`;
  }

  private extractSymbols(filePath: string): string {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return `Error: "${filePath}" not found.`;

    const content = fs.readFileSync(resolved, 'utf-8');
    const symbols: Array<{ type: string; name: string; line: number }> = [];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      match = line.match(/^(export\s+)?(abstract\s+)?class\s+(\w+)/);
      if (match) symbols.push({ type: 'class', name: match[3], line: i + 1 });

      match = line.match(/^(export\s+)?(async\s+)?function\s+(\w+)/);
      if (match) symbols.push({ type: 'function', name: match[3], line: i + 1 });

      match = line.match(/^(export\s+)?(const|let)\s+(\w+)\s*=/);
      if (match) symbols.push({ type: 'variable', name: match[3], line: i + 1 });

      match = line.match(/^(export\s+)?interface\s+(\w+)/);
      if (match) symbols.push({ type: 'interface', name: match[2], line: i + 1 });

      match = line.match(/^(export\s+)?type\s+(\w+)/);
      if (match) symbols.push({ type: 'type', name: match[2], line: i + 1 });

      match = line.match(/^(export\s+)?enum\s+(\w+)/);
      if (match) symbols.push({ type: 'enum', name: match[2], line: i + 1 });
    }

    if (symbols.length === 0) return `No symbols found in ${filePath}.`;

    const output: string[] = [`Symbols in ${filePath} (${symbols.length}):`];
    for (const s of symbols) {
      output.push(`  ${s.type}: ${s.name} (line ${s.line})`);
    }
    return output.join('\n');
  }

  private showDiff(filePath: string): string {
    try {
      const { execFileSync } = require('child_process');
      const result = execFileSync('git', ['diff', '--stat', filePath], { timeout: 10000 }).toString();
      if (!result.trim()) return `No changes in ${filePath}.`;
      return `Diff for ${filePath}:\n${result}`;
    } catch ($1: unknown) { logger.warn('[Zavorth Code Intelligence] process execution failed', error); return ''; }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
      '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby',
      '.cs': 'C#', '.cpp': 'C++', '.c': 'C', '.swift': 'Swift', '.kt': 'Kotlin',
    };
    return map[ext] || 'Unknown';
  }

  private listFiles(dir: string, extensions?: string[]): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.listFiles(fullPath, extensions));
        } else if (entry.isFile()) {
          if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
            results.push(fullPath);
          }
        }
      }
    } catch ($1: unknown) { /* ignore */ logger.warn('[Zavorth Code Intelligence] operation failed', error); }
    return results;
  }
}
