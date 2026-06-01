import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runZavorthLiveNamespaceCommand } from '../../src/cli/ZavorthCliLiveNamespaces';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-actions-cli-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'actions-cli-test' }));
  return root;
}

describe('Zavorth actions CLI namespace', () => {
  const roots: string[] = [];

  afterEach(() => {
    delete process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE;
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('looks up, previews and applies through the same action gateway', async () => {
    const root = makeRoot();
    roots.push(root);

    const lookup = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['lookup', 'mude', 'o', 'skill', 'governance', 'para', 'governed', '--json'],
    });
    expect(JSON.parse(lookup.output).data.matches[0].actionId).toBe('skills.governance.set');

    const preview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['preview', '--id', 'skills.governance.set', '--args-json', '{"mode":"governed"}', '--json'],
    });
    expect(JSON.parse(preview.output).status).toBe('preview');
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);

    const applied = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['apply', '--id', 'skills.governance.set', '--args-json', '{"mode":"governed"}', '--apply', '--json'],
    });
    expect(JSON.parse(applied.output).status).toBe('applied');
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain('ZAVORTH_SKILLS_GOVERNANCE_MODE=governed');
  });
});
