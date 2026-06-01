import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runZavorthLiveNamespaceCommand } from '../../src/cli/ZavorthCliLiveNamespaces';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skills-governance-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'skills-governance-test' }));
  return root;
}

describe('Zavorth skills governance command', () => {
  const roots: string[] = [];

  afterEach(() => {
    delete process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE;
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('previews and applies governed mode through a natural CLI phrase', async () => {
    const root = makeRoot();
    roots.push(root);

    const preview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['mude', 'o', 'skill', 'governance', 'pra', 'governed', '--json'],
    });
    const previewPayload = JSON.parse(preview.output);
    expect(previewPayload.dryRun).toBe(true);
    expect(previewPayload.mode).toBe('governed');
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);

    const applied = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['mude', 'o', 'skill', 'governance', 'pra', 'governed', '--apply', '--json'],
    });
    const payload = JSON.parse(applied.output);
    expect(payload.applied).toBe(true);
    expect(payload.mode).toBe('governed');
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain('ZAVORTH_SKILLS_GOVERNANCE_MODE=governed');
  });
});
