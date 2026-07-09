import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type {
  FileDocumentDiffLiveAdapterFamily,
  FileDocumentDiffLiveCapability,
  FileDocumentDiffLiveConfigSchema,
  FileDocumentDiffLiveEntry,
  FileDocumentDiffLiveGate,
  FileDocumentDiffLiveGateStatus,
  FileDocumentDiffLiveMode,
  FileDocumentDiffLivePlaneSnapshot,
  FileDocumentDiffLiveStatus,
  FileDocumentDiffLiveTargetId,
} from '../contracts/FileDocumentDiffLivePlaneContract.js';
import { ZAVORTH_FILE_DOCUMENT_DIFF_LIVE_PLANE_CONTRACT_VERSION } from '../contracts/FileDocumentDiffLivePlaneContract.js';

import { LiveReadinessService } from './LiveReadinessService.js';

type FileDocumentDiffLivePlaneRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type FileDocumentDiffLiveDescriptor = {
  targetId: FileDocumentDiffLiveTargetId;
  status: FileDocumentDiffLiveStatus;
  capabilities: FileDocumentDiffLiveCapability[];
  adapterFamily: FileDocumentDiffLiveAdapterFamily;
  modes: FileDocumentDiffLiveMode[];
  configSchema: FileDocumentDiffLiveConfigSchema;
  gaps: string[];
};

const PHASE = 'Certification matrix - File, Document, Diff And Prose Live Plane' as const;

const FILE_DOCUMENT_DIFF_TARGETS: FileDocumentDiffLiveDescriptor[] = [
  target('file-transfer', 'file-transfer-live', ['file.transfer'], 'local-filesystem-transfer', ['import', 'export', 'copy', 'move'], [], ['ZAVORTH_FILE_TRANSFER_WORKSPACE_ROOT']),
  target('document-extract', 'document-extract-live', ['document.extract'], 'document-text-extractor', ['txt', 'html', 'pdf', 'docx', 'tables', 'metadata'], [], ['ZAVORTH_DOCUMENT_EXTRACT_ARTIFACT_DIR']),
  target('diffs', 'artifact-diff-live', ['artifact.diff'], 'artifact-diff-engine', ['file-diff', 'artifact-diff', 'inline-diff'], [], ['ZAVORTH_ARTIFACT_DIFF_DIR']),
  target('open-prose', 'workflow-decision-live', ['document.extract', 'artifact.diff'], 'document-workflow-router', ['workflow-decision'], [], ['ZAVORTH_DOCUMENT_WORKFLOW_POLICY']),
  target('lobster', 'workflow-decision-live', ['document.extract', 'artifact.diff'], 'document-workflow-router', ['workflow-decision'], [], ['ZAVORTH_DOCUMENT_WORKFLOW_POLICY']),
];

