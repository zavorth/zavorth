export type EvaluatorCategory = 'security' | 'clean_code' | 'performance';

export type EvaluationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DissentingOpinion {
  evaluatorId: string;
  evaluatorName: string;
  category: EvaluatorCategory;
  argument: string;
  severity: EvaluationSeverity;
  suggestedRemedy?: string | null;
}

export interface DialecticDebate {
  topic: string;
  thesis: {
    personaId: string;
    name: string;
    position: string;
    arguments: string[];
  };
  antithesis: {
    personaId: string;
    name: string;
    position: string;
    counterArguments: string[];
  };
  synthesis: {
    consensusPoints: string[];
    openRisks: string[];
    actionableRecommendation: string;
  };
}

export interface PeerReviewAssessment {
  approved: boolean;
  verdict: 'approved' | 'attention' | 'vetoed';
  dissentingOpinions: DissentingOpinion[];
  consensusSummary: string;
  dialecticDebate?: DialecticDebate | null;
}

export interface PeerReviewActionInput {
  toolName: string;
  pattern: string;
  risk?: string | null;
  proposedCode?: string | null;
  targetFile?: string | null;
  intentDescription?: string | null;
}
