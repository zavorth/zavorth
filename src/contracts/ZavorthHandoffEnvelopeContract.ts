export const ZAVORTH_HANDOFF_ENVELOPE_VERSION = 'zavorth-handoff-envelope-v1';

export type ZavorthHandoffEnvelopeSectionId =
  | 'active-mandate'
  | 'current-architecture-decisions'
  | 'modified-paths'
  | 'tool-failure-log'
  | 'security-approvals-granted'
  | 'verbatim-user-directives'
  | 'remaining-todo-checklist'
  | 'simulated-state-preview'
  | 'next-prescribed-action';

export type ZavorthHandoffEnvelopeSection = {
  id: ZavorthHandoffEnvelopeSectionId;
  title: string;
  items: string[];
};

export type ZavorthHandoffEnvelopeInput = {
  sessionId?: string | null;
  workspace?: string | null;
  operator?: string | null;
  activeMandate?: string | null;
  architectureDecisions?: string[] | null;
  modifiedPaths?: string[] | null;
  securityApprovals?: string[] | null;
  remainingTodos?: string[] | null;
  simulatedStatePreview?: string[] | null;
  nextPrescribedAction?: string | null;
};

export type ZavorthHandoffEnvelopeSnapshot = {
  version: typeof ZAVORTH_HANDOFF_ENVELOPE_VERSION;
  generatedAt: string;
  status: 'preview-ready';
  sessionId: string | null;
  workspace: string | null;
  operator: string | null;
  sections: ZavorthHandoffEnvelopeSection[];
  markdown: string;
  receipt: {
    id: string;
    providerCall: false;
    durableMutation: false;
    toolExecution: false;
    secretsRedacted: true;
    approvalRequiredToPersist: true;
  };
};

export const ZAVORTH_HANDOFF_ENVELOPE_SECTION_TITLES: Record<ZavorthHandoffEnvelopeSectionId, string> = {
  'active-mandate': 'Active Mandate',
  'current-architecture-decisions': 'Current Architecture Decisions',
  'modified-paths': 'Modified Paths',
  'tool-failure-log': 'Tool Failure Log',
  'security-approvals-granted': 'Security Approvals Granted',
  'verbatim-user-directives': 'Verbatim User Directives',
  'remaining-todo-checklist': 'Remaining TODO Checklist',
  'simulated-state-preview': 'Simulated State Preview',
  'next-prescribed-action': 'Next Prescribed Action',
};

export const ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER: ZavorthHandoffEnvelopeSectionId[] = [
  'active-mandate',
  'current-architecture-decisions',
  'modified-paths',
  'tool-failure-log',
  'security-approvals-granted',
  'verbatim-user-directives',
  'remaining-todo-checklist',
  'simulated-state-preview',
  'next-prescribed-action',
];