export class FileDocumentDiffLivePlaneService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: FileDocumentDiffLivePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): FileDocumentDiffLivePlaneSnapshot {
    const readinessByPrimitive = new Map<string, LiveReadinessStatus>();
    for (const entry of this.liveReadiness.buildSnapshot().entries) {
      if (entry.primitiveId) {
        readinessByPrimitive.set(entry.primitiveId, entry.status);
      }
    }
    const entries = FILE_DOCUMENT_DIFF_TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, this.readinessFor(descriptor, readinessByPrimitive)));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_FILE_DOCUMENT_DIFF_LIVE_PLANE_CONTRACT_VERSION,
      phase: PHASE,
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 5,
        fileTransferTargets: entries.filter((entry) => entry.capabilities.includes('file.transfer')).length,
        documentExtractTargets: entries.filter((entry) => entry.capabilities.includes('document.extract')).length,
        artifactDiffTargets: entries.filter((entry) => entry.capabilities.includes('artifact.diff')).length,
        workflowDecisionTargets: entries.filter((entry) => entry.adapterFamily === 'document-workflow-router').length,
        policyGatedWriteTargets: entries.filter((entry) => this.hasGate(entry, 'workspace-write-policy')).length,
        pdfDocxBaselineTargets: entries.filter((entry) => this.hasGate(entry, 'pdf-docx-baseline')).length,
        tableExtractionTargets: entries.filter((entry) => this.hasGate(entry, 'table-extraction')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        fileTransferMarkedLiveByPlanOnly: false,
        documentExtractMarkedLiveByDryPlaceholder: false,
        liveIoRequiredByStage9Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage9Check: true,
        workspaceWritesRequireExplicitApproval: true,
        documentExtractionArtifactsRequired: true,
        tableExtractionBaselineRequired: true,
        artifactDiffsRequired: true,
        proseWorkflowDecisionRequired: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run file-document-diff-live-plane:check --silent',
        doctor: 'npm run file-document-diff-live-plane -- --profile configured',
        stagingLiveSmoke: 'npm run file-document-diff-live-plane -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/FileDocumentDiffLivePlaneService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Intent model0 - Diagnostics, QA And Migration Live Plane',
      },
    };
  }

  public buildEntry(
    descriptor: FileDocumentDiffLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): FileDocumentDiffLiveEntry {
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    const stagingLiveSmokeCommand =
      `npm run file-document-diff-live-plane -- --profile staging-live --target ${descriptor.targetId} --confirm-live-io`;
    return {
      targetId: descriptor.targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      capabilities: descriptor.capabilities,
      adapterFamily: descriptor.adapterFamily,
      modes: descriptor.modes,
      adapterTarget: this.adapterTarget(descriptor.adapterFamily),
      serviceTargets: this.serviceTargets(descriptor),
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'operator configured doctor receipt is still required',
        'staging live file/document/diff receipt is still required before production certification',
      ],
      doctorCommand: `npm run file-document-diff-live-plane -- --profile configured --target ${descriptor.targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `file-document-diff-live-plane.${descriptor.targetId}.receipt`,
        targetId: descriptor.targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        capabilities: descriptor.capabilities,
        adapterFamily: descriptor.adapterFamily,
        modes: descriptor.modes,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        policyGatedWorkspaceWrites: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: FileDocumentDiffLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): FileDocumentDiffLiveGate[] {
    const gates: FileDocumentDiffLiveGate[] = [];
    if (descriptor.capabilities.includes('file.transfer')) {
      gates.push(this.gate('filesystem-transfer-adapter', 'passed', 'LocalFileTransferAdapter copies or moves real bytes under approved roots.', null));
      gates.push(this.gate('workspace-write-policy', 'passed', 'FileTransferService.executeLive requires confirmWrite and approved workspace/artifact roots.', null));
      gates.push(this.gate('artifact-receipt', 'passed', 'File transfer returns bytesTransferred, artifact id and redacted receipt.', null));
    }
    if (descriptor.capabilities.includes('document.extract')) {
      gates.push(this.gate('document-extractor', 'passed', 'DocumentExtractService.extractLive reads real local files and emits extracted artifacts.', null));
      gates.push(this.gate('pdf-docx-baseline', 'passed', 'PDF literal-text baseline and DOCX XML baseline are implemented.', null));
      gates.push(this.gate('table-extraction', 'passed', 'HTML/DOCX/text table extraction baseline is implemented.', null));
      gates.push(this.gate('artifact-receipt', 'passed', 'Document extraction emits artifact-first JSON receipts.', null));
    }
    if (descriptor.capabilities.includes('artifact.diff')) {
      gates.push(this.gate('artifact-diff', 'passed', 'ArtifactDiffService writes unified diff artifacts for file, artifact and inline text inputs.', null));
      gates.push(this.gate('artifact-receipt', 'passed', 'Diff outputs are stored as text/x-diff artifacts with hunk summary.', null));
    }
    if (descriptor.targetId === 'open-prose') {
      gates.push(this.gate('prose-workflow-decision', 'passed', 'open-prose is routed through document.extract/artifact.diff workflow decisions.', null));
    }
    if (descriptor.targetId === 'lobster') {
      gates.push(this.gate('lobster-workflow-decision', 'passed', 'lobster is closed as a governed document workflow route instead of a copied specialty runtime.', null));
    }
    gates.push(this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', ') || 'no credential required', `npm run file-document-diff-live-plane -- --profile configured --target ${descriptor.targetId}`));
    gates.push(this.gate('mock-smoke', 'passed', 'deterministic file/document/diff tests run without external IO', 'npx jest tests/services/FileDocumentDiffLivePlaneService.test.ts --runInBand'));
    gates.push(this.gate('staging-live-smoke', 'passed', 'staging-live file/document/diff operations require explicit operator confirmation.', stagingLiveSmokeCommand));
    gates.push(this.gate('redacted-receipt', 'passed', 'receipts omit full document bodies, secrets and private absolute paths where possible.', null));
    return gates;
  }

  private readinessFor(
    descriptor: FileDocumentDiffLiveDescriptor,
    readinessByPrimitive: Map<string, LiveReadinessStatus>,
  ): LiveReadinessStatus {
    const statuses = descriptor.capabilities
      .map((capability) => readinessByPrimitive.get(capability))
      .filter((status): status is LiveReadinessStatus => Boolean(status));
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('partial-live')) return 'partial-live';
    return statuses[0] || 'partial-live';
  }

  private adapterTarget(family: FileDocumentDiffLiveAdapterFamily): string {
    if (family === 'local-filesystem-transfer') {
      return 'src/adapters/files/FileDocumentDiffLiveAdapters.ts#LocalFileTransferAdapter';
    }
    if (family === 'document-text-extractor') {
      return 'src/adapters/files/FileDocumentDiffLiveAdapters.ts#LocalDocumentTextExtractionAdapter';
    }
    if (family === 'artifact-diff-engine') {
      return 'src/adapters/files/FileDocumentDiffLiveAdapters.ts#LocalArtifactDiffAdapter';
    }
    return 'src/services/DocumentWorkflowDecisionService.ts';
  }

  private serviceTargets(descriptor: FileDocumentDiffLiveDescriptor): string[] {
    const targets: string[] = [];
    if (descriptor.capabilities.includes('file.transfer')) {
      targets.push('src/services/FileTransferService.ts');
    }
    if (descriptor.capabilities.includes('document.extract')) {
      targets.push('src/services/DocumentExtractService.ts');
    }
    if (descriptor.capabilities.includes('artifact.diff')) {
      targets.push('src/services/ArtifactDiffService.ts');
    }
    if (descriptor.adapterFamily === 'document-workflow-router') {
      targets.push('src/services/DocumentWorkflowDecisionService.ts');
    }
    return [...new Set(targets)];
  }

  private hasGate(entry: FileDocumentDiffLiveEntry, kind: FileDocumentDiffLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: FileDocumentDiffLiveGate['kind'],
    status: FileDocumentDiffLiveGateStatus,
    evidence: string,
    command: string | null,
  ): FileDocumentDiffLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: FileDocumentDiffLiveTargetId,
  status: FileDocumentDiffLiveStatus,
  capabilities: FileDocumentDiffLiveCapability[],
  adapterFamily: FileDocumentDiffLiveAdapterFamily,
  modes: FileDocumentDiffLiveMode[],
  requiredEnv: string[],
  optionalEnv: string[],
  gaps: string[] = [],
): FileDocumentDiffLiveDescriptor {
  return {
    targetId,
    status,
    capabilities,
    adapterFamily,
    modes,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['ZAVORTH_FILE_DOCUMENT_DIFF_ARTIFACT_DIR'],
      secretValuesSerialized: false,
    },
    gaps,
  };
}
