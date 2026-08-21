import { CommandToToolAdapter } from '../../../src/domain/commands/CommandToToolAdapter.js';
import type { UniversalCommandDescriptor } from '../../../src/contracts/commands/UniversalCommandContract.js';

describe('CommandToToolAdapter', () => {
  const sampleDescriptor: UniversalCommandDescriptor = {
    id: 'system.backup',
    name: 'System Backup',
    description: 'Creates a full or incremental system backup snapshot.',
    toolName: 'system_backup_tool',
    slashAliases: ['/backup', '/bk'],
    group: 'workspace',
    riskLevel: 'sensitive_approval_required',
    requiresApproval: true,
    policyTags: ['backup', 'storage'],
    parameters: {
      type: 'object',
      properties: {
        targetDir: { type: 'string', description: 'Target destination directory' },
        includeLogs: { type: 'boolean', description: 'Whether to include system logs' },
        mode: { type: 'string', description: 'Backup mode', enum: ['full', 'diff', 'snap'] },
      },
      required: ['targetDir'],
    },
    execute: async () => ({
      success: true,
      message: 'Backup completed',
    }),
  };

  it('projects command risk levels onto the canonical catalog risk scale', () => {
    const readOnly = CommandToToolAdapter.toToolGroupCatalogEntry({
      ...sampleDescriptor,
      id: 'a.read',
      toolName: 'a_read_tool',
      riskLevel: 'read_only',
      requiresApproval: false,
    });
    expect(readOnly.risk).toBe('safe');
    expect(readOnly.policyTags).not.toContain('approval-required');

    const attention = CommandToToolAdapter.toToolGroupCatalogEntry({
      ...sampleDescriptor,
      id: 'b.mutate',
      toolName: 'b_mutate_tool',
      riskLevel: 'safe_mutation',
      requiresApproval: false,
    });
    expect(attention.risk).toBe('attention');

    const danger = CommandToToolAdapter.toToolGroupCatalogEntry(sampleDescriptor);
    expect(danger.risk).toBe('danger');
  });

  it('converts UniversalCommandDescriptor into ToolGroupCatalogEntry', () => {
    const catalogEntry = CommandToToolAdapter.toToolGroupCatalogEntry(sampleDescriptor);

    expect(catalogEntry.id).toBe('system_backup_tool');
    expect(catalogEntry.group).toBe('workspace');
    expect(catalogEntry.risk).toBe('danger');
    expect(catalogEntry.requiresApproval).toBe(true);
    expect(catalogEntry.description).toBe('Creates a full or incremental system backup snapshot.');
    expect(catalogEntry.policyTags).toContain('capability:system.backup');
    expect(catalogEntry.policyTags).toContain('group:workspace');
    expect(catalogEntry.policyTags).toContain('risk:danger');
    expect(catalogEntry.policyTags).toContain('approval-required');
    expect(catalogEntry.policyTags).toContain('backup');
    expect(catalogEntry.policyTags).toContain('storage');
  });
});
