import type {
  RemoteMeshNotebookDockerControlPreviewPayload,
  RemoteMeshNotebookDockerControlReceiptPayload,
  RemoteMeshNotebookProjectFileReadPreviewPayload,
  RemoteMeshNotebookProjectFileReadReceiptPayload,
  RemoteMeshNotebookScopedMcpToolName,
} from './RemoteMeshNotebookScopedMcpServerContract.js';
import type { RemoteMeshJson } from './RemoteMeshSandboxContract.js';

export const ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION =
  '2026-05-05.remote-mesh-r11-mobile-zavorthControl-approval-ux' as const;

export type RemoteMeshNotebookApprovalUxSurface =
  | 'mobile'
  | 'zavorthControl';

export type RemoteMeshNotebookApprovalUxSource =
  | RemoteMeshNotebookDockerControlPreviewPayload
  | RemoteMeshNotebookDockerControlReceiptPayload
  | RemoteMeshNotebookProjectFileReadPreviewPayload
  | RemoteMeshNotebookProjectFileReadReceiptPayload;

export type RemoteMeshNotebookApprovalUxState =
  | 'approval-required'
  | 'receipt';

export type RemoteMeshNotebookApprovalUxTargetKind =
  | 'docker-container'
  | 'project-file';

export type RemoteMeshNotebookApprovalUxCard = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION;
  phase: 'R11';
  surface: RemoteMeshNotebookApprovalUxSurface;
  state: RemoteMeshNotebookApprovalUxState;
  sourceToolName: RemoteMeshNotebookScopedMcpToolName;
  title: string;
  body: string;
  targetKind: RemoteMeshNotebookApprovalUxTargetKind;
  targetLabel: string;
  riskLabel: 'medium' | 'read-only';
  approval: {
    approvalId: string;
    approvalPhrase: string;
    expiresAt: string;
    exactPhraseRequired: true;
    applyToolName: 'notebook.docker.apply_control' | 'notebook.project_files.apply_read';
    applyArguments: {
      approvalId: string;
      approvalPhrase: string;
    };
    rawJsonRequiredFromUser: false;
  } | null;
  receipt: {
    receiptId: string;
    status: 'executed' | 'read';
    summary: string;
    timeline: string[];
    contentPreview: string | null;
  } | null;
  zavorthControl: {
    queue: 'approvals' | 'timeline';
    badge: 'Needs approval' | 'Receipt';
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
  contractVersion: typeof ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION;
  phase: 'R11';
  status: 'ready' | 'failed';
  summary: {
    cards: number;
    approvalCards: number;
    receiptCards: number;
    mobileReady: boolean;
    zavorthControlReady: boolean;
    rawJsonRequiredFromUser: false;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  cards: RemoteMeshNotebookApprovalUxCard[];
  fixtures: {
    dockerPreview: boolean;
    dockerReceipt: boolean;
    projectFilePreview: boolean;
    projectFileReceipt: boolean;
  };
  commands: {
    check: 'npm run remote-mesh:notebook:approval-ux --silent';
    json: 'npm run remote-mesh:notebook:approval-ux:json --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshNotebookApprovalUxService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextAction: 'Real Mobile ZavorthControl Wiring';
  };
};

export type RemoteMeshNotebookApprovalUxFixture = {
  source: RemoteMeshNotebookApprovalUxSource;
  surface?: RemoteMeshNotebookApprovalUxSurface;
};

export type RemoteMeshNotebookApprovalUxSerializable = RemoteMeshJson;

export function buildRemoteMeshNotebookApprovalUxCard(input: {
  source: RemoteMeshNotebookApprovalUxSource;
  surface?: RemoteMeshNotebookApprovalUxSurface;
  generatedAt: string;
}): RemoteMeshNotebookApprovalUxCard {
  const surface = input.surface || 'zavorthControl';
  if (input.source.toolName === 'notebook.docker.preview_control') {
    return buildDockerPreviewCard(input.source, surface, input.generatedAt);
  }
  if (input.source.toolName === 'notebook.docker.apply_control') {
    return buildDockerReceiptCard(input.source, surface, input.generatedAt);
  }
  if (input.source.toolName === 'notebook.project_files.preview_read') {
    return buildProjectFilePreviewCard(input.source, surface, input.generatedAt);
  }
  return buildProjectFileReceiptCard(input.source, surface, input.generatedAt);
}

function buildDockerPreviewCard(
  source: RemoteMeshNotebookDockerControlPreviewPayload,
  surface: RemoteMeshNotebookApprovalUxSurface,
  generatedAt: string,
): RemoteMeshNotebookApprovalUxCard {
  const targetLabel = `${source.action} ${source.container}`;
  return {
    ...baseCard(source, surface, generatedAt),
    state: 'approval-required',
    sourceToolName: source.toolName,
    title: `Approve Docker ${source.action}`,
    body: source.expectedEffect,
    targetKind: 'docker-container',
    targetLabel,
    riskLabel: source.risk,
    approval: {
      approvalId: source.approvalId,
      approvalPhrase: source.approvalPhrase,
      expiresAt: source.expiresAt,
      exactPhraseRequired: true,
      applyToolName: 'notebook.docker.apply_control',
      applyArguments: {
        approvalId: source.approvalId,
        approvalPhrase: source.approvalPhrase,
      },
      rawJsonRequiredFromUser: false,
    },
    receipt: null,
    zavorthControl: approvalZavorthControl('Docker lifecycle approval', 'Approve Docker action'),
    mobile: approvalMobile(
      `Docker ${source.action}`,
      `Zavorth wants to ${source.action} ${source.container}.`,
      source.approvalPhrase,
    ),
    safety: {
      ...baseSafety(),
      singleUseApproval: true,
      exactPhraseRequired: true,
      noFilesystemMutation: true,
      noProjectFileWrite: true,
      noDockerRawControl: true,
    },
  };
}

function buildDockerReceiptCard(
  source: RemoteMeshNotebookDockerControlReceiptPayload,
  surface: RemoteMeshNotebookApprovalUxSurface,
  generatedAt: string,
): RemoteMeshNotebookApprovalUxCard {
  const summary = `Docker ${source.action} executed for ${source.container}.`;
  return {
    ...baseCard(source, surface, generatedAt),
    state: 'receipt',
    sourceToolName: source.toolName,
    title: `Docker ${source.action} receipt`,
    body: summary,
    targetKind: 'docker-container',
    targetLabel: source.container,
    riskLabel: 'medium',
    approval: null,
    receipt: {
      receiptId: source.receiptId,
      status: 'executed',
      summary,
      timeline: [
        `Approval ${source.approvalId} accepted.`,
        `Docker ${source.action} executed.`,
        'Receipt recorded for ZavorthControl timeline.',
      ],
      contentPreview: null,
    },
    zavorthControl: receiptZavorthControl('Docker lifecycle receipt'),
    mobile: receiptMobile('Docker done', summary),
    safety: {
      ...baseSafety(),
      singleUseApproval: true,
      exactPhraseRequired: true,
      noFilesystemMutation: source.filesystemMutationPerformed === false,
      noProjectFileWrite: true,
      noDockerRawControl: source.rawCommandSerialized === false,
    },
  };
}

function buildProjectFilePreviewCard(
  source: RemoteMeshNotebookProjectFileReadPreviewPayload,
  surface: RemoteMeshNotebookApprovalUxSurface,
  generatedAt: string,
): RemoteMeshNotebookApprovalUxCard {
  const targetLabel = `${source.project}/${source.relativePath}`;
  return {
    ...baseCard(source, surface, generatedAt),
    state: 'approval-required',
    sourceToolName: source.toolName,
    title: 'Approve file read',
    body: `Read ${source.relativePath} from project ${source.project}. Size: ${source.sizeBytes} bytes.`,
    targetKind: 'project-file',
    targetLabel,
    riskLabel: 'read-only',
    approval: {
      approvalId: source.approvalId,
      approvalPhrase: source.approvalPhrase,
      expiresAt: source.expiresAt,
      exactPhraseRequired: true,
      applyToolName: 'notebook.project_files.apply_read',
      applyArguments: {
        approvalId: source.approvalId,
        approvalPhrase: source.approvalPhrase,
      },
      rawJsonRequiredFromUser: false,
    },
    receipt: null,
    zavorthControl: approvalZavorthControl('Project file read approval', 'Approve file read'),
    mobile: approvalMobile(
      'Read project file',
      `Zavorth wants to read ${targetLabel}.`,
      source.approvalPhrase,
    ),
    safety: {
      ...baseSafety(),
      singleUseApproval: true,
      exactPhraseRequired: true,
      noFilesystemMutation: source.filesystemMutationPerformed === false,
      noProjectFileWrite: true,
      noDockerRawControl: true,
    },
  };
}

function buildProjectFileReceiptCard(
  source: RemoteMeshNotebookProjectFileReadReceiptPayload,
  surface: RemoteMeshNotebookApprovalUxSurface,
  generatedAt: string,
): RemoteMeshNotebookApprovalUxCard {
  const targetLabel = `${source.project}/${source.relativePath}`;
  const summary = `Read ${targetLabel} (${source.sizeBytes} bytes).`;
  return {
    ...baseCard(source, surface, generatedAt),
    state: 'receipt',
    sourceToolName: source.toolName,
    title: 'Project file read receipt',
    body: summary,
    targetKind: 'project-file',
    targetLabel,
    riskLabel: 'read-only',
    approval: null,
    receipt: {
      receiptId: source.receiptId,
      status: 'read',
      summary,
      timeline: [
        `Approval ${source.approvalId} accepted.`,
        'File content returned after approval.',
        'Receipt recorded for ZavorthControl timeline.',
      ],
      contentPreview: source.content.slice(0, 240),
    },
    zavorthControl: receiptZavorthControl('Project file read receipt'),
    mobile: receiptMobile('File read complete', summary),
    safety: {
      ...baseSafety(),
      singleUseApproval: true,
      exactPhraseRequired: true,
      noFilesystemMutation: source.filesystemMutationPerformed === false,
      noProjectFileWrite: source.rawPathSerialized === false,
      noDockerRawControl: true,
    },
  };
}

function baseCard(
  source: RemoteMeshNotebookApprovalUxSource,
  surface: RemoteMeshNotebookApprovalUxSurface,
  generatedAt: string,
) {
  return {
    generatedAt,
    contractVersion: ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION,
    phase: 'R11' as const,
    surface,
    sourceToolName: source.toolName,
  };
}

function approvalZavorthControl(timelineLabel: string, primaryActionLabel: string) {
  return {
    queue: 'approvals' as const,
    badge: 'Needs approval' as const,
    primaryActionLabel,
    secondaryActionLabel: 'Reject',
    timelineLabel,
  };
}

function receiptZavorthControl(timelineLabel: string) {
  return {
    queue: 'timeline' as const,
    badge: 'Receipt' as const,
    primaryActionLabel: null,
    secondaryActionLabel: 'Close',
    timelineLabel,
  };
}

function approvalMobile(shortTitle: string, promptText: string, phrase: string) {
  return {
    shortTitle,
    promptText,
    confirmInstruction: `Approve with exact phrase: ${phrase}`,
    receiptText: null,
  };
}

function receiptMobile(shortTitle: string, receiptText: string) {
  return {
    shortTitle,
    promptText: receiptText,
    confirmInstruction: null,
    receiptText,
  };
}

function baseSafety() {
  return {
    previewBeforeApply: true as const,
    noRawShell: true as const,
    noRawJsonCopyRequired: true as const,
    noRawCommandSerialized: true as const,
    noSecretSerialized: true as const,
  };
}
