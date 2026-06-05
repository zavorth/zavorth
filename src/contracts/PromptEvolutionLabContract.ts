export const PROMPT_EVOLUTION_LAB_VERSION = 'prompt-evolution-lab/v1' as const;

export type PromptEvolutionObjective =
  | 'accuracy'
  | 'safety'
  | 'brevity'
  | 'profile-fit'
  | 'approval-calm'
  | 'tool-discipline';

export type PromptEvolutionCandidateStatus = 'baseline' | 'candidate' | 'blocked';

export type PromptEvolutionEvalCase = {
  id: string;
  prompt: string;
  expectedBehaviors: string[];
  forbiddenBehaviors: string[];
  weight?: number;
};

export type PromptEvolutionInput = {
  promptId?: string | null;
  profileId?: string | null;
  basePrompt: string;
  objectives?: PromptEvolutionObjective[];
  cases?: PromptEvolutionEvalCase[];
  candidateLimit?: number | null;
};

export type PromptEvolutionCandidate = {
  id: string;
  status: PromptEvolutionCandidateStatus;
  family: string;
  promptHash: string;
  promptPreview: string;
  score: number;
  safetyScore: number;
  behaviorScore: number;
  reasons: string[];
  blockedReasons: string[];
  diffSummary: string[];
};

export type PromptEvolutionSnapshot = {
  generatedAt: string;
  version: typeof PROMPT_EVOLUTION_LAB_VERSION;
  promptId: string;
  profileId: string;
  status: 'ready' | 'blocked' | 'needs-review';
  objectives: PromptEvolutionObjective[];
  cases: PromptEvolutionEvalCase[];
  candidates: PromptEvolutionCandidate[];
  bestCandidate: PromptEvolutionCandidate | null;
  promotion: {
    candidateId: string | null;
    requiresApproval: true;
    noAutoApply: true;
    regressionGateRequired: true;
    sandboxSmokeRequired: true;
    rollbackAvailable: true;
    command: string | null;
  };
  safety: {
    rawSystemPromptSerialized: false;
    promptChangesNeverAutoApply: true;
    policyBypassBlocked: true;
    secretPatternsBlocked: true;
    approvalSemanticsPreserved: true;
  };
  receipts: Array<{
    id: string;
    kind: 'candidate' | 'policy' | 'eval';
    summary: string;
    rawPromptSerialized: false;
  }>;
};
