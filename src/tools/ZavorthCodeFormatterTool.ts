import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthCodeFormatterTool extends BaseTool {
  public readonly name = 'zavorth_code_formatter';

  public readonly description =
    'Code formatting — format source files using Prettier, Black, rustfmt, gofmt, clang-format, or auto-detect by language. Supports single files, directories, and stdin input.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'format', 'check', 'fix', 'list_formatters'.",
      },
      file_path: {
        type: 'string',
        description: 'Path to file or directory to format.',
      },
      formatter: {
        type: 'string',
        description: "Formatter to use: 'prettier', 'black', 'rustfmt', 'gofmt', 'clang-format', 'auto'. Default: 'auto'.",
      },
      code: {
        type: 'string',
        description: 'Raw code string to format (stdin mode).',
      },
      language: {
        type: 'string',
        description: "Language hint for auto-detection: 'typescript', 'javascript', 'python', 'rust', 'go', 'c', 'cpp', 'java', 'json', 'css', 'html', 'markdown'.",
      },
      config_file: {
        type: 'string',
        description: 'Path to formatter config file (.prettierrc, pyproject.toml, etc.).',
      },
      tab_width: {
        type: 'number',
        description: 'Tab/indent width. Default: 2.',
      },
      use_tabs: {
        type: 'boolean',
        description: 'Use tabs instead of spaces. Default: false.',
      },
      print_width: {
        type: 'number',
        description: 'Print/column width (for Prettier). Default: 80.',
      },
      semi: {
        type: 'boolean',
        description: 'Add semicolons (for Prettier). Default: true.',
      },
      single_quote: {
        type: 'boolean',
        description: 'Use single quotes (for Prettier). Default: false.',
      },
      trailing_comma: {
        type: 'string',
        description: "Trailing comma style (for Prettier): 'none', 'es5', 'all'. Default: 'all'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'format': return await this.formatCode(args);
      case 'check': return await this.checkCode(args);
      case 'fix': return await this.fixCode(args);
      case 'list_formatters': return this.listFormatters();
      default: return `Error: action "${action}" is invalid. Valid: format, check, fix, list_formatters.`;
    }
  }

  private detectFormatter(filePath: string, languageHint?: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const hint = languageHint?.toLowerCase() || '';

    if (hint === 'python' || ext === '.py') return 'black';
    if (hint === 'rust' || ext === '.rs') return 'rustfmt';
    if (hint === 'go' || ext === '.go') return 'gofmt';
    if (['c', 'cpp', 'java'].includes(hint) || ['.c', '.cpp', '.cc', '.h', '.hpp', '.java'].includes(ext)) return 'clang-format';
    if (['json', 'css', 'scss', 'less', 'html', 'markdown', 'md', 'yaml', 'yml'].includes(hint) || ['.json', '.css', '.scss', '.less', '.html', '.md', '.yaml', '.yml'].includes(ext)) return 'prettier';
    return 'prettier';
  }

  private async formatCode(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const code = String(args.code || '');
    const formatterArg = String(args.formatter || 'auto');
    const language = String(args.language || '');

    if (!filePath && !code) return 'Error: either "file_path" or "code" is required.';

    const formatter = formatterArg === 'auto' && filePath
      ? this.detectFormatter(filePath, language)
      : formatterArg === 'auto' ? 'prettier' : formatterArg;

    try {
      const { execFileSync } = await import('child_process');

      switch (formatter) {
        case 'prettier': {
          const args_list = ['--write'];
          if (filePath) args_list.push(filePath);
          if (args.tab_width) args_list.push('--tab-width', String(args.tab_width));
          if (args.use_tabs) args_list.push('--use-tabs');
          if (args.print_width) args_list.push('--print-width', String(args.print_width));
          if (args.semi === false) args_list.push('--no-semi');
          if (args.single_quote) args_list.push('--single-quote');
          if (args.trailing_comma) args_list.push('--trailing-comma', String(args.trailing_comma));
          if (args.config_file) args_list.push('--config', String(args.config_file));

          if (code && !filePath) {
            const tmpFile = path.join(process.cwd(), '.zavorth_fmt_tmp');
            fs.writeFileSync(tmpFile, code);
            args_list.push(tmpFile);
            const result = execFileSync('npx', ['prettier', ...args_list], { timeout: 30000 }).toString();
            try { fs.unlinkSync(tmpFile); } catch (error: any) { /* ignore */ logger.warn('[Zavorth Code Formatter] file cleanup failed', error); }
            return `Formatted with Prettier:\n${result.trim()}`;
          }
          const result = execFileSync('npx', ['prettier', ...args_list], { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }).toString();
          return `Formatted ${filePath} with Prettier:\n${result.trim() || 'Done (file updated in place)'}`;
        }

        case 'black': {
          const blackArgs = [];
          if (filePath) blackArgs.push(filePath);
          if (args.line_length) blackArgs.push('--line-length', String(args.line_length));
          blackArgs.push('--quiet');
          const result = execFileSync('python', ['-m', 'black', ...blackArgs], { timeout: 60000 }).toString();
          return `Formatted with Black:\n${result.trim() || 'Done'}`;
        }

        case 'rustfmt': {
          if (!filePath) return 'Error: "file_path" is required for rustfmt.';
          execFileSync('rustfmt', [filePath], { timeout: 30000 }).toString();
          return `Formatted ${filePath} with rustfmt.`;
        }

        case 'gofmt': {
          if (!filePath) return 'Error: "file_path" is required for gofmt.';
          const result = execFileSync('gofmt', ['-w', filePath], { timeout: 30000 }).toString();
          return `Formatted ${filePath} with gofmt:\n${result.trim() || 'Done'}`;
        }

        case 'clang-format': {
          if (!filePath) return 'Error: "file_path" is required for clang-format.';
          const cfArgs = ['-i', '-style=file', filePath];
          if (args.config_file) cfArgs.push(`--style=file:${args.config_file}`);
          execFileSync('clang-format', cfArgs, { timeout: 30000 }).toString();
          return `Formatted ${filePath} with clang-format.`;
        }

        default:
          return `Error: Unknown formatter "${formatter}".`;
      }
    } catch (error: any) { logger.warn('[Zavorth Code Formatter] process execution failed', error); return ''; }
  }

  private async checkCode(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required for check.';

    const formatter = String(args.formatter || 'auto');
    const resolved = formatter === 'auto' ? this.detectFormatter(filePath, String(args.language || '')) : formatter;

    try {
      const { execFileSync } = await import('child_process');

      switch (resolved) {
        case 'prettier': {
          const result = execFileSync('npx', ['prettier', '--check', filePath], { timeout: 30000 }).toString();
          return `Prettier check:\n${result.trim()}`;
        }
        case 'black': {
          const result = execFileSync('python', ['-m', 'black', '--check', filePath], { timeout: 30000 }).toString();
          return `Black check:\n${result.trim()}`;
        }
        case 'gofmt': {
          const result = execFileSync('gofmt', ['-l', filePath], { timeout: 30000 }).toString();
          return result.trim() ? `Needs formatting:\n${result.trim()}` : 'All files formatted correctly.';
        }
        default:
          return `Check not supported for formatter "${resolved}". Use format action instead.`;
      }
    } catch (error: any) { logger.warn('[Zavorth Code Formatter] process execution failed', error); return ''; }
  }

  private async fixCode(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required for fix.';

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('npx', ['eslint', '--fix', filePath], { timeout: 60000 }).toString();
      return `ESLint fix:\n${result.trim() || 'No issues fixed'}`;
    } catch (error: any) { logger.warn('[Zavorth Code Formatter] process execution failed', error); return ''; }
  }

  private listFormatters(): string {
    return [
      'Available formatters:',
      '  prettier — JS/TS/JSON/CSS/HTML/Markdown/YAML',
      '  black — Python',
      '  rustfmt — Rust',
      '  gofmt — Go',
      '  clang-format — C/C++/Java',
      '',
      'Use "auto" to detect by file extension.',
    ].join('\n');
  }
}
