export const ZAVORTH_MNEMOS_LINT_VERSION = 'zavorth-mnemos-lint-v1' as const;

export type ZavorthMnemosLintStatus = 'passed' | 'needs-review' | 'blocked';

export type ZavorthMnemosLintSeverity = 'info' | 'warning' | 'error' | 'critical';

export type ZavorthMnemosLintKind =
  | 'schema-drift'
  | 'broken-link'
  | 'secret-like'
  | 'contradiction'
  | 'prompt-injection'
  | 'index'
  | 'stale'
  | 'path-boundary';

export type ZavorthMnemosLintFinding = {
  id: string;
  severity: ZavorthMnemosLintSeverity;
  kind: ZavorthMnemosLintKind;
  pagePath: string | null;
  summary: string;
  recommendation: string;
  operatorDecisionRequired: boolean;
};

export type ZavorthMnemosLintSummary = {
  pages: number;
  findings: number;
  info: number;
  warnings: number;
  errors: number;
  critical: number;
  contradictions: number;
  brokenLinks: number;
  schemaDrift: number;
  secretFindings: number;
};

export type ZavorthMnemosLintSnapshot = {
  version: typeof ZAVORTH_MNEMOS_LINT_VERSION;
  generatedAt: string;
  status: ZavorthMnemosLintStatus;
  summary: ZavorthMnemosLintSummary;
  findings: ZavorthMnemosLintFinding[];
  safety: {
    providerCall: false;
    networkCall: false;
    durableMutation: false;
    wikiRootOnly: true;
    operatorDecisionForCritical: true;
    secretsRedacted: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: false;
  };
};
