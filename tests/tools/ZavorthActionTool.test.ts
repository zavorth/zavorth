import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ZavorthActionTool } from '../../src/tools/ZavorthActionTool';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-action-tool-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'action-tool-test' }));
  return root;
}

describe('ZavorthActionTool', () => {
  const roots: string[] = [];

  afterEach(() => {
    delete process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE;
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('exposes lookup for natural Zavorth action requests', async () => {
    const root = makeRoot();
    roots.push(root);
    const tool = new ZavorthActionTool();

    const payload = JSON.parse(await tool.execute({
      operation: 'action.schema.lookup',
      query: 'mude o skill governance para governed',
      root,
    }));

    expect(payload.status).toBe('ok');
    expect(payload.data.matches[0].actionId).toBe('skills.governance.set');
  });

  it('defers mutating apply to approval instead of writing state from the LLM tool', async () => {
    const root = makeRoot();
    roots.push(root);
    const tool = new ZavorthActionTool();

    const payload = JSON.parse(await tool.execute({
      operation: 'action.apply',
      actionId: 'skills.governance.set',
      argsJson: JSON.stringify({ mode: 'governed' }),
      root,
    }));

    expect(payload.status).toBe('approval_required');
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);
  });
});
