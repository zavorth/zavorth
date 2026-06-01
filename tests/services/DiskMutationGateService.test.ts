import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DiskMutationGateService } from '../../src/services/DiskMutationGateService.js';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';

describe('DiskMutationGateService', () => {
  let workspaceRoot: string;
  let mutationPlane: ZavorthMutationPlaneService;
  let service: DiskMutationGateService;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-disk-gate-'));
    mutationPlane = new ZavorthMutationPlaneService({
      plansDir: path.join(workspaceRoot, '.zavorth', 'mutation-plans'),
      now: () => new Date('2026-05-30T10:00:00.000Z'),
    });
    service = new DiskMutationGateService({
      mutationPlane,
      now: () => new Date('2026-05-30T10:00:00.000Z'),
    });
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('creates a preview before writing and records an apply receipt without raw content', () => {
    fs.writeFileSync(path.join(workspaceRoot, 'notes.txt'), 'one\n', 'utf8');

    const preview = service.createPreview({
      workspaceRoot,
      operations: [
        {
          kind: 'write_file',
          path: 'notes.txt',
          content: 'two\n',
          reason: 'unit test',
        },
      ],
      requestedBy: 'test',
      sourceSurface: 'jest',
    });

    expect(preview.status).toBe('preview_ready');
    expect(preview.operations[0].diffPatch).toContain('-one');
    expect(preview.operations[0].diffPatch).toContain('+two');
    expect(fs.readFileSync(path.join(workspaceRoot, 'notes.txt'), 'utf8')).toBe('one\n');
    expect(mutationPlane.readPlan(preview.mutationPlanId)?.status).toBe('waiting_approval');

    expect(() => service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: 'wrong phrase',
    })).toThrow(/Approval phrase invalida/);

    const result = service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: preview.approval.phrase,
      approvedBy: 'owner',
    });

    expect(result.status).toBe('applied');
    expect(fs.readFileSync(path.join(workspaceRoot, 'notes.txt'), 'utf8')).toBe('two\n');
    expect(JSON.stringify(result.receipt)).not.toContain('two\n');
    expect(result.receipt.operations[0]).toEqual(expect.objectContaining({
      kind: 'write_file',
      relativePath: 'notes.txt',
      status: 'applied',
    }));
    expect(mutationPlane.readPlan(preview.mutationPlanId)?.status).toBe('applied');
    expect(service.buildStatus({ workspaceRoot }).receipts).toHaveLength(1);
  });

  it('blocks protected paths and refuses apply for blocked previews', () => {
    const preview = service.createPreview({
      workspaceRoot,
      operations: [
        {
          kind: 'write_file',
          path: '.env',
          content: 'OPENAI_API_KEY=sk-test-secret',
        },
      ],
    });

    expect(preview.status).toBe('blocked');
    expect(preview.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'protected-path',
      'secret-like-content',
    ]));
    expect(mutationPlane.readPlan(preview.mutationPlanId)?.status).toBe('blocked');
    expect(() => service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: preview.approval.phrase,
    })).toThrow(/Preview bloqueado/);
    expect(fs.existsSync(path.join(workspaceRoot, '.env'))).toBe(false);
  });

  it('blocks apply when the target changed after preview', () => {
    fs.writeFileSync(path.join(workspaceRoot, 'target.txt'), 'before\n', 'utf8');
    const preview = service.createPreview({
      workspaceRoot,
      operations: [
        {
          kind: 'write_file',
          path: 'target.txt',
          content: 'after\n',
        },
      ],
    });
    fs.writeFileSync(path.join(workspaceRoot, 'target.txt'), 'changed meanwhile\n', 'utf8');

    expect(() => service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: preview.approval.phrase,
    })).toThrow(/Precondition failed/);
    expect(fs.readFileSync(path.join(workspaceRoot, 'target.txt'), 'utf8')).toBe('changed meanwhile\n');
    expect(mutationPlane.readPlan(preview.mutationPlanId)?.status).toBe('blocked');
  });
});
