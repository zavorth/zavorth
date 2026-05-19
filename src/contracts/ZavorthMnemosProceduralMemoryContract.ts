export const ZAVORTH_MNEMOS_PROCEDURAL_MEMORY_VERSION = 'zavorth-mnemos-procedural-memory-v1' as const;

export type ZavorthMnemosProceduralRuleKind =
  | 'approval-policy'
  | 'workflow-preference'
  | 'provider-preference'
  | 'safety-boundary'
  | 'communication-preference'
  | 'general-procedure';

export type ZavorthMnemosProceduralRuleStatus = 'draft' | 'active' | 'revoked';

export type ZavorthMnemosProceduralRisk = 'low' | 'medium' | 'high' | 'critical';

export type ZavorthMnemosProceduralRule = {
  id: string;
  kind: ZavorthMnemosProceduralRuleKind;
  status: ZavorthMnemosProceduralRuleStatus;
  statement: string;
  scope: string[];
  sourceText: string;
  confidence: number;
  risk: ZavorthMnemosProceduralRisk;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  approvalId: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  secretFree: boolean;
};

export type ZavorthMnemosProceduralMemorySnapshot = {
  version: typeof ZAVORTH_MNEMOS_PROCEDURAL_MEMORY_VERSION;
  generatedAt: string;
  action: 'preview' | 'apply' | 'list' | 'revoke' | 'query';
  status: 'ready' | 'requires-approval' | 'blocked' | 'not-found';
  rule: ZavorthMnemosProceduralRule | null;
  rules: ZavorthMnemosProceduralRule[];
  summary: {
    total: number;
    active: number;
    draft: number;
    revoked: number;
    returned: number;
  };
  safety: {
    providerCall: false;
    networkCall: false;
    durableMutation: boolean;
    approvalRequiredForWrite: true;
    secretsRedacted: true;
    noRawSecrets: true;
    explicitRevocation: true;
  };
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: boolean;
    approvalId: string | null;
  };
};
