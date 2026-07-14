import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION,
} from '../../src/contracts/skill/ZavorthSkillWorkerMeshContract.js';
import { WorkerMeshService } from '../../src/services/WorkerMeshService.js';
import { ZavorthExternalAgentGatewayService } from '../../src/services/ZavorthExternalAgentGatewayService.js';
import { AgentManagerTool } from '../../src/tools/AgentManagerTool.js';

describe('W4 WorkerMeshService', () => {
  let tempRoot: string;
  let projectRoot: string;
  let registryFile: string;
  let mesh: WorkerMeshService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-worker-mesh-'));
    projectRoot = path.join(tempRoot, 'project');
    fs.mkdirSync(path.join(projectRoot, 'data', 'runtime'), { recursive: true });
    registryFile = path.join(projectRoot, 'data', 'runtime', 'external-agent-profiles.json');
    const gateway = new ZavorthExternalAgentGatewayService({
      projectRoot,
      registryFile,
      now: () => new Date('2026-07-13T20:00:00.000Z'),
    });
    mesh = new WorkerMeshService({
      projectRoot,
      gateway,
      receiptsDir: path.join(projectRoot, 'data', 'runtime', 'worker-mesh-receipts'),
      now: () => new Date('2026-07-13T20:00:00.000Z'),
      execFileSyncImpl: ((cmd: string) => {
        if (cmd === 'node') return Buffer.from('v22');
        throw Object.assign(new Error('not found'), { code: 'ENOENT' });
      }) as typeof import('node:child_process').execFileSync,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('lists internal workers under internal:* namespace', () => {
    const workers = mesh.listWorkers();
    const internal = workers.filter((w) => w.adapter === 'internal');
    expect(internal.length).toBeGreaterThanOrEqual(5);
    expect(internal.map((w) => w.id)).toEqual(
      expect.arrayContaining([
        'internal:leaf',
        'internal:researcher',
        'internal:executor',
      ]),
    );
    expect(workers[0].contractVersion).toBe(ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION);
  });

  it('registers HTTP worker and dry-run invoke produces receipt', async () => {
    const reg = mesh.registerExternal({
      id: 'http-mock',
      label: 'HTTP worker',
      adapter: 'http',
      endpoint: 'http://127.0.0.1:9/health',
      approvalGranted: true,
      enableLive: true,
      requestedBy: 'test',
    });
    expect(reg.status).toBe('registered');

    const worker = mesh.getWorker('http-mock');
    expect(worker?.adapter).toBe('http');
    expect(worker?.label).toBe('HTTP worker');

    const receipt = await mesh.invoke({
      workerId: 'http-mock',
      prompt: 'ping',
      dryRun: true,
      approvalGranted: false,
    });
    expect(receipt.kind).toBe('worker-invoke-receipt');
    expect(receipt.mode).toBe('dry-run');
    expect(['approval-required', 'completed']).toContain(receipt.status);
    expect(receipt.stdoutSummary).toMatch(/Dry-run|dry-run/i);

    const listed = mesh.listReceipts(5);
    expect(listed.some((r) => r.id === receipt.id)).toBe(true);
  });

  it('health for internal worker is healthy', () => {
    const h = mesh.health('internal:leaf');
    expect(h.status).toBe('healthy');
    expect(h.profile?.adapter).toBe('internal');
  });

  it('health for CLI node can be healthy via injected exec', () => {
    mesh.registerExternal({
      id: 'cli-node',
      label: 'CLI worker',
      adapter: 'cli',
      command: 'node',
      approvalGranted: true,
      enableLive: true,
      requestedBy: 'test',
    });
    const h = mesh.health('cli-node');
    expect(h.status).toBe('healthy');
  });

  it('agent_manager workers action includes internal slots', async () => {
    const tool = new AgentManagerTool({
      projectRoot,
      mesh,
    });
    const raw = await tool.execute({ action: 'workers' });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('ok');
    expect(parsed.count).toBeGreaterThanOrEqual(5);
    expect(parsed.workers.some((w: { id: string }) => w.id === 'internal:leaf')).toBe(true);
  });

  it('agent_manager invoke dry-run on internal worker', async () => {
    const tool = new AgentManagerTool({ projectRoot, mesh });
    const raw = await tool.execute({
      action: 'invoke',
      target: 'internal:researcher',
      prompt: 'summarize workspace',
      dry_run: true,
    });
    const parsed = JSON.parse(raw);
    expect(parsed.mode).toBe('dry-run');
    expect(parsed.receipt.workerId).toBe('internal:researcher');
  });

  it('formatWorkersText is brand-agnostic', () => {
    const text = mesh.formatWorkersText();
    expect(text).toMatch(/Worker mesh/i);
    expect(text).toMatch(/internal:leaf/);
  });
});
