import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  ZavorthActionCatalog,
  type ZavorthActionDefinition,
  ZavorthActionGateway,
} from '../../../src/runtime/actions';
import { ZavorthMutationPlaneService } from '../../../src/services/ZavorthMutationPlaneService';

jest.setTimeout(30000);

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
      'workspace.read_file',
      'workspace.list_directory',
      'workspace.search_files',
      'workspace.diff_file',
      'workspace.create_file',
      'workspace.write_file',
      'workspace.patch_file',
      'web.search',
      'browser.click',
      'browser.type',
      'browser.form.submit',
      'shell.preview_command',
      'shell.run_allowlisted',
      'sandbox.run_code',
      'sandbox.run_tests',
      'channels.status',
      'channels.draft',
      'channels.send_approved',
      'mcp.list',
      'mcp.inspect',
      'mcp.preview',
      'mcp.execute_quarantined',
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

  it('attaches verified capability metadata and approval policy to workspace file actions', () => {
    const actions = new ZavorthActionCatalog().list();
    const byId = new Map(actions.map((action) => [action.id, action]));
    const workspaceIds = [
      'workspace.read_file',
      'workspace.list_directory',
      'workspace.search_files',
      'workspace.diff_file',
      'workspace.create_file',
      'workspace.write_file',
      'workspace.patch_file',
    ];

    for (const id of workspaceIds) {
      expect(byId.get(id)).toEqual(expect.objectContaining({
        capabilityId: 'workspace-files',
        verificationStatus: 'verified',
        scope: expect.any(String),
        receiptPolicy: expect.any(String),
      }));
    }

    for (const id of ['workspace.create_file', 'workspace.write_file', 'workspace.patch_file']) {
      expect(byId.get(id)).toEqual(expect.objectContaining({
        requiresPreview: true,
        requiresApproval: true,
        effects: expect.arrayContaining(['write']),
        receiptPolicy: 'required',
      }));
    }
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

  it('runs governed workspace file actions without reading secrets or mutating without approval', async () => {
    const root = makeRoot();
    roots.push(root);
    fs.writeFileSync(path.join(root, 'README.md'), 'hello workspace\nneedle line\n');
    fs.writeFileSync(path.join(root, '.env'), 'TOKEN=secret');
    fs.mkdirSync(path.join(root, 'output'), { recursive: true });
    fs.writeFileSync(path.join(root, 'output', 'note.txt'), 'alpha\n');
    const gateway = new ZavorthActionGateway({ root });

    const listed = await gateway.status('workspace.list_directory', { dirpath: '.' });
    const searched = await gateway.status('workspace.search_files', { query: 'needle' });
    const secretRead = await gateway.status('workspace.read_file', { filepath: '.env' });
    const diff = await gateway.status('workspace.diff_file', { filepath: 'note.txt', content: 'beta\n' });
    const patchBlocked = await gateway.apply('workspace.patch_file', { filepath: 'note.txt', search: 'alpha', replace: 'beta' });

    expect(listed.status).toBe('ok');
    expect(JSON.stringify(listed.data)).not.toContain('.env');
    expect(searched.status).toBe('ok');
    expect(JSON.stringify(searched.data)).toContain('needle line');
    expect(secretRead.status).toBe('blocked');
    expect(diff.status).toBe('ok');
    expect(fs.readFileSync(path.join(root, 'output', 'note.txt'), 'utf8')).toBe('alpha\n');
    expect(patchBlocked.status).toBe('approval_required');
  });

  it('exposes later-wave shell, sandbox, channel and MCP capabilities behind safe gates', async () => {
    const root = makeRoot();
    roots.push(root);
    fs.writeFileSync(path.join(root, 'mcp.json'), JSON.stringify({ servers: { docs: { command: 'node', tools: ['search'] } } }));
    const gateway = new ZavorthActionGateway({ root });

    const shellPreview = await gateway.preview('shell.preview_command', { command: 'git status' });
    const shellBlocked = await gateway.apply('shell.run_allowlisted', { command: 'git status' });
    const unsafeShell = await gateway.preview('shell.preview_command', { command: 'powershell Get-ChildItem' });
    const sandboxPreview = await gateway.preview('sandbox.run_code', { code: 'console.log("ok")' });
    const channelDraft = await gateway.status('channels.draft', { channel: 'telegram', message: 'hello' });
    const channelSendBlocked = await gateway.apply('channels.send_approved', { channel: 'slack', message: 'hello' });
    const mcpList = await gateway.status('mcp.list');
    const mcpPreview = await gateway.preview('mcp.preview', { server: 'docs', tool: 'search' });
    const mcpExecuteBlocked = await gateway.apply('mcp.execute_quarantined', { server: 'docs', tool: 'search', args: {} });

    expect(shellPreview.status).toBe('preview');
    expect(shellBlocked.status).toBe('approval_required');
    expect(unsafeShell.status).toBe('blocked');
    expect(sandboxPreview.status).toBe('preview');
    expect(sandboxPreview.data?.isolation).toBe('process-quarantine');
    expect(channelDraft.data?.externalSend).toBe(false);
    expect(channelSendBlocked.status).toBe('approval_required');
    expect(mcpList.data?.executionEnabled).toBe(false);
    expect(mcpPreview.data?.quarantineRequired).toBe(true);
    expect(mcpExecuteBlocked.status).toBe('approval_required');
  });

  it('sends approved channel messages through a configured webhook and records redacted receipts', async () => {
    const root = makeRoot();
    roots.push(root);
    process.env.SLACK_WEBHOOK_URL = 'https://example.com/private-token';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ ok: true, secret: 'response-secret' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as any;
    const gateway = new ZavorthActionGateway({ root });

    try {
      const sent = await gateway.apply('channels.send_approved', {
        channel: 'slack',
        message: 'hello approved world',
      }, {
        trustedOperatorConfirmation: true,
        actorId: 'operator',
        sourceSurface: 'test',
      });

      expect(sent.status).toBe('applied');
      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/private-token', expect.objectContaining({
        method: 'POST',
      }));
      const receipts = fs.readFileSync(path.join(root, '.zavorth', 'receipts', 'actions.json'), 'utf8');
      expect(receipts).toContain('channels.send_approved');
      expect(receipts).not.toContain('private-token');
      expect(receipts).not.toContain('response-secret');
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.SLACK_WEBHOOK_URL;
    }
  });

  it('shares the ZAVORTH-prefixed long-tail channel configuration between drafts and approved sends', async () => {
    const root = makeRoot();
    roots.push(root);
    process.env.ZAVORTH_MATRIX_WEBHOOK_URL = 'https://example.com/matrix-private-token';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => new Response('', { status: 200 })) as any;
    const gateway = new ZavorthActionGateway({ root });

    try {
      const draft = await gateway.apply('channels.long_tail.draft', { channel: 'matrix', message: 'hello matrix' });
      const sent = await gateway.apply('channels.send_approved', { channel: 'matrix', message: 'hello matrix' }, { trustedOperatorConfirmation: true });
      expect(draft.status).toBe('applied');
      expect(draft.data?.envelope).toEqual(expect.objectContaining({ targetChannels: ['matrix'] }));
      expect(sent.status).toBe('applied');
      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/matrix-private-token', expect.objectContaining({ method: 'POST' }));
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.ZAVORTH_MATRIX_WEBHOOK_URL;
    }
  });

  it('blocks quarantined MCP execution unless server and tool are explicitly allowed', async () => {
    const root = makeRoot();
    roots.push(root);
    fs.writeFileSync(path.join(root, 'mcp.json'), JSON.stringify({
      servers: {
        docs: { command: 'node', tools: ['search'] },
        unsafe: { command: 'powershell', tools: ['exec'] },
      },
    }));
    const gateway = new ZavorthActionGateway({ root });

    const allowedPreview = await gateway.preview('mcp.execute_quarantined', { server: 'docs', tool: 'search', args: { q: 'zavorth' } });
    const unlistedTool = await gateway.preview('mcp.execute_quarantined', { server: 'docs', tool: 'delete', args: {} });
    const untrustedServer = await gateway.preview('mcp.execute_quarantined', { server: 'unsafe', tool: 'exec', args: {} });

    expect(allowedPreview.status).toBe('preview');
    expect(allowedPreview.data?.executionEnabled).toBe(true);
    expect(allowedPreview.data?.quarantineRequired).toBe(true);
    expect(unlistedTool.status).toBe('blocked');
    expect(untrustedServer.status).toBe('blocked');
  });
});
