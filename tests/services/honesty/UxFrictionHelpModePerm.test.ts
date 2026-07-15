import { SharedSurfacePresentationCommandPack } from '../../../src/domain/surface/presentation/shared-surface/SharedSurfacePresentationCommandPack.js';
import {
  formatPermissionListReply,
  formatPermissionDecisionReply,
} from '../../../src/domain/surface/presentation/shared-surface/workflow-governance/workflowGovernanceRenderers.js';
import type { PermissionRequest } from '../../../src/contracts/PermissionRequest.js';

describe('UX friction batch: help layers + perm ordinals', () => {
  const pack = new SharedSurfacePresentationCommandPack({
    securityMeshService: { buildSnapshot: () => ({}) } as any,
    trustPlaneService: {
      buildSnapshot: () => ({ narrative: {}, surfaces: { mcp: {}, skills: {}, systemOverlord: {} } }),
    } as any,
    discordSurfacePolicyService: {
      canUseOperationalCommand: () => false,
      getCommandExposure: () => 'minimal',
    } as any,
  });

  it('default /help is short daily layer without long-id catalog walls', () => {
    const help = pack.renderHelp({ platform: 'telegram', userId: 'u', isGroup: false });
    expect(help).toMatch(/daily help/i);
    expect(help).toMatch(/\/knowledge/);
    expect(help).toMatch(/\/approve/);
    expect(help).toMatch(/\/help advanced/);
    expect(help).not.toMatch(/\/AIGateway/);
    expect(help).not.toMatch(/promote-procedure <id>/);
    expect(help).not.toMatch(/\/approve <task_id>/);
  });

  it('/help advanced exposes power catalog but still prefers ordinals', () => {
    const help = pack.renderHelp({ platform: 'cli', userId: 'u', isGroup: false }, 'advanced');
    expect(help).toMatch(/advanced help/i);
    expect(help).toMatch(/\/plugins|\/platform|\/AIGateway/i);
    expect(help).toMatch(/\/learn promote 1|\/perm approve 1|\/approve 1/);
  });

  it('/help natural explains free-text purity', () => {
    const help = pack.renderHelp({ platform: 'web', userId: 'u', isGroup: false }, 'natural');
    expect(help).toMatch(/does NOT secretly approve/i);
    expect(help).toMatch(/\/approve/);
  });

  it('permission list is numbered without dumping full ids as primary', () => {
    const perms = [
      {
        permission_id: 'perm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        status: 'pending',
        executor: 'shell',
        kind: 'run',
        reason: 'Run a sensitive command',
        scope: 'once',
      },
      {
        permission_id: 'perm-ffffffffffff',
        status: 'pending',
        executor: 'fs',
        kind: 'write',
        reason: 'Write file',
        scope: 'once',
      },
    ] as PermissionRequest[];

    const list = formatPermissionListReply(perms, 'pending');
    expect(list).toMatch(/^1\./m);
    expect(list).toMatch(/^2\./m);
    expect(list).toMatch(/\/perm approve 1/);
    expect(list).not.toMatch(/perm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/);
    expect(list).toMatch(/ref=perm-aaa/);

    const decision = formatPermissionDecisionReply(perms[0], 'approve');
    expect(decision).toMatch(/Permission approved/);
    expect(decision).not.toMatch(/perm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/);
  });
});
