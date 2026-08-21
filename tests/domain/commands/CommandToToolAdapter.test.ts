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

  it('converts UniversalCommandDescriptor into ToolDefinition for the LLM', () => {
    const toolDef = CommandToToolAdapter.toToolDefinition(sampleDescriptor);

    expect(toolDef.name).toBe('system_backup_tool');
    expect(toolDef.description).toBe('Creates a full or incremental system backup snapshot.');
    expect(toolDef.category).toBe('workspace');
    expect(toolDef.dangerLevel).toBe('sensitive_approval_required');
    expect(toolDef.requiresPermission).toBe(true);
    expect(toolDef.parameters.type).toBe('object');
    expect(toolDef.parameters.required).toEqual(['targetDir']);
    expect(toolDef.parameters.properties.targetDir.type).toBe('string');
    expect(toolDef.parameters.properties.mode.enum).toEqual(['full', 'diff', 'snap']);
    expect(toolDef.metadata?.commandId).toBe('system.backup');
    expect(toolDef.metadata?.slashAliases).toEqual(['/backup', '/bk']);
  });

  it('converts UniversalCommandDescriptor into ToolGroupCatalogEntry', () => {
    const catalogEntry = CommandToToolAdapter.toToolGroupCatalogEntry(sampleDescriptor);

    expect(catalogEntry.id).toBe('system_backup_tool');
    expect(catalogEntry.group).toBe('workspace');
    expect(catalogEntry.risk).toBe('danger');
    expect(catalogEntry.requiresApproval).toBe(true);
    expect(catalogEntry.policyTags).toContain('capability:system.backup');
    expect(catalogEntry.policyTags).toContain('group:workspace');
    expect(catalogEntry.policyTags).toContain('risk:danger');
    expect(catalogEntry.policyTags).toContain('approval-required');
    expect(catalogEntry.policyTags).toContain('backup');
  });
});
