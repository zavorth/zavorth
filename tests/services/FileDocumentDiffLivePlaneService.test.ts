import fs from 'fs';
import os from 'os';
import path from 'path';

import { ArtifactDiffService } from '../../src/services/ArtifactDiffService.js';
import { DocumentExtractService } from '../../src/services/DocumentExtractService.js';
import { DocumentWorkflowDecisionService } from '../../src/services/DocumentWorkflowDecisionService.js';
import { FileDocumentDiffLivePlaneService } from '../../src/services/FileDocumentDiffLivePlaneService.js';
import { FileTransferService } from '../../src/services/FileTransferService.js';

describe('FileDocumentDiffLivePlaneService Certification matrix', () => {
  let workspaceRoot: string;
  let artifactDir: string;

  beforeEach(async () => {
    workspaceRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-file-document-workspace-'));
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-file-document-artifacts-'));
  });

  afterEach(async () => {
    await fs.promises.rm(workspaceRoot, { recursive: true, force: true });
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
  });

  it('closes Certification matrix file, document, diff and prose gates without live IO', () => {
    const snapshot = new FileDocumentDiffLivePlaneService({
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-9');
    expect(snapshot.phase).toBe('Certification matrix - File, Document, Diff And Prose Live Plane');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 5,
        fileTransferTargets: 1,
        documentExtractTargets: 3,
        artifactDiffTargets: 3,
        workflowDecisionTargets: 2,
        policyGatedWriteTargets: 1,
        pdfDocxBaselineTargets: 3,
        tableExtractionTargets: 3,
        stagingLiveSmokeCommands: 5,
        redactedReceipts: 5,
        blocked: 0,
        fileTransferMarkedLiveByPlanOnly: false,
        documentExtractMarkedLiveByDryPlaceholder: false,
        liveIoRequiredByStage9Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage9Check: true,
        workspaceWritesRequireExplicitApproval: true,
        documentExtractionArtifactsRequired: true,
        tableExtractionBaselineRequired: true,
        artifactDiffsRequired: true,
        proseWorkflowDecisionRequired: true,
      }),
    );
  });

  it('gives every Certification matrix target doctor, staging smoke and redacted receipt', () => {
    const snapshot = new FileDocumentDiffLivePlaneService().buildSnapshot();
    expect(snapshot.entries.map((entry) => entry.targetId).sort()).toEqual([
      'diffs',
      'document-extract',
      'file-transfer',
      'lobster',
      'open-prose',
    ]);
    for (const entry of snapshot.entries) {
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          artifactFirst: true,
          liveIoPerformed: false,
          policyGatedWorkspaceWrites: true,
          stagingLiveRequiresExplicitCommand: true,
          secretValuesSerialized: false,
        }),
      );
    }
  });

  it('copies real bytes under approved workspace policy', async () => {
    const sourcePath = path.join(workspaceRoot, 'input.txt');
    const destinationPath = path.join(workspaceRoot, 'out', 'copy.txt');
    await fs.promises.writeFile(sourcePath, 'phase 9 bytes', 'utf8');
    const service = new FileTransferService({
      artifactDir,
      workspaceRoots: [workspaceRoot],
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    });

    const blocked = await service.executeLive({
      direction: 'copy',
      source: { kind: 'workspace-path', ref: sourcePath },
      destination: { kind: 'workspace-path', ref: destinationPath },
      allowedRoots: [workspaceRoot, artifactDir],
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/confirmWrite/);

    const result = await service.executeLive({
      direction: 'copy',
      source: { kind: 'workspace-path', ref: sourcePath },
      destination: { kind: 'workspace-path', ref: destinationPath },
      allowedRoots: [workspaceRoot, artifactDir],
      confirmWrite: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'completed',
        bytesTransferred: Buffer.byteLength('phase 9 bytes'),
      }),
    );
    expect(await fs.promises.readFile(destinationPath, 'utf8')).toBe('phase 9 bytes');
  });

  it('extracts text, metadata and tables from a real HTML document', async () => {
    const sourcePath = path.join(workspaceRoot, 'report.html');
    await fs.promises.writeFile(
      sourcePath,
      '<html><head><title>Certification matrix Report</title></head><body><h1>Hello Zavorth</h1><table><caption>Scores</caption><tr><th>Name</th><th>Score</th></tr><tr><td>Zavorth</td><td>9</td></tr></table></body></html>',
      'utf8',
    );
    const service = new DocumentExtractService({
      artifactDir,
      workspaceRoots: [workspaceRoot],
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    });

    const result = await service.extractLive({
      source: {
        storageRef: sourcePath,
        contentType: 'text/html',
      },
      mode: 'full',
      allowedRoots: [workspaceRoot, artifactDir],
      outputDir: artifactDir,
    });

    expect(result.ok).toBe(true);
    expect(result.text).toContain('Hello Zavorth');
    expect(result.tables).toEqual([
      expect.objectContaining({
        caption: 'Scores',
        rows: [
          ['Name', 'Score'],
          ['Zavorth', '9'],
        ],
      }),
    ]);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        contentType: 'text/html',
        dryRun: false,
        title: 'Certification matrix Report',
      }),
    );
    expect(result.outputArtifactId).toMatch(/^document\.extracted\./);
    expect(fs.existsSync(path.join(artifactDir, `${result.outputArtifactId}.json`))).toBe(true);
  });

  it('creates a real unified diff artifact', async () => {
    const left = path.join(workspaceRoot, 'left.txt');
    const right = path.join(workspaceRoot, 'right.txt');
    await fs.promises.writeFile(left, 'alpha\nbeta\n', 'utf8');
    await fs.promises.writeFile(right, 'alpha\ngamma\n', 'utf8');
    const service = new ArtifactDiffService({
      artifactDir,
      workspaceRoots: [workspaceRoot],
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    });

    const result = await service.createDiffArtifact({
      left: { kind: 'workspace-path', ref: left },
      right: { kind: 'workspace-path', ref: right },
      outputDir: artifactDir,
      allowedRoots: [workspaceRoot, artifactDir],
    });

    expect(result.ok).toBe(true);
    expect(result.artifact).toEqual(
      expect.objectContaining({
        contentType: 'text/x-diff',
      }),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        changedLines: 2,
        emptyDiff: false,
      }),
    );
    const patch = await fs.promises.readFile(result.artifact!.storageRef, 'utf8');
    expect(patch).toContain('-beta');
    expect(patch).toContain('+gamma');
  });

  it('routes open-prose and lobster through explicit workflow decisions', () => {
    const service = new DocumentWorkflowDecisionService();

    expect(service.decide({ targetId: 'open-prose', requestedAction: 'diff prose' })).toEqual(
      expect.objectContaining({
        targetId: 'open-prose',
        route: 'artifact.diff',
        artifactFirst: true,
        secretValuesSerialized: false,
      }),
    );
    expect(service.decide({ targetId: 'lobster', requestedAction: 'extract document' })).toEqual(
      expect.objectContaining({
        targetId: 'lobster',
        route: 'document.extract',
        requiredApprovals: ['operator-document-workflow'],
      }),
    );
  });
});
