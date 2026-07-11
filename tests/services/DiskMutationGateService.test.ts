import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DiskMutationGateService } from '../../src/services/DiskMutationGateService.js';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';
import { isOperatorContinuityEnvelope } from '../../src/runtime/operator/OperatorContinuityEnvelope.js';

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
    const previewEnvelope = service.getLastContinuityEnvelope();
    expect(isOperatorContinuityEnvelope(previewEnvelope)).toBe(true);
    expect(previewEnvelope?.request?.surface).toBe('disk-mutation');
    expect(previewEnvelope?.request?.operation).toBe('disk-mutation.preview');
    expect(previewEnvelope?.result?.status).toBe('preview');
    expect(previewEnvelope?.receipt?.terminal).toBe(true);

    expect(() => service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: 'wrong phrase',
    })).toThrow(/Approval phrase invalida/);
    expect(service.getLastContinuityEnvelope()?.result?.status).toBe('blocked');

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
    const applyEnvelope = service.getLastContinuityEnvelope();
    expect(isOperatorContinuityEnvelope(applyEnvelope)).toBe(true);
    expect(applyEnvelope?.request?.operation).toBe('disk-mutation.apply');
    expect(applyEnvelope?.decision?.allowed).toBe(true);
    expect(applyEnvelope?.result?.status).toBe('applied');
    expect(applyEnvelope?.ids.correlation?.mutationPlanId).toBe(preview.mutationPlanId);
    expect(applyEnvelope?.ids.correlation?.actionReceiptId).toBe(result.receipt.receiptId);
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
    expect(service.getLastContinuityEnvelope()?.decision?.allowed).toBe(false);
    expect(service.getLastContinuityEnvelope()?.result?.status).toBe('blocked');
    expect(() => service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: preview.approval.phrase,
    })).toThrow(/Preview bloqueado/);
    expect(service.getLastContinuityEnvelope()?.result?.status).toBe('blocked');
    expect(fs.existsSync(path.join(workspaceRoot, '.env'))).toBe(false);
  });

  it('never keeps secret bodies in blocked preview diffPatch or on-disk preview JSON', () => {
    const secretBody = 'OPENAI_API_KEY=sk-test-secret-value-xyz';
    const preview = service.createPreview({
      workspaceRoot,
      operations: [
        {
          kind: 'write_file',
          path: 'ok.txt',
          content: secretBody,
        },
      ],
    });

    expect(preview.status).toBe('blocked');
    expect(preview.findings.map((f) => f.id)).toEqual(expect.arrayContaining(['secret-like-content']));
    expect(preview.operations[0]?.diffPatch).toBeNull();
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain('sk-test-secret-value-xyz');
    expect(serialized).not.toContain(secretBody);

    const previewFile = path.join(
      workspaceRoot,
      '.zavorth',
      'previews',
      'disk-mutation-gate',
      `${preview.previewId}.json`,
    );
    if (fs.existsSync(previewFile)) {
      const disk = fs.readFileSync(previewFile, 'utf8');
      expect(disk).not.toContain('sk-test-secret-value-xyz');
      expect(disk).not.toContain(secretBody);
    }
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
