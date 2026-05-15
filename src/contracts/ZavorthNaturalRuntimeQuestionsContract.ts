export const ZAVORTH_NATURAL_RUNTIME_QUESTIONS_CONTRACT_VERSION = '2026-05-15.experience-layer.phase-11' as const;

export type ZavorthNaturalRuntimeQuestionIntent =
  | 'runtime_summary'
  | 'providers_ready'
  | 'channels_ready'
  | 'approvals_pending'
  | 'receipts_summary'
  | 'setup_gaps'
  | 'safety_boundary'
  | 'unknown';

export type ZavorthNaturalRuntimeQuestionSource = {
  id: string;
  surface: string;
  command: string;
  route: string | null;
  executionAuthority: false;
};

export type ZavorthNaturalRuntimeAnswerCard = {
  id: string;
  title: string;
  status: 'ready' | 'attention' | 'blocked' | 'unknown';
  summary: string;
  bullets: string[];
  nextAction: string;
};

export type ZavorthNaturalRuntimeQuestionsSnapshot = {
  contractVersion: typeof ZAVORTH_NATURAL_RUNTIME_QUESTIONS_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'natural-runtime-questions';
  generatedAt: string;
  question: string;
  normalizedQuestion: string;
  intent: ZavorthNaturalRuntimeQuestionIntent;
  confidence: 'high' | 'medium' | 'low';
  answer: {
    short: string;
    cards: ZavorthNaturalRuntimeAnswerCard[];
    askableFollowups: string[];
  };
  sources: ZavorthNaturalRuntimeQuestionSource[];
  runtimeProjection: {
    dashboardRoute: '/dashboard';
    satelliteRoute: '/satellite';
    cliCommand: 'zavorth ask-runtime';
    executionAuthority: false;
  };
  safety: {
    projectionOnly: true;
    rawSecretsSerialized: false;
    noLiveNetworkByDefault: true;
    doesNotMutateConfiguration: true;
    policyBrokerStillRequiredForActions: true;
  };
  invariants: string[];
};
