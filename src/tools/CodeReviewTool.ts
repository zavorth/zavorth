
import fs from 'fs';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type FocusArea = 'security' | 'performance' | 'style' | 'all';
type Severity = 'info' | 'warning' | 'error' | 'critical';

interface ReviewFinding {
  severity: Severity;
  category: string;
  line: number | null;
  message: string;
  suggestion: string;
}

export class CodeReviewTool extends BaseTool {
  public readonly name = 'code_review';

  public readonly description =
    'Realiza review de codigo analisando diffs e fornecendo feedback estruturado.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Path to the file or diff to analyze.',
      },
      focus: {
        type: 'string',
        description: "Foco da analise: 'security', 'performance', 'style', 'all'. Default: 'all'.",
      },
      severity_threshold: {
        type: 'string',
        description: "Severidade minima: 'info', 'warning', 'error', 'critical'. Default: 'info'.",
      },
    },
    required: ['target'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const target = String(args.target || '');
    if (!target) return 'Error: the "target" parameter is required.';

    const focus = String(args.focus || 'all') as FocusArea;
    const validFocus: FocusArea[] = ['security', 'performance', 'style', 'all'];
    if (!validFocus.includes(focus)) {
      return `Error: invalid focus "${focus}" is invalid. Use: ${validFocus.join(', ')}.`;
    }

    const severityThreshold = String(args.severity_threshold || 'info') as Severity;
    const validSeverities: Severity[] = ['info', 'warning', 'error', 'critical'];
    if (!validSeverities.includes(severityThreshold)) {
      return `Error: invalid severity "${severityThreshold}" is invalid. Use: ${validSeverities.join(', ')}.`;
    }

    let code: string;
    const isDiff = target.startsWith('diff ') || target.includes('\n---') || target.includes('+++');

    if (isDiff) {
      code = target;
    } else {
      try {
        if (fs.existsSync(target)) {
          code = fs.readFileSync(target, 'utf-8');
        } else {
          code = target;
        }
      } catch (error: unknown) {logger.warn('[Code] filesystem operation failed', error);
    code = target;
  }
    }

    try {
      const findings = this.analyzeCode(code, focus, severityThreshold);
      return this.formatFindings(findings, target, focus, severityThreshold);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Code] filesystem operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Code analysis error: ${message}`;
  }
  }

  private analyzeCode(code: string, focus: FocusArea, threshold: Severity): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = code.split('\n');
    const severityOrder: Severity[] = ['info', 'warning', 'error', 'critical'];
    const thresholdIndex = severityOrder.indexOf(threshold);

    const addFinding = (finding: ReviewFinding) => {
      if (severityOrder.indexOf(finding.severity) >= thresholdIndex) {
        findings.push(finding);
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (focus === 'security' || focus === 'all') {
        if (/eval\s*\(/.test(line)) {
          addFinding({ severity: 'critical', category: 'security', line: lineNum, message: 'Use of eval() detected.', suggestion: 'Replace eval() with safer alternatives.' });
        }
        if (/innerHTML\s*=/.test(line)) {
          addFinding({ severity: 'error', category: 'security', line: lineNum, message: 'Atribuicao direta a innerHTML.', suggestion: 'Use textContent ou sanitize o HTML antes de atribuir.' });
        }
        if (/password|secret|token|api_key/i.test(line) && /=\s*['"][^'"]+['"]/.test(line)) {
          addFinding({ severity: 'critical', category: 'security', line: lineNum, message: 'Possivel credencial hardcoded.', suggestion: 'Use variaveis de ambiente ou um secret manager.' });
        }
        if (/exec\s*\(|execSync\s*\(/.test(line)) {
          addFinding({ severity: 'warning', category: 'security', line: lineNum, message: 'Uso de exec/execSync.', suggestion: 'Valide e sanitize a entrada antes de executar comandos.' });
        }
      }

      if (focus === 'performance' || focus === 'all') {
        if (/\.forEach\s*\(/.test(line) && lines[i + 1]?.includes('await')) {
          addFinding({ severity: 'warning', category: 'performance', line: lineNum, message: 'forEach with await does not run in parallel.', suggestion: 'Use Promise.all with map or for...of for sequential execution.' });
        }
        if (/SELECT\s+\*\s+FROM/i.test(line)) {
          addFinding({ severity: 'warning', category: 'performance', line: lineNum, message: 'SELECT * detected.', suggestion: 'Select only the columns you need.' });
        }
        if (/JSON\.parse.*JSON\.stringify/.test(line)) {
          addFinding({ severity: 'info', category: 'performance', line: lineNum, message: 'Deep clone via JSON parse/stringify.', suggestion: 'Consider structuredClone() for better performance.' });
        }
      }

      if (focus === 'style' || focus === 'all') {
        if (line.length > 120) {
          addFinding({ severity: 'info', category: 'style', line: lineNum, message: `Linha com ${line.length} caracteres (>120).`, suggestion: 'Considere quebrar em multiple linhas.' });
        }
        if (/\t/.test(line) && /^ /.test(line)) {
          addFinding({ severity: 'info', category: 'style', line: lineNum, message: 'Mixed indentation (tabs and spaces).', suggestion: 'Use consistent indentation.' });
        }
        if (/console\.log\s*\(/.test(line)) {
          addFinding({ severity: 'info', category: 'style', line: lineNum, message: 'console.log() encontrado.', suggestion: 'Remova logs de debug antes de commit.' });
        }
      }
    }

    return findings;
  }

  private formatFindings(findings: ReviewFinding[], target: string, focus: FocusArea, threshold: Severity): string {
    if (findings.length === 0) {
      return `Review completed for "${target}". No problems found (focus: ${focus}, minimum severity: ${threshold}).`;
    }

    const lines: string[] = [];
    lines.push(`Review de codigo: ${target}`);
    lines.push(`Foco: ${focus} | Severidade minima: ${threshold}`);
    lines.push(`Total de achados: ${findings.length}`);
    lines.push('');

    const grouped = {
      critical: findings.filter((f) => f.severity === 'critical'),
      error: findings.filter((f) => f.severity === 'error'),
      warning: findings.filter((f) => f.severity === 'warning'),
      info: findings.filter((f) => f.severity === 'info'),
    };

    for (const [severity, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      lines.push(`[${severity.toUpperCase()}] (${items.length})`);
      for (const item of items) {
        const lineRef = item.line ? `L${item.line}` : '-';
        lines.push(`  ${lineRef} [${item.category}] ${item.message}`);
        lines.push(`       Suggestion: ${item.suggestion}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }
}
