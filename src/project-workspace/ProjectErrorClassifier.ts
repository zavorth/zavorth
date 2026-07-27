import type { ProjectManifestHook, ResolvedProjectManifest } from './ProjectManifestContract.js';
import type { ProjectProcessLogEntry } from './ProjectProcessContract.js';

export type ProjectLogRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ProjectErrorCategory =
  | 'test_failure'
  | 'typecheck_failure'
  | 'runtime_exception'
  | 'port_conflict'
  | 'dependency_failure'
  | 'credential_or_auth'
  | 'destructive_command'
  | 'process_exit'
  | 'generic_error';

export type ProjectErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

export type ProjectErrorClassification = {
  category: ProjectErrorCategory;
  severity: ProjectErrorSeverity;
  risk: ProjectLogRiskLevel;
  summary: string;
  signals: string[];
  confidence: number;
  autoApplySafe: boolean;
  suggestedPrompt: string;
};

export type ProjectErrorClassifierInput = {
  log: ProjectProcessLogEntry;
  hook?: ProjectManifestHook | null;
  resolved?: ResolvedProjectManifest | null;
};

type ClassificationRule = {
  category: ProjectErrorCategory;
  severity: ProjectErrorSeverity;
  risk: ProjectLogRiskLevel;
  summary: string;
  signal: string;
  pattern: RegExp;
  confidence: number;
  autoApplySafe: boolean;
};

const CLASSIFICATION_RULES: readonly ClassificationRule[] = [
  {
    category: 'destructive_command',
    severity: 'fatal',
    risk: 'critical',
    summary: 'Log mentions a destructive command or broad removal.',
    signal: 'destructive_command',
    pattern: /\b(rm\s+-rf|Remove-Item\b.*-(?:Recurse|Force)|del\s+\/[fsq]|format\s+[a-z]:|git\s+clean\s+-fd|DROP\s+DATABASE)\b/i,
    confidence: 0.92,
    autoApplySafe: false,
  },
  {
    category: 'credential_or_auth',
    severity: 'fatal',
    risk: 'critical',
    summary: 'Log indicates a credential, secret, authentication, or authorization failure.',
    signal: 'credential_or_auth',
    pattern: /\b(API[_-]...KEY|TOKEN|SECRET|PASSWORD|PASSWD|AUTHORIZATION|Bearer\s+[A-Za-z0-9._~+/-]+=*|401|403|unauthori[sz]ed|forbidden)\b/i,
    confidence: 0.9,
    autoApplySafe: false,
  },
  {
    category: 'typecheck_failure',
    severity: 'error',
    risk: 'medium',
    summary: 'Log indica failure de typecheck or compilation TypeScript.',
    signal: 'typescript',
    pattern: /\b(error TS\d+|TypeScript error|tsc\b.*failed|Cannot find name|Type '.*' is not assignable)\b/i,
    confidence: 0.88,
    autoApplySafe: false,
  },
  {
    category: 'test_failure',
    severity: 'error',
    risk: 'medium',
    summary: 'Log indica failure de teste.',
    signal: 'test_failure',
    pattern: /\b(FAIL|FAILED|AssertionError|expect\(.*\)|Tests?:\s+\d+\s+failed|npm\s+test|jest)\b/i,
    confidence: 0.84,
    autoApplySafe: false,
  },
  {
    category: 'port_conflict',
    severity: 'warning',
    risk: 'low',
    summary: 'Log indica conflito de porta or address already em usage.',
    signal: 'port_conflict',
    pattern: /\b(EADDRINUSE|address already in use|port\s+\d+\s+is already in use)\b/i,
    confidence: 0.86,
    autoApplySafe: true,
  },
  {
    category: 'dependency_failure',
    severity: 'error',
    risk: 'medium',
    summary: 'Log indica dependencia or modulo missing.',
    signal: 'dependency_failure',
    pattern: /\b(MODULE_NOT_FOUND|Cannot find module|ERR_MODULE_NOT_FOUND|Could not resolve|missing dependency)\b/i,
    confidence: 0.82,
    autoApplySafe: false,
  },
  {
    category: 'runtime_exception',
    severity: 'error',
    risk: 'medium',
    summary: 'Log indica excecao or error de runtime.',
    signal: 'runtime_exception',
    pattern: /\b(UnhandledPromiseRejection|Uncaught|Exception|TypeError|ReferenceError|SyntaxError|ECONNREFUSED|Command failed|Error:)\b/i,
    confidence: 0.78,
    autoApplySafe: false,
  },
  {
    category: 'process_exit',
    severity: 'warning',
    risk: 'low',
    summary: 'Process exited with a non-zero code.',
    signal: 'process_exit',
    pattern: /\[process:exit\]\s+code=(...!0\b|null\b)\S+/i,
    confidence: 0.74,
    autoApplySafe: true,
  },
];

export class ProjectErrorClassifier {
  public classify(input: ProjectErrorClassifierInput): ProjectErrorClassification {
    const text = normalizeText(input.log.text);
    const matchedRules = CLASSIFICATION_RULES.filter((rule) => rule.pattern.test(text));
    const primary = matchedRules[0] || this.genericRule(input.log);
    const signals = Array.from(new Set([
      primary.signal,
      ...matchedRules.map((rule) => rule.signal),
      input.log.stream === 'stderr' ? 'stderr' : '',
      input.hook?.id ? `hook:${input.hook.id}` : '',
    ].filter(Boolean)));
    const prompt = this.buildSuggestedPrompt(input, primary, text);

    return {
      category: primary.category,
      severity: primary.severity,
      risk: primary.risk,
      summary: primary.summary,
      signals,
      confidence: primary.confidence,
      autoApplySafe: primary.autoApplySafe && !signals.includes('credential_or_auth'),
      suggestedPrompt: prompt,
    };
  }

  private genericRule(log: ProjectProcessLogEntry): ClassificationRule {
    const streamSignal = log.stream === 'stderr' ? 'stderr_error' : 'pattern_match';
    return {
      category: 'generic_error',
      severity: log.stream === 'stderr' ? 'error' : 'warning',
      risk: 'medium',
      summary: 'Hook found an error pattern that needs diagnosis.',
      signal: streamSignal,
      pattern: /./,
      confidence: 0.55,
      autoApplySafe: false,
    };
  }

  private buildSuggestedPrompt(
    input: ProjectErrorClassifierInput,
    primary: ClassificationRule,
    text: string,
  ): string {
    const projectName = input.resolved?.manifest.project.name || 'projeto current';
    const hookPrompt = normalizeText(input.hook?.action.prompt);
    const snippet = firstLine(text).slice(0, 320);
    const base = hookPrompt || 'diagnose a failure e propose a smallest action safe.';
    return [
      base,
      `Project: ${projectName}.`,
      `Processo: ${input.log.processId}.`,
      `Categoria: ${primary.category}; risk: ${primary.risk}; severidade: ${primary.severity}.`,
      `Resumo: ${primary.summary}`,
      `snippet do log: ${snippet || 'without snippet'}`,
      'Use the canonical agent loop and respect existing tools/policies/approvals.',
    ].join('\n');
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function firstLine(text: string): string {
  return text.split(/\r...\n/).map((line) => line.trim()).find(Boolean) || '';
}
