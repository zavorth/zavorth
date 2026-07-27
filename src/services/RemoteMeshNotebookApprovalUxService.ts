import type {
  RemoteMeshNotebookDockerControlPreviewPayload,
  RemoteMeshNotebookDockerControlReceiptPayload,
  RemoteMeshNotebookProjectFileReadPreviewPayload,
  RemoteMeshNotebookProjectFileReadReceiptPayload,
} from '../contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import type {
  RemoteMeshNotebookApprovalUxCard,
  RemoteMeshNotebookApprovalUxFixture,
  RemoteMeshNotebookApprovalUxSnapshot,
  RemoteMeshNotebookApprovalUxSource,
  RemoteMeshNotebookApprovalUxSurface,
} from '../contracts/RemoteMeshNotebookApprovalUxContract.js';
import {
  buildRemoteMeshNotebookApprovalUxCard,
  ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION,
} from '../contracts/RemoteMeshNotebookApprovalUxContract.js';

type RemoteMeshNotebookApprovalUxRuntime = {
  now?: () => Date;
};

export class RemoteMeshNotebookApprovalUxService {
  private readonly now: () => Date;

  constructor(runtime: RemoteMeshNotebookApprovalUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildCard(
    source: RemoteMeshNotebookApprovalUxSource,
    surface: RemoteMeshNotebookApprovalUxSurface = 'zavorthControl',
  ): RemoteMeshNotebookApprovalUxCard {
    return buildRemoteMeshNotebookApprovalUxCard({
      source,
      surface,
      generatedAt: this.now().toISOString(),
    });
  }

  public buildSnapshot(input: {
    fixtures: RemoteMeshNotebookApprovalUxFixture[];
  }): RemoteMeshNotebookApprovalUxSnapshot {
    const cards = input.fixtures.map((fixture) => this.buildCard(fixture.source, fixture.surface || 'zavorthControl'));
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION,
      phase: 'R11',
      status: cards.length > 0 ? 'ready' : 'failed',
      summary: {
        cards: cards.length,
        approvalCards: cards.filter((card) => card.state === 'approval-required').length,
        receiptCards: cards.filter((card) => card.state === 'receipt').length,
        mobileReady: cards.some((card) => card.surface === 'mobile'),
        zavorthControlReady: cards.some((card) => card.surface === 'zavorthControl'),
        rawJsonRequiredFromUser: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      cards,
      fixtures: {
        dockerPreview: cards.some((card) => card.sourceToolName === 'notebook.docker.preview_control'),
        dockerReceipt: cards.some((card) => card.sourceToolName === 'notebook.docker.apply_control'),
        projectFilePreview: cards.some((card) => card.sourceToolName === 'notebook.project_files.preview_read'),
        projectFileReceipt: cards.some((card) => card.sourceToolName === 'notebook.project_files.apply_read'),
      },
      commands: {
        check: 'npm run remote-mesh:notebook:approval-ux --silent',
        json: 'npm run remote-mesh:notebook:approval-ux:json --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshNotebookApprovalUxService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Real Mobile ZavorthControl Wiring',
      },
    };
  }

  private dockerPreviewCard(
    source: RemoteMeshNotebookDockerControlPreviewPayload,
    surface: RemoteMeshNotebookApprovalUxSurface,
  ): RemoteMeshNotebookApprovalUxCard {
    const targetLabel = `${source.action} ${source.container}`;
    return {
      ...this.base(source, surface),
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

  private dockerReceiptCard(
    source: RemoteMeshNotebookDockerControlReceiptPayload,
    surface: RemoteMeshNotebookApprovalUxSurface,
  ): RemoteMeshNotebookApprovalUxCard {
    const summary = `Docker ${source.action} executed for ${source.container}.`;
    return {
      ...this.base(source, surface),
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

  private projectFilePreviewCard(
    source: RemoteMeshNotebookProjectFileReadPreviewPayload,
    surface: RemoteMeshNotebookApprovalUxSurface,
  ): RemoteMeshNotebookApprovalUxCard {
    const targetLabel = `${source.project}/${source.relativePath}`;
    return {
      ...this.base(source, surface),
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

  private projectFileReceiptCard(
    source: RemoteMeshNotebookProjectFileReadReceiptPayload,
    surface: RemoteMeshNotebookApprovalUxSurface,
  ): RemoteMeshNotebookApprovalUxCard {
    const targetLabel = `${source.project}/${source.relativePath}`;
    const summary = `Read ${targetLabel} (${source.sizeBytes} bytes).`;
    return {
      ...this.base(source, surface),
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

  private base(source: RemoteMeshNotebookApprovalUxSource, surface: RemoteMeshNotebookApprovalUxSurface) {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_R11_APPROVAL_UX_VERSION,
      phase: 'R11' as const,
      surface,
      sourceToolName: source.toolName,
    };
  }
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
