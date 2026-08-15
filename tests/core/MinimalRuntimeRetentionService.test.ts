import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MinimalRuntimeRetentionService } from '../../src/core/MinimalRuntimeRetentionService.js';


describe('MinimalRuntimeRetentionService', () => {
  it('attaches runtime artifact owners and budgets to registered files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-retention-'));
    fs.writeFileSync(path.join(tempDir, 'capability-activation-ledger.jsonl'), '{"version":1}\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'desktop-resource-latest.json'), '{"version":1}\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'web-api-token.txt'), 'token\n', 'utf8');

    const report = new MinimalRuntimeRetentionService({
      projectRoot: __dirname,
      dataDir: tempDir,
    }).buildReport();

    expect(report.status).toBe('passed');
    expect(report.totals.registered).toBe(3);
    expect(report.totals.unregistered).toBe(0);
    expect(report.totals.manual).toBe(0);
    expect(report.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filePath: expect.stringContaining('desktop-resource-latest.json'),
        registeredArtifact: true,
        artifactOwner: 'services.desktop-resource-plane',
        budgetBytes: 262144,
      }),
      expect.objectContaining({
        filePath: expect.stringContaining('web-api-token.txt'),
        registeredArtifact: true,
        artifactKind: 'text-token',
        budgetBytes: 4096,
      }),
    ]));
  });

  it('flags future runtime artifacts until they declare ownership and retention policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-retention-future-'));
    fs.writeFileSync(path.join(tempDir, 'future-feature-cache.json'), '{"ok":true}\n', 'utf8');

    const report = new MinimalRuntimeRetentionService({
      projectRoot: __dirname,
      dataDir: tempDir,
    }).buildReport();

    expect(report.status).toBe('passed');
    expect(report.totals.registered).toBe(0);
    expect(report.totals.unregistered).toBe(1);
    expect(report.totals.manual).toBe(1);
    expect(report.actions[0]).toEqual(expect.objectContaining({
      registeredArtifact: false,
      status: 'manual',
      reason: 'unregistered-runtime-artifact',
    }));
  });

  it('plans and applies safe compaction for oversized agent run history', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-retention-runs-'));
    const filePath = path.join(tempDir, 'universal-agent-runs.json');
    fs.writeFileSync(filePath, JSON.stringify({
      version: 'zavorth-universal-agent-runs/1',
      savedAt: '2026-05-01T00:00:00.000Z',
      runs: [
        ...Array.from({ length: 10 }, (_, index) => buildRun(`old-${index}`, 'completed', `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`, true)),
        buildRun('current', 'running', '2026-05-20T00:00:00.000Z', true),
      ],
    }, null, 2), 'utf8');

    const service = new MinimalRuntimeRetentionService({
      projectRoot: __dirname,
      dataDir: tempDir,
      policy: { maxStateBytes: 1024 },
    });
    const report = service.buildReport();

    expect(report.totals.unregistered).toBe(0);
    expect(report.totals.manual).toBe(0);
    expect(report.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'compact-agent-run-history',
        status: 'planned',
        artifactOwner: 'runtime.agent-runs',
        wouldMutate: true,
      }),
    ]));

    const applied = service.buildReport({ apply: true });
    expect(applied.totals.applied).toBe(1);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const oldRun = parsed.runs.find((run: { id: string }) => run.id === 'old-0');
    const activeRun = parsed.runs.find((run: { id: string }) => run.id === 'current');
    expect(oldRun.metadata).toEqual(expect.objectContaining({ compacted: true }));
    expect(oldRun.input.length).toBeLessThan(600);
    expect(activeRun.metadata.large).toHaveLength(1_000_000);
    expect(fs.existsSync(path.join(tempDir, 'retention-backups'))).toBe(true);
  });

  it('plans and applies safe compaction for oversized workflow jobs', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-retention-jobs-'));
    const filePath = path.join(tempDir, 'universal-agent-workflow-jobs.json');
    fs.writeFileSync(filePath, JSON.stringify({
      version: 'zavorth-universal-agent-workflow-queue/1',
      savedAt: '2026-05-01T00:00:00.000Z',
      jobs: [
        ...Array.from({ length: 8 }, (_, index) => buildJob(`old-job-${index}`, 'completed', `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`, true)),
        buildJob('active-job', 'waiting_approval', '2026-05-20T00:00:00.000Z', true),
      ],
    }, null, 2), 'utf8');

    const service = new MinimalRuntimeRetentionService({
      projectRoot: __dirname,
      dataDir: tempDir,
      policy: { maxStateBytes: 1024 },
    });

    const report = service.buildReport();
    expect(report.totals.manual).toBe(0);
    expect(report.actions[0]).toEqual(expect.objectContaining({
      kind: 'compact-workflow-job-history',
      status: 'planned',
      artifactOwner: 'runtime.agent-workflows',
    }));

    service.buildReport({ apply: true });
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const oldJob = parsed.jobs.find((job: { id: string }) => job.id === 'old-job-0');
    const activeJob = parsed.jobs.find((job: { id: string }) => job.id === 'active-job');
    expect(oldJob.metadata).toEqual(expect.objectContaining({ compacted: true }));
    expect(oldJob.request.text.length).toBeLessThan(600);
    expect(activeJob.metadata.large).toHaveLength(1_000_000);
  });

  it('registers runtime operational artifacts with owners and budgets', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-retention-owned-'));
    fs.writeFileSync(path.join(tempDir, 'telemetry-events.jsonl'), '{"ok":true}\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'node-mesh-secrets.json'), '{"ref":"local"}\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'authorized-host.json'), '{"host":"127.0.0.1"}\n', 'utf8');

    const report = new MinimalRuntimeRetentionService({
      projectRoot: __dirname,
      dataDir: tempDir,
    }).buildReport();

    expect(report.totals.registered).toBe(3);
    expect(report.totals.unregistered).toBe(0);
    expect(report.totals.manual).toBe(0);
    expect(report.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filePath: expect.stringContaining('telemetry-events.jsonl'),
        artifactOwner: 'telemetry.runtime-events',
      }),
      expect.objectContaining({
        filePath: expect.stringContaining('node-mesh-secrets.json'),
        artifactKind: 'secret',
      }),
    ]));
  });
});

