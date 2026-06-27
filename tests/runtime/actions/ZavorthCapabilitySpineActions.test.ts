import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthActionCatalog, ZavorthActionGateway } from '../../../src/runtime/actions';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-spine-actions-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: {
      'zavorth:capability-atlas:json': 'npx tsx scripts/zavorth-capability-atlas.ts --json',
      'qa:zavorth-natural-action-harness': 'npx jest tests/runtime/actions/ZavorthActionHarness.test.ts --runInBand',
    },
  }));
  fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'services', 'UniversalSkillExpansionService.ts'), '// fixture\n');
  fs.writeFileSync(path.join(root, 'src', 'services', 'ZavorthExternalAgentGatewayService.ts'), '// fixture\n');
  return root;
}

describe('Zavorth capability spine actions', () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('registers hidden capability, skill, agent, workflow and reference actions as verified LLM-facing routes', () => {
    const actions = new ZavorthActionCatalog().list();
    const byId = new Map(actions.map((action) => [action.id, action]));

    for (const id of [
      'capabilities.hidden.scan',
      'capabilities.hidden.inspect',
      'capabilities.hidden.expose',
      'skills.catalog.list',
      'skills.catalog.inspect',
      'skills.absorb',
      'agents.external.list',
      'agents.external.invoke',
      'workflows.list',
      'workflows.run',
      'capabilities.reference.agent',
      'capabilities.reference.workspace',
    ]) {
      expect(byId.get(id)).toEqual(expect.objectContaining({
        verificationStatus: 'verified',
        capabilityId: 'capability-spine',
        surface: expect.arrayContaining(['llm']),
      }));
    }
    expect(byId.get('capabilities.hidden.expose')).toEqual(expect.objectContaining({
      requiresPreview: true,
      requiresApproval: true,
      receiptPolicy: 'required',
    }));
  });

  it('scans, inspects and queues exposure plans through the Action Harness', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const scan = await gateway.status('capabilities.hidden.scan');
    const inspect = await gateway.status('capabilities.hidden.inspect', { id: 'skills.absorption' });
    const preview = await gateway.preview('capabilities.hidden.expose', { id: 'skills.absorption' });
    const blockedApply = await gateway.apply('capabilities.hidden.expose', { id: 'skills.absorption' });

    expect(scan.status).toBe('ok');
    expect(JSON.stringify(scan.data)).toContain('skills.absorption');
    expect(inspect.status).toBe('ok');
    expect(inspect.data?.candidate).toEqual(expect.objectContaining({ id: 'skills.absorption' }));
    expect(preview.status).toBe('preview');
    expect(preview.data?.plan).toEqual(expect.objectContaining({
      actionIds: expect.arrayContaining(['skills.absorb']),
    }));
    expect(blockedApply.status).toBe('approval_required');
  });

  it('exposes reference packs and workflow inventory without running workflows', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const agentReference = await gateway.status('capabilities.reference.agent');
    const workspaceReference = await gateway.status('capabilities.reference.workspace');
    const workflows = await gateway.status('workflows.list');
    const runPreview = await gateway.preview('workflows.run', { script: 'qa:zavorth-natural-action-harness' });

    expect(agentReference.status).toBe('ok');
    expect(JSON.stringify(agentReference.data)).toContain('delegate_task');
    expect(workspaceReference.status).toBe('ok');
    expect(JSON.stringify(workspaceReference.data)).toContain('file_fetch');
    expect(workflows.status).toBe('ok');
    expect(JSON.stringify(workflows.data)).toContain('qa:zavorth-natural-action-harness');
    expect(runPreview.status).toBe('preview');
    expect(runPreview.data?.liveExecution).toBe(false);
  });
});
