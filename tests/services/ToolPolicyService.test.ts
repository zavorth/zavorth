import fs from 'fs';
import os from 'os';
import path from 'path';
import { ToolPolicyService } from '../../src/services/ToolPolicyService';

describe('ToolPolicyService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-toolpolicy-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero policies when no TOOL-POLICY.md exists', () => {
    const service = new ToolPolicyService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.policyCount).toBe(0);
    expect(status.defaultLevel).toBe('ask');
    expect(status.filePath).toBe(path.join(tempDir, 'TOOL-POLICY.md'));
  });

  it('sets a policy and persists it to TOOL-POLICY.md', () => {
    const service = new ToolPolicyService({ projectRoot: tempDir });

    const entry = service.setPolicy('shell.execute', 'deny');

    expect(entry.action).toBe('shell.execute');
    expect(entry.level).toBe('deny');
    expect(fs.existsSync(path.join(tempDir, 'TOOL-POLICY.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'TOOL-POLICY.md'), 'utf8');
    expect(fileContent).toContain('[shell.execute] deny');
  });

  it('overwrites an existing policy for the same action', () => {
    const service = new ToolPolicyService({ projectRoot: tempDir });
    service.setPolicy('file.write', 'ask');

    service.setPolicy('file.write', 'allow');

    const policies = service.listPolicies();
    const fileWrite = policies.find((p) => p.action === 'file.write');
    expect(fileWrite?.level).toBe('allow');
  });

  it('checkPermission returns allow=false for default ask level', () => {
    const service = new ToolPolicyService({ projectRoot: tempDir });

    const result = service.checkPermission('email.send');

    expect(result.allowed).toBe(false);
    expect(result.level).toBe('ask');
  });

  it('checkPermission returns allow=true for explicitly allowed action', () => {
    const service = new ToolPolicyService({ projectRoot: tempDir });
    service.setPolicy('file.read', 'allow');

    const result = service.checkPermission('file.read');

    expect(result.allowed).toBe(true);
    expect(result.level).toBe('allow');
  });

  it('sets a policy with conditions', () => {
    const service = new ToolPolicyService({ projectRoot: tempDir });

    service.setPolicy('network.fetch', 'ask', 'only to known domains');

    const policy = service.getPolicy('network.fetch');
    expect(policy?.conditions).toBe('only to known domains');
  });
});
