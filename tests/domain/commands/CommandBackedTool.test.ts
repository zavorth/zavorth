import { CommandBackedTool, buildCommandSecurityDefinition } from '../../../src/domain/commands/CommandBackedTool.js';
import { getBuiltinWaveCommandDescriptors } from '../../../src/domain/commands/BuiltinWaveCommandDescriptors.js';
import { initializeBuiltinCommands } from '../../../src/domain/commands/index.js';
import type { UniversalCommandDescriptor } from '../../../src/contracts/commands/UniversalCommandContract.js';

describe('CommandBackedTool', () => {
  beforeAll(() => {
    initializeBuiltinCommands();
  });

  const descriptors = getBuiltinWaveCommandDescriptors();
  const scanDescriptor: UniversalCommandDescriptor = descriptors.find(
    (d) => d.id === 'security.scan',
  ) as UniversalCommandDescriptor;
  const patchDescriptor: UniversalCommandDescriptor = descriptors.find(
    (d) => d.id === 'patch.apply.anchored',
  ) as UniversalCommandDescriptor;

  it('projects descriptor identity and JSON-schema parameters onto the BaseTool contract', () => {
    const tool = new CommandBackedTool(scanDescriptor);

    expect(tool.name).toBe('command_security_scan');
    expect(tool.description).toBe(scanDescriptor.description);
    expect(tool.parameters.type).toBe('object');
    expect(tool.parameters.required).toEqual(['commandLine']);
    const properties = tool.parameters.properties as Record<string, { type: string; description: string }>;
    expect(properties.commandLine.type).toBe('string');
    expect(tool.metadata?.commandId).toBe('security.scan');
  });

  it('executes through the governed registry path returning formatted output', async () => {
    const tool = new CommandBackedTool(scanDescriptor);
    const output = await tool.execute({ commandLine: 'npm test' });

    expect(output).toContain('[Security]');
    expect(output).toContain('safe');
  });

  it('maps risk levels onto explicit agent security definitions', () => {
    const readOnly = buildCommandSecurityDefinition(scanDescriptor);
    expect(readOnly.defaultRisk).toBe('safe');
    expect(readOnly.requiresConfirmation).toBe(false);
    expect(readOnly.source).toBe('explicit');

    const sensitive = buildCommandSecurityDefinition(patchDescriptor);
    expect(sensitive.defaultRisk).toBe('dangerous');
    expect(sensitive.requiresConfirmation).toBe(true);
    expect(sensitive.capabilities).toContain('filesystem');
  });
});