function buildRun(id: string, status: string, updatedAt: string, large: boolean): Record<string, unknown> {
  return {
    id,
    traceId: `trace-${id}`,
    requestId: `request-${id}`,
    sessionId: 'session',
    userId: 'owner',
    channel: 'web',
    title: `Run ${id}`,
    input: large ? 'input '.repeat(300) : 'input',
    workspace: 'workspace',
    status,
    createdAt: updatedAt,
    updatedAt,
    summary: large ? 'summary '.repeat(300) : 'summary',
    events: Array.from({ length: 20 }, (_, index) => ({
      id: `${id}-event-${index}`,
      runId: id,
      kind: 'status',
      title: 'event',
      detail: large ? 'detail '.repeat(200) : 'detail',
      status: 'done',
      createdAt: updatedAt,
    })),
    toolExposure: { mode: 'safe', summary: 'safe', tools: [] },
    replyPorts: [],
    modelProfile: { providerLabel: 'test', modelLabel: 'test', routingPolicy: 'direct' },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: { large: large ? 'x'.repeat(1_000_000) : 'x' },
  };
}

function buildJob(id: string, status: string, updatedAt: string, large: boolean): Record<string, unknown> {
  return {
    id,
    kind: 'resume_after_approval',
    runId: `run-${id}`,
    approvalId: `approval-${id}`,
    request: {
      userId: 'owner',
      channel: 'web',
      text: large ? 'please do this '.repeat(300) : 'please do this',
      metadata: { large: large ? 'x'.repeat(1_000_000) : 'x' },
    },
    status,
    createdAt: updatedAt,
    updatedAt,
    attempts: 1,
    maxAttempts: 3,
    completedAt: status === 'completed' ? updatedAt : null,
    failedAt: status === 'failed' ? updatedAt : null,
    cancelledAt: null,
    resultRunStatus: status === 'completed' ? 'completed' : 'failed',
    metadata: { large: large ? 'x'.repeat(1_000_000) : 'x' },
  };
}
