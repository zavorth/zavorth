export type RemoteMeshNotebookApprovalUxSurface = 'zavorthControl' | 'mobile' | 'zavorthControl';

export type RemoteMeshNotebookApprovalUxSource = {
  toolName?: string;
  approvalId?: string;
  approvalPhrase?: string;
  expiresAt?: string;
  receiptId?: string;
  container?: string;
  project?: string;
  relativePath?: string;
  path?: string;
  action?: string;
  expectedEffect?: string;
  summary?: string;
  content?: string;
  target?: string;
  sizeBytes?: number;
  filesystemMutationPerformed?: boolean;
  rawCommandSerialized?: boolean;
  rawPathSerialized?: boolean;
  risk?: string;
};

export type RemoteMeshNotebookApprovalUxFixture = {
  source: RemoteMeshNotebookApprovalUxSource;
  surface?: RemoteMeshNotebookApprovalUxSurface;
};

export type RemoteMeshNotebookApprovalUxCard = {
  generatedAt: string;
  contractVersion: string;
  phase: string;
  surface: RemoteMeshNotebookApprovalUxSurface;
  state: 'approval-required' | 'receipt';
  sourceToolName: string;
  title: string;
  body: string;
  targetKind: 'docker-container' | 'project-file';
  targetLabel: string;
  riskLabel: string;
  approval: {
    approvalId: string;
    approvalPhrase: string;
    expiresAt: string;
    exactPhraseRequired: boolean;
    applyToolName: string;
    applyArguments: { approvalId: string; approvalPhrase: string };
    rawJsonRequiredFromUser: boolean;
  } | null;
  receipt: {
    receiptId: string;
    status: string;
    summary: string;
    timeline: string[];
    contentPreview: string | null;
  } | null;
  zavorthControl: {
    queue: 'approvals' | 'timeline';
    badge: string;
    primaryActionLabel: string | null;
    secondaryActionLabel: string;
    timelineLabel: string;
  };
  mobile: {
    shortTitle: string;
    promptText: string;
    confirmInstruction: string | null;
    receiptText: string | null;
  };
  safety: {
    previewBeforeApply: true;
    singleUseApproval: boolean;
    exactPhraseRequired: boolean;
    noRawShell: true;
    noRawJsonCopyRequired: true;
    noRawCommandSerialized: true;
    noSecretSerialized: true;
    noFilesystemMutation: boolean;
    noProjectFileWrite: boolean;
    noDockerRawControl: boolean;
  };
};

export type RemoteMeshNotebookApprovalUxSnapshot = {
  generatedAt: string;
  contractVersion: string;
  phase: string;
  status: string;
  summary: {
    cards: number;
    approvalCards: number;
    receiptCards: number;
    mobileReady: boolean;
    zavorthControlReady: boolean;
    rawJsonRequiredFromUser: boolean;
    rawCommandSerialized: boolean;
    secretValuesSerialized: boolean;
  };
  cards: RemoteMeshNotebookApprovalUxCard[];
  fixtures: {
    dockerPreview: boolean;
    dockerReceipt: boolean;
    projectFilePreview: boolean;
    projectFileReceipt: boolean;
  };
  commands: {
    check: string;
    json: string;
    focusedTests: string;
    typecheck: string;
    nextAction: string;
  };
};

export declare const ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION: string;
export declare function buildRemoteMeshNotebookApprovalUxCard(input: {
  source: RemoteMeshNotebookApprovalUxSource;
  surface?: RemoteMeshNotebookApprovalUxSurface;
  generatedAt?: string;
}): RemoteMeshNotebookApprovalUxCard;
export declare function buildRemoteMeshNotebookApprovalUxSnapshot(input?: {
  generatedAt?: string;
  fixtures?: RemoteMeshNotebookApprovalUxFixture[];
}): RemoteMeshNotebookApprovalUxSnapshot;
