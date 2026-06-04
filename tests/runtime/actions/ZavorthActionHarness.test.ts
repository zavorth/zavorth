import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  ZavorthActionCatalog,
  type ZavorthActionDefinition,
  ZavorthActionGateway,
} from '../../../src/runtime/actions';
import { ZavorthMutationPlaneService } from '../../../src/services/ZavorthMutationPlaneService';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-action-harness-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'action-harness-test' }));
  return root;
}

function baseAction(id: string): ZavorthActionDefinition {
  return {
    id,
    title: 'Base action',
    description: 'Base test action.',
    aliases: [id],
    domains: ['test'],
    surface: ['cli', 'llm'],
    risk: 'safe',
    requiresPreview: false,
    requiresApproval: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    handler: (input) => ({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: 'ok',
      lines: ['ok'],
    }),
  };
}

describe('Zavorth Action Harness', () => {
  const roots: string[] = [];

  afterEach(() => {
    delete process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE;
    delete process.env.COMPOSIO_API_KEY;
    delete process.env.N8N_EXECUTE_URL;
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('registers the expected public action surface and rejects duplicate ids', () => {
    const catalog = new ZavorthActionCatalog();
    const ids = catalog.list().map((action) => action.id);
    expect(ids).toEqual(expect.arrayContaining([
      'skills.governance.set',
      'skills.governance.status',
      'providers.status',
      'providers.xai.doctor',
      'providers.xai.search',
      'home.status',
      'home.migrate.preview',
      'echo.wake.status',
      'tasks.status',
      'tasks.board.status',
      'tasks.board.triage',
      'tasks.board.decompose',
      'background.status',
      'background.run',
      'goals.status',
      'goals.create',
      'goals.loop.step',
      'goals.loop.worker',
      'memory.search',
      'mnemos.session_recall',
      'memory.forget',
      'approvals.status',
      'channels.readiness',
      'channels.progress.status',
      'channels.progress.publish',
      'integration.connectors.status',
      'integration.connectors.doctor',
      'integration.connectors.execute',
      'daily.product.status',
      'capabilities.verified.status',
      'capabilities.verified.expose',
      'sandbox.status',
      'git.review',
      'setup.status',
      'config.status',
    ]));
    expect(() => new ZavorthActionCatalog([baseAction('x.test'), baseAction('x.test')])).toThrow(/Duplicate Zavorth action id/);
  });

  it('looks up natural language and legacy command aliases', () => {
    const catalog = new ZavorthActionCatalog();
    expect(catalog.lookup({ query: 'mude o skill governance para governed' })[0]?.actionId)
      .toBe('skills.governance.set');
    expect(catalog.lookup({ query: 'zavorth skills governance governed --apply' })[0]?.actionId)
      .toBe('skills.governance.set');
    expect(catalog.lookup({ query: 'rode isso em background' })[0]?.actionId)
      .toBe('background.run');
    expect(catalog.lookup({ query: 'session recall do trabalho anterior' })[0]?.actionId)
      .toBe('mnemos.session_recall');
    expect(catalog.lookup({ query: 'goal loop continue this goal' })[0]?.actionId)
      .toBe('goals.loop.step');
    expect(catalog.lookup({ query: 'goal loop worker' })[0]?.actionId)
      .toBe('goals.loop.worker');
    expect(catalog.lookup({ query: 'como esta a autonomia silenciosa do produto diario' })[0]?.actionId)
      .toBe('daily.product.status');
    expect(catalog.lookup({ query: 'conectar Google Teams no Composio' })[0]?.actionId)
      .toMatch(/^integration\.connectors\./);
  });

  it('previews governance changes without writing files', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const preview = await gateway.preview('skills.governance.set', { mode: 'governed' });

    expect(preview.status).toBe('preview');
    expect(preview.ok).toBe(true);
    expect(preview.data?.requestedMode).toBe('governed');
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);
  });

  it('reads real operational status for non-mutating action domains', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const providers = await gateway.status('providers.status');
    const home = await gateway.status('home.status');
    const tasks = await gateway.status('tasks.status');
    const daily = await gateway.status('daily.product.status');

    expect(Array.isArray(providers.data?.providers)).toBe(true);
    expect((home.data?.snapshot as { root?: string } | undefined)?.root).toBeTruthy();
    expect((tasks.data?.taskPlane as { contractVersion?: string } | undefined)?.contractVersion).toBe('task-plane/1');
    expect((daily.data?.dailyProduct as { surface?: string } | undefined)?.surface).toBe('daily-product-quiet-autonomy');
    expect(providers.data?.catalogOnly).toBeUndefined();
    expect(home.data?.catalogOnly).toBeUndefined();
    expect(tasks.data?.catalogOnly).toBeUndefined();
  });

  it('can run Goal Loop through the Action Harness with an injected LLM judge', async () => {
    const root = makeRoot();
    roots.push(root);
    const llmRuntime = {
      chatDetailed: jest.fn(async () => ({
        providerName: 'test-provider',
        modelName: 'goal-judge',
        response: {
          content: JSON.stringify({
            status: 'continue',
            confidence: 0.9,
            reason: 'More work remains.',
            nextPrompt: 'Continue with the next audited step.',
            evidence: ['remaining-work'],
          }),
        },
      })),
    };
    const gateway = new ZavorthActionGateway({ root, llmRuntime });
    const created = await gateway.apply('goals.create', { objective: 'Finish the daily ops loop.' }, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
    });
    const goalId = String((created.data?.goal as { id?: string } | undefined)?.id || '');

    const loop = await gateway.apply('goals.loop.step', { goalId }, {
      actorId: 'operator',
      sourceSurface: 'test',
    });

    expect(loop.status).toBe('applied');
    expect((loop.data?.snapshot as { verdict?: { judge?: string } } | undefined)?.verdict?.judge).toBe('llm');
    expect(JSON.stringify(loop.data)).toContain('Continue with the next audited step.');
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(1);
  });

  it('runs the Goal Loop worker through the Action Harness when an AgentRun runner is injected', async () => {
    const root = makeRoot();
    roots.push(root);
    const goalLoopAgentRunner = {
      run: jest.fn(async (request: any) => ({
        ok: true,
        run: {
          id: `run-${request.requestId}`,
          traceId: request.traceId,
          requestId: request.requestId,
          sessionId: request.sessionId,
          userId: request.userId,
          channel: request.channel,
          title: 'Goal Loop worker',
          input: request.text,
          workspace: null,
          status: 'completed',
          createdAt: '2026-06-01T12:00:00.000Z',
          updatedAt: '2026-06-01T12:00:01.000Z',
          summary: 'completed worker slice and tests passed',
          events: [],
          toolExposure: { mode: 'safe', summary: 'safe', tools: [] },
          replyPorts: [],
          modelProfile: { providerLabel: 'fake', modelLabel: 'fake', routingPolicy: 'direct' },
          approvals: [],
          artifacts: [],
          memorySignals: [],
          metadata: {},
        },
        replies: [{
          id: 'reply-1',
          runId: `run-${request.requestId}`,
          port: request.replyPort,
          text: 'completed worker slice and tests passed',
          createdAt: '2026-06-01T12:00:01.000Z',
        }],
      })),
    };
    const gateway = new ZavorthActionGateway({ root, goalLoopAgentRunner });
    const created = await gateway.apply('goals.create', { objective: 'Finish worker loop.' }, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
    });
    const goalId = String((created.data?.goal as { id?: string } | undefined)?.id || '');
    const queued = await gateway.apply('goals.loop.step', { goalId }, {
      actorId: 'operator',
      sourceSurface: 'test',
    });

    const worker = await gateway.apply('goals.loop.worker', {}, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
      sourceSurface: 'test',
    });

    expect(queued.status).toBe('applied');
    expect(worker.status).toBe('applied');
    expect((worker.data?.snapshot as { processed?: number } | undefined)?.processed).toBe(1);
    expect(goalLoopAgentRunner.run).toHaveBeenCalledTimes(1);
  });

  it('requires approval for mutating apply and creates a mutation plan without changing .env', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const result = await gateway.run({
      operation: 'action.apply',
      actionId: 'skills.governance.set',
      args: { mode: 'governed', apiKey: 'secret-value' },
      sourceSurface: 'test',
      actorId: 'llm',
    });

    expect(result.status).toBe('approval_required');
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.zavorth', 'mutation-plans'))).toBe(true);

    const receipts = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'receipts', 'actions.json'), 'utf8'));
    expect(JSON.stringify(receipts)).not.toContain('secret-value');
    expect(JSON.stringify(receipts)).toContain('***');
  });

  it('defers new daily mutating actions to the mutation plane when called by an untrusted surface', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const background = await gateway.run({
      operation: 'action.apply',
      actionId: 'background.run',
      args: { prompt: 'summarize the workspace later' },
      sourceSurface: 'test',
      actorId: 'llm',
    });
    const goal = await gateway.run({
      operation: 'action.apply',
      actionId: 'goals.create',
      args: { objective: 'finish the release checklist' },
      sourceSurface: 'test',
      actorId: 'llm',
    });

    expect(background.status).toBe('approval_required');
    expect(goal.status).toBe('approval_required');
    expect(fs.existsSync(path.join(root, '.zavorth', 'mutation-plans'))).toBe(true);
  });

  it('previews connector execution through the Action Harness without external calls', async () => {
    const root = makeRoot();
    roots.push(root);
    process.env.COMPOSIO_API_KEY = 'secret-composio-key';
    const gateway = new ZavorthActionGateway({ root });

    const preview = await gateway.preview('integration.connectors.execute', {
      connectorId: 'composio',
      toolSlug: 'gmail_send_email',
      input: { to: 'user@example.com', token: 'must-not-leak' },
    });

    expect(preview.status).toBe('preview');
    expect(JSON.stringify(preview.data)).not.toContain('must-not-leak');
    expect(JSON.stringify(preview.data)).toContain('***');
  });

  it('applies connector webhook execution through Action Harness and records a redacted receipt', async () => {
    const root = makeRoot();
    roots.push(root);
    process.env.N8N_EXECUTE_URL = 'http://127.0.0.1:5678/webhook/private-secret-path';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      token: 'response-secret',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as any;
    const gateway = new ZavorthActionGateway({ root });

    try {
      const result = await gateway.apply('integration.connectors.execute', {
        connectorId: 'n8n',
        input: { action: 'sync', token: 'input-secret' },
      }, {
        trustedOperatorConfirmation: true,
        actorId: 'operator',
        sourceSurface: 'test',
      });

      expect(result.status).toBe('applied');
      expect(result.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5678/webhook/private-secret-path',
        expect.objectContaining({ method: 'POST' }),
      );
      const receiptPath = path.join(root, '.zavorth', 'receipts', 'integration-connectors.json');
      const receiptText = fs.readFileSync(receiptPath, 'utf8');
      expect(receiptText).toContain('n8n');
      expect(receiptText).not.toContain('input-secret');
      expect(receiptText).not.toContain('response-secret');
      expect(receiptText).not.toContain('private-secret-path');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('applies governance changes with trusted operator confirmation and records receipts', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const result = await gateway.apply('skills.governance.set', { mode: 'governed' }, {
      trustedOperatorConfirmation: true,
      actorId: 'operator',
      sourceSurface: 'test',
    });

    expect(result.status).toBe('applied');
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain('ZAVORTH_SKILLS_GOVERNANCE_MODE=governed');
    expect(fs.existsSync(path.join(root, '.zavorth', 'receipts', 'actions.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'receipts', 'skills-governance.json'))).toBe(true);
  });

  it('accepts only approved mutation plan ids as action approval ids', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const fake = await gateway.run({
      operation: 'action.apply',
      actionId: 'skills.governance.set',
      args: { mode: 'governed' },
      approvalId: 'approval-made-up',
    });
    expect(fake.status).toBe('blocked');
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);

    const previewApply = await gateway.run({
      operation: 'action.apply',
      actionId: 'skills.governance.set',
      args: { mode: 'governed' },
    });
    const planId = String(previewApply.data?.mutationPlanId || '');
    const mutationPlane = new ZavorthMutationPlaneService({
      plansDir: path.join(root, '.zavorth', 'mutation-plans'),
    });
    mutationPlane.approvePlan(planId, { approvedBy: 'test' });

    const applied = await gateway.run({
      operation: 'action.apply',
      actionId: 'skills.governance.set',
      args: { mode: 'governed' },
      approvalId: planId,
    });
    expect(applied.status).toBe('applied');
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain('ZAVORTH_SKILLS_GOVERNANCE_MODE=governed');
  });

  it('rejects invented action ids', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const result = await gateway.run({
      operation: 'action.apply',
      actionId: 'totally.fake.action',
      args: {},
    });

    expect(result.status).toBe('not_found');
    expect(result.ok).toBe(false);
  });
});
