import { buildCommandCenterRemoteMeshApprovalUxProjection } from '../../src/zavorth-control/app/(dashboard)/control/command-center/projections/remoteMeshApprovalUxProjection.js';
import type {
  RemoteMeshNotebookDockerControlPreviewPayload,
  RemoteMeshNotebookProjectFileReadPreviewPayload,
  RemoteMeshNotebookProjectFileReadReceiptPayload,
} from '../../src/contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import { RemoteMeshNotebookApprovalUxService } from '../../src/services/RemoteMeshNotebookApprovalUxService.js';

const now = () => new Date('2026-05-05T19:00:00.000Z');

const dockerPreview: RemoteMeshNotebookDockerControlPreviewPayload = {
  schemaVersion: 1,
  generatedAt: '2026-05-05T19:00:00.000Z',
  toolName: 'notebook.docker.preview_control',
  approvalId: 'zdc-test',
  approvalPhrase: 'APPROVE DOCKER RESTART zavorth-app',
  expiresAt: '2026-05-05T19:02:00.000Z',
  container: 'zavorth-app',
  action: 'restart',
  risk: 'medium',
  reversible: true,
  templateLabel: 'docker-container-lifecycle',
  expectedEffect: 'Restart allowlisted Docker container zavorth-app.',
  requiresApproval: true,
  processSpawned: false,
  dockerMutationPerformed: false,
  rawCommandSerialized: false,
};

const projectPreview: RemoteMeshNotebookProjectFileReadPreviewPayload = {
  schemaVersion: 1,
  generatedAt: '2026-05-05T19:00:00.000Z',
  toolName: 'notebook.project_files.preview_read',
  approvalId: 'zfr-test',
  approvalPhrase: 'APPROVE FILE READ zavorth/README.md',
  expiresAt: '2026-05-05T19:02:00.000Z',
  project: 'zavorth',
  relativePath: 'README.md',
  sizeBytes: 1024,
  maxBytes: 4096,
  contentRisk: 'normal',
  readOnly: true,
  requiresApproval: true,
  resolvedPathLabel: 'allowlisted-project-root',
  processSpawned: false,
  filesystemMutationPerformed: false,
  rawPathSerialized: false,
  rawCommandSerialized: false,
};

const projectReceipt: RemoteMeshNotebookProjectFileReadReceiptPayload = {
  schemaVersion: 1,
  generatedAt: '2026-05-05T19:01:00.000Z',
  toolName: 'notebook.project_files.apply_read',
  receiptId: 'zfrc-test',
  approvalId: 'zfr-test',
  project: 'zavorth',
  relativePath: 'README.md',
  encoding: 'utf8',
  content: '# Zavorth\n\nA local-first runtime.',
  sizeBytes: 34,
  truncated: false,
  lineCount: 2,
  readOnly: true,
  processSpawned: false,
  filesystemMutationPerformed: false,
  rawPathSerialized: false,
  rawCommandSerialized: false,
};

describe('RemoteMeshNotebookApprovalUxService R11', () => {
  it('turns Docker previews into mobile approval cards without raw JSON', () => {
    const card = new RemoteMeshNotebookApprovalUxService({ now }).buildCard(dockerPreview, 'mobile');

    expect(card.contractVersion).toBe('2026-05-05.remote-mesh-r11-mobile-dashboard-approval-ux');
    expect(card.phase).toBe('R11');
    expect(card.surface).toBe('mobile');
    expect(card.state).toBe('approval-required');
    expect(card.approval).toEqual(
      expect.objectContaining({
        applyToolName: 'notebook.docker.apply_control',
        rawJsonRequiredFromUser: false,
      }),
    );
    expect(card.approval?.applyArguments).toEqual({
      approvalId: 'zdc-test',
      approvalPhrase: 'APPROVE DOCKER RESTART zavorth-app',
    });
    expect(card.safety.noRawShell).toBe(true);
    expect(card.safety.noRawJsonCopyRequired).toBe(true);
  });

  it('turns project file previews into Command Center approval cards', () => {
    const projection = buildCommandCenterRemoteMeshApprovalUxProjection(projectPreview);

    expect(projection.projectionVersion).toBe('command-center-remote-mesh-approval-ux/v1');
    expect(projection.commandCenterReady).toBe(true);
    expect(projection.rawJsonRequiredFromUser).toBe(false);
    expect(projection.commandActuallyExecuted).toBe(false);
    expect(projection.toolActuallyExecuted).toBe(false);
    expect(projection.card.dashboard.queue).toBe('approvals');
    expect(projection.card.approval?.applyToolName).toBe('notebook.project_files.apply_read');
    expect(projection.card.targetLabel).toBe('zavorth/README.md');
  });

  it('turns receipts into timeline cards with content preview limits', () => {
    const card = new RemoteMeshNotebookApprovalUxService({ now }).buildCard(projectReceipt, 'dashboard');

    expect(card.state).toBe('receipt');
    expect(card.approval).toBeNull();
    expect(card.receipt).toEqual(
      expect.objectContaining({
        receiptId: 'zfrc-test',
        status: 'read',
      }),
    );
    expect(card.receipt?.contentPreview).toContain('# Zavorth');
    expect(card.dashboard.queue).toBe('timeline');
    expect(card.safety.noProjectFileWrite).toBe(true);
  });

  it('builds an R11 snapshot for both mobile and Command Center', () => {
    const snapshot = new RemoteMeshNotebookApprovalUxService({ now }).buildSnapshot({
      fixtures: [
        { source: dockerPreview, surface: 'mobile' },
        { source: projectPreview, surface: 'dashboard' },
        { source: projectReceipt, surface: 'dashboard' },
      ],
    });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.cards).toBe(3);
    expect(snapshot.summary.approvalCards).toBe(2);
    expect(snapshot.summary.receiptCards).toBe(1);
    expect(snapshot.summary.mobileReady).toBe(true);
    expect(snapshot.summary.dashboardReady).toBe(true);
    expect(snapshot.summary.rawJsonRequiredFromUser).toBe(false);
    expect(snapshot.summary.rawCommandSerialized).toBe(false);
    expect(snapshot.summary.secretValuesSerialized).toBe(false);
  });
});
