import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface CodeMetrics {
  filename: string;
  language: string;
  lines: number;
  code_lines: number;
  comment_lines: number;
  blank_lines: number;
  functions: number;
  classes: number;
  complexity: number;
  maintainability: number;
}

export interface CodeIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  line: number;
  column: number;
  rule: string;
}

export class CodeIntelligenceService {
  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'code-intelligence');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public analyzeCode(filePath: string): string {
    if (!fs.existsSync(filePath)) return `Error: "${filePath}" not found.`;

    const content = fs.readFileSync(filePath, 'utf-8');
    const metrics = this.getMetrics(filePath, content);
    const issues = this.detectIssues(content, metrics.language);
    const functions = this.extractFunctions(content, metrics.language);
    const classes = this.extractClasses(content, metrics.language);

    return [
      'Code Analysis:',
      `  File: ${metrics.filename}`,
      `  Language: ${metrics.language}`,
      `  Lines: ${metrics.lines} (code: ${metrics.code_lines}, comments: ${metrics.comment_lines}, blank: ${metrics.blank_lines})`,
      `  Functions: ${metrics.functions}`,
      `  Classes: ${metrics.classes}`,
      `  Complexity: ${metrics.complexity}`,
      `  Maintainability: ${metrics.maintainability}/100`,
      '',
      'Functions:',
      ...functions.slice(0, 10).map((f) => `  ${f.name} (line ${f.line}, ${f.params} params)`),
      '',
      'Classes:',
      ...classes.slice(0, 5).map((c) => `  ${c.name} (line ${c.line}, ${c.methods} methods)`),
      '',
      'Issues:',
      ...issues.slice(0, 10).map((i) => `  [${i.type}] Line ${i.line}: ${i.message}`),
    ].join('\n');
  }

  public getMetrics(filePath: string, content?: string): CodeMetrics {
    if (!content) content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(ext);
    const lines = content.split('\n');

    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blankLines++;
      } else if (inBlockComment) {
        commentLines++;
        if (trimmed.includes('*/')) inBlockComment = false;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        commentLines++;
        if (trimmed.startsWith('/*') && !trimmed.includes('*/')) inBlockComment = true;
      } else {
        codeLines++;
      }
    }

    const functions = this.extractFunctions(content, language);
    const classes = this.extractClasses(content, language);
    const complexity = this.calculateComplexity(content, language);

    return {
      filename: path.basename(filePath),
      language,
      lines: lines.length,
      code_lines: codeLines,
      comment_lines: commentLines,
      blank_lines: blankLines,
      functions: functions.length,
      classes: classes.length,
      complexity,
      maintainability: Math.max(0, 100 - complexity * 2),
    };
  }

  public extractFunctions(content: string, language: string): Array<{ name: string; line: number; params: number }> {
    const functions: Array<{ name: string; line: number; params: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpMatchArray | null = null;

      switch (language) {
        case 'typescript':
        case 'javascript':
          match = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(.*?\)\s*=>|\w+\s*=>))/);
          if (match) {
            const name = match[1] || match[2];
            const params = (line.match(/,/g) || []).length + 1;
            functions.push({ name, line: i + 1, params });
          }
          break;
        case 'python':
          match = line.match(/def\s+(\w+)\s*\((.*?)\)/);
          if (match) {
            const params = match[2] ? match[2].split(',').length : 0;
            functions.push({ name: match[1], line: i + 1, params });
          }
          break;
        case 'java':
        case 'csharp':
          match = line.match(/(?:public|private|protected|static|\s)+\s+\w+\s+(\w+)\s*\((.*?)\)/);
          if (match) {
            const params = match[2] ? match[2].split(',').length : 0;
            functions.push({ name: match[1], line: i + 1, params });
          }
          break;
      }
    }

    return functions;
  }

  public extractClasses(content: string, language: string): Array<{ name: string; line: number; methods: number }> {
    const classes: Array<{ name: string; line: number; methods: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpMatchArray | null = null;

      switch (language) {
        case 'typescript':
        case 'javascript':
          match = line.match(/class\s+(\w+)/);
          break;
        case 'python':
          match = line.match(/class\s+(\w+)/);
          break;
        case 'java':
        case 'csharp':
          match = line.match(/class\s+(\w+)/);
          break;
      }

      if (match) {
        const methods = this.countMethods(lines.slice(i), language);
        classes.push({ name: match[1], line: i + 1, methods });
      }
    }

    return classes;
  }

  public calculateComplexity(content: string, _language: string): number {
    let complexity = 1;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/\b(if|else|for|while|switch|case|catch|&&|\|\||\...)\b/)) {
        complexity++;
      }
    }

    return complexity;
  }

  public detectIssues(content: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line.length > 120) {
        issues.push({ type: 'warning', message: 'Line too long (>120 chars)', line: lineNum, column: 120, rule: 'max-line-length' });
      }

      if (line.includes('console.log') && language !== 'markdown') {
        issues.push({ type: 'info', message: 'Console.log found', line: lineNum, column: line.indexOf('console.log'), rule: 'no-console' });
      }

      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        issues.push({ type: 'info', message: 'TODO/FIXME found', line: lineNum, column: 0, rule: 'no-todo' });
      }

      if (line.match(/function\s+\w+\s*\([^)]*\)\s*\{/) && line.length > 100) {
        issues.push({ type: 'warning', message: 'Long function signature', line: lineNum, column: 0, rule: 'max-params' });
      }
    }

    return issues;
  }

  public searchCode(directory: string, query: string): string {
    if (!fs.existsSync(directory)) return `Error: "${directory}" not found.`;

    const results: Array<{ file: string; line: number; content: string }> = [];
    const files = this.listFiles(directory);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            results.push({ file: path.relative(directory, file), line: i + 1, content: lines[i].trim() });
          }
        }
      } catch (error: unknown) {/* ignore */ logger.warn('[Code Intelligence] filesystem operation failed', error); }
    }

    if (results.length === 0) return `No results found for "${query}".`;

    return [
      `Search Results for "${query}" (${results.length} matches):`,
      ...results.slice(0, 20).map((r) => `  ${r.file}:${r.line}: ${r.content.slice(0, 100)}`),
    ].join('\n');
  }

  public suggestRefactoring(filePath: string): string {
    if (!fs.existsSync(filePath)) return `Error: "${filePath}" not found.`;

    const content = fs.readFileSync(filePath, 'utf-8');
    const metrics = this.getMetrics(filePath, content);
    const suggestions: string[] = [];

    if (metrics.complexity > 10) {
      suggestions.push('High complexity detected. Consider breaking down into smaller functions.');
    }
    if (metrics.functions > 20) {
      suggestions.push('Too many functions. Consider splitting into multiple files.');
    }
    if (metrics.classes > 5) {
      suggestions.push('Too many classes. Consider splitting into multiple files.');
    }
    if (metrics.comment_lines < metrics.code_lines * 0.1) {
      suggestions.push('Low comment ratio. Consider adding more documentation.');
    }

    if (suggestions.length === 0) return 'No refactoring suggestions. Code looks good!';

    return ['Refactoring Suggestions:', ...suggestions.map((s) => ` ? ${s}`)].join('\n');
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
      '.py': 'python', '.java': 'java', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c',
      '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
      '.kt': 'kotlin', '.scala': 'scala', '.md': 'markdown', '.json': 'json',
      '.xml': 'xml', '.html': 'html', '.css': 'css', '.sql': 'sql',
    };
    return map[ext] || 'unknown';
  }

  private countMethods(lines: string[], _language: string): number {
    let count = 0;
    for (const line of lines) {
      if (line.match(/(?:public|private|protected|static|\s)+\s+\w+\s+\w+\s*\(/)) count++;
      if (line.match(/def\s+\w+\s*\(/)) count++;
    }
    return count;
  }

  private listFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.listFiles(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Code Intelligence] filesystem operation failed', error); }
    return files;
  }
}
