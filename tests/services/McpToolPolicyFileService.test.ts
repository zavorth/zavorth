import { McpToolPolicyFileService } from '../../src/services/McpToolPolicyFileService.js';
import type { McpToolPolicyDocument } from '../../src/mcp/McpToolPolicy.js';

describe('McpToolPolicyFileService tool mutations', () => {
  it('approveTool approves pending tool and adds it to the allowlist', () => {
    const service = new McpToolPolicyFileService({
      now: () => new Date('2026-06-12T12:00:00.000Z'),
    });

    const doc: McpToolPolicyDocument = {
      version: 1,
      updatedAt: '2026-06-12T00:00:00.000Z',
      profile: 'safe',
      allowlist: [],
      tools: {
        'serverA:test_tool': {
          status: 'pending_approval',
          fingerprint: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
          lastSeenDescription: 'Original Pending Description',
          pendingReason: 'new_tool',
        },
      },
    };

    service.approveTool(doc, 'serverA:test_tool');

    expect(doc.tools['serverA:test_tool']).toEqual({
      status: 'approved',
      fingerprint: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      description: 'Original Pending Description',
      lastSeenDescription: 'Original Pending Description',
      lastSeenAt: '2026-06-12T12:00:00.000Z',
    });
    expect(doc.allowlist).toContain('serverA:test_tool');
  });

  it('approveTool fails if tool is not namespaced', () => {
    const service = new McpToolPolicyFileService();
    const doc: McpToolPolicyDocument = { version: 1, updatedAt: '', profile: 'safe', allowlist: [], tools: {} };
    expect(() => service.approveTool(doc, 'simple_name')).toThrow('deve ser namespaced');
  });

  it('approveTool requires fingerprint for new tool', () => {
    const service = new McpToolPolicyFileService();
    const doc: McpToolPolicyDocument = { version: 1, updatedAt: '', profile: 'safe', allowlist: [], tools: {} };
    expect(() => service.approveTool(doc, 'serverA:new_tool')).toThrow('nunca foi vista pelo runtime');
  });

  it('approveTool validates manual fingerprint format', () => {
    const service = new McpToolPolicyFileService();
    const doc: McpToolPolicyDocument = { version: 1, updatedAt: '', profile: 'safe', allowlist: [], tools: {} };
    expect(() => service.approveTool(doc, 'serverA:new_tool', 'invalid-fp')).toThrow('Fingerprint invalid');
  });

  it('approveTool accepts and validates manual fingerprint for new tool', () => {
    const service = new McpToolPolicyFileService({
      now: () => new Date('2026-06-12T12:00:00.000Z'),
    });
    const doc: McpToolPolicyDocument = { version: 1, updatedAt: '', profile: 'safe', allowlist: [], tools: {} };
    const fp = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
    service.approveTool(doc, 'serverA:new_tool', fp, 'custom description');

    expect(doc.tools['serverA:new_tool']).toEqual({
      status: 'approved',
      fingerprint: fp,
      description: 'custom description',
      lastSeenDescription: undefined,
      lastSeenAt: '2026-06-12T12:00:00.000Z',
    });
    expect(doc.allowlist).toContain('serverA:new_tool');
  });

  it('approveTool rejects manual fingerprint mismatch unless forceFingerprint is true', () => {
    const service = new McpToolPolicyFileService();
    const fp1 = '1111111111111111111111111111111111111111111111111111111111111111';
    const fp2 = '2222222222222222222222222222222222222222222222222222222222222222';
    const doc: McpToolPolicyDocument = {
      version: 1,
      updatedAt: '',
      profile: 'safe',
      allowlist: [],
      tools: {
        'serverA:tool': { status: 'pending_approval', fingerprint: fp1 },
      },
    };

    expect(() => service.approveTool(doc, 'serverA:tool', fp2)).toThrow('diferente do fingerprint registrado');

    // With forceFingerprint: true
    service.approveTool(doc, 'serverA:tool', fp2, undefined, true);
    expect(doc.tools['serverA:tool']?.fingerprint).toBe(fp2);
  });

  it('blockTool blocks a tool and removes from allowlist', () => {
    const service = new McpToolPolicyFileService({
      now: () => new Date('2026-06-12T12:00:00.000Z'),
    });
    const doc: McpToolPolicyDocument = {
      version: 1,
      updatedAt: '',
      profile: 'safe',
      allowlist: ['serverA:tool'],
      tools: {
        'serverA:tool': { status: 'approved', fingerprint: '1111111111111111111111111111111111111111111111111111111111111111' },
      },
    };

    service.blockTool(doc, 'serverA:tool');
    expect(doc.tools['serverA:tool']?.status).toBe('blocked');
    expect(doc.allowlist).not.toContain('serverA:tool');
  });

  it('forgetTool removes tool from tools map and allowlist', () => {
    const service = new McpToolPolicyFileService();
    const doc: McpToolPolicyDocument = {
      version: 1,
      updatedAt: '',
      profile: 'safe',
      allowlist: ['serverA:tool'],
      tools: {
        'serverA:tool': { status: 'approved', fingerprint: '1111111111111111111111111111111111111111111111111111111111111111' },
      },
    };

    service.forgetTool(doc, 'serverA:tool');
    expect(doc.tools['serverA:tool']).toBeUndefined();
    expect(doc.allowlist).not.toContain('serverA:tool');
  });
});
