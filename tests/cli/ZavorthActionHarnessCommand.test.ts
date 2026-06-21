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

  it('lists, inspects and doctors verified workspace actions', async () => {
    const root = makeRoot();
    roots.push(root);

    const listed = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['list', '--verified', '--json'],
    });
    const listPayload = JSON.parse(listed.output);
    expect(listPayload.actions.map((action: { id: string }) => action.id)).toEqual(expect.arrayContaining([
      'workspace.create_file',
      'workspace.write_file',
      'workspace.patch_file',
    ]));
    expect(listPayload.actions.every((action: { verificationStatus: string }) => action.verificationStatus === 'verified')).toBe(true);

    const inspected = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['inspect', 'workspace.create_file', '--json'],
    });
    const inspectPayload = JSON.parse(inspected.output);
    expect(inspectPayload.action).toEqual(expect.objectContaining({
      id: 'workspace.create_file',
      capabilityId: 'workspace-files',
      requiresPreview: true,
      requiresApproval: true,
      receiptPolicy: 'required',
    }));
    expect(inspectPayload.action.tests.length).toBeGreaterThan(0);

    const doctor = await runZavorthLiveNamespaceCommand({
      projectRoot: path.resolve(__dirname, '..', '..'),
      command: 'actions',
      args: ['doctor', '--json'],
    });
    expect(JSON.parse(doctor.output)).toEqual(expect.objectContaining({
      ok: true,
      failures: [],
    }));
  });

  it('runs workspace actions through preview, approval gate and receipt flow', async () => {
    const root = makeRoot();
    roots.push(root);
    fs.mkdirSync(path.join(root, 'output'), { recursive: true });
    fs.writeFileSync(path.join(root, 'output', 'existing.txt'), 'alpha\n');

    const preview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['preview', '--id', 'workspace.create_file', '--args-json', '{"filepath":"new.txt","content":"hello"}', '--json'],
    });
    expect(JSON.parse(preview.output).status).toBe('preview');
    expect(fs.existsSync(path.join(root, 'output', 'new.txt'))).toBe(false);

    const blocked = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['apply', '--id', 'workspace.create_file', '--args-json', '{"filepath":"new.txt","content":"hello"}', '--json'],
    });
    expect(JSON.parse(blocked.output).status).toBe('approval_required');

    const applied = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['apply', '--id', 'workspace.create_file', '--args-json', '{"filepath":"new.txt","content":"hello"}', '--yes', '--json'],
    });
    expect(JSON.parse(applied.output).status).toBe('applied');
    expect(fs.readFileSync(path.join(root, 'output', 'new.txt'), 'utf8')).toBe('hello');

    const patch = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['apply', '--id', 'workspace.patch_file', '--args-json', '{"filepath":"existing.txt","search":"alpha","replace":"beta"}', '--yes', '--json'],
    });
    expect(JSON.parse(patch.output).status).toBe('applied');
    expect(fs.readFileSync(path.join(root, 'output', 'existing.txt'), 'utf8')).toBe('beta\n');

    const receipts = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'actions',
      args: ['receipts', '--id', 'workspace.create_file', '--json'],
    });
    expect(JSON.parse(receipts.output).data.receipts.length).toBeGreaterThan(0);
  });
});
