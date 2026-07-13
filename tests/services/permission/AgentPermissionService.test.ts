import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentPermissionService } from '../../../src/services/permission/AgentPermissionService.js';
import { WorkspaceSessionGrantCache } from '../../../src/services/WorkspaceSessionGrantCache.js';
import { ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION } from '../../../src/contracts/permission/AgentPermissionContract.js';

describe('AgentPermissionService', () => {
  let tempRoot: string;
  let service: AgentPermissionService;
  let grants: WorkspaceSessionGrantCache;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-agent-perm-'));
    grants = WorkspaceSessionGrantCache.getInstance();
    grants.clearAll();
    service = new AgentPermissionService({
      projectRoot: tempRoot,
      grantCache: grants,
      alwaysPath: path.join(tempRoot, 'always.json'),
    });
  });

  afterEach(() => {
    grants.clearAll();
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('allows safe tools without ask', () => {
    const result = service.evaluate({
      toolName: 'read_file',
      risk: 'safe',
      requiresApproval: false,
    });
    expect(result.action).toBe('allow');
    expect(result.satisfiedBy).toBe('safe');
  });

  it('asks for danger / requiresApproval', () => {
    expect(
      service.evaluate({ toolName: 'terminal', risk: 'danger', requiresApproval: true }).action,
    ).toBe('ask');
  });

  it('once allows without remembering', () => {
    const r = service.respond({
      choice: 'once',
      toolName: 'terminal',
      pattern: 'rm -rf',
    });
    expect(r.allowed).toBe(true);
    expect(r.remembered).toBe(false);
    expect(r.scope).toBe('once');
    // still ask next time
    expect(
      service.evaluate({
        toolName: 'terminal',
        pattern: 'rm -rf',
        risk: 'danger',
        requiresApproval: true,
      }).action,
    ).toBe('ask');
  });

  it('session remembers until cleared', () => {
    service.respond({
      choice: 'session',
      toolName: 'terminal',
      pattern: 'npm test',
      workspaceId: 'ws1',
      sessionId: 's1',
      sessionTtlMs: 60_000,
    });
    const next = service.evaluate({
      toolName: 'terminal',
      pattern: 'npm test',
      risk: 'danger',
      requiresApproval: true,
      workspaceId: 'ws1',
      sessionId: 's1',
    });
    expect(next.action).toBe('allow');
    expect(next.satisfiedBy).toBe('session');
  });

  it('always persists to disk', () => {
    service.respond({
      choice: 'always',
      toolName: 'read_file',
      pattern: '*',
      actorId: 'op',
    });
    const again = new AgentPermissionService({
      projectRoot: tempRoot,
      alwaysPath: path.join(tempRoot, 'always.json'),
      grantCache: grants,
    });
    const result = again.evaluate({
      toolName: 'read_file',
      pattern: 'anything',
      risk: 'attention',
      requiresApproval: true,
    });
    expect(result.action).toBe('allow');
    expect(result.satisfiedBy).toBe('always');
    expect(fs.existsSync(path.join(tempRoot, 'always.json'))).toBe(true);
  });

  it('deny blocks for session', () => {
    service.respond({
      choice: 'deny',
      toolName: 'shell',
      pattern: 'format',
      sessionId: 's1',
    });
    expect(
      service.evaluate({
        toolName: 'shell',
        pattern: 'format',
        risk: 'danger',
        sessionId: 's1',
        requiresApproval: true,
      }).action,
    ).toBe('deny');
  });

  it('workspace grant reduces friction for medium risk', () => {
    grants.setGrant('ws-grant', {
      workspaceId: 'ws-grant',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      allowRiskUpTo: 'MEDIUM',
      allowPackageInstall: false,
      allowNetwork: false,
    });
    const result = service.evaluate({
      toolName: 'edit',
      risk: 'attention',
      requiresApproval: true,
      workspaceId: 'ws-grant',
    });
    expect(result.action).toBe('allow');
    expect(result.satisfiedBy).toBe('workspace-grant');
  });

  it('exposes stable contract version', () => {
    expect(service.evaluate({ toolName: 'x', risk: 'safe' }).contractVersion).toBe(
      ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
    );
  });
});
