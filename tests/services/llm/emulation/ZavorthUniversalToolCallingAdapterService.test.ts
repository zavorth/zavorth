import { ZavorthUniversalToolCallingAdapterService } from '../../../../src/services/llm/emulation/ZavorthUniversalToolCallingAdapterService';

describe('ZavorthUniversalToolCallingAdapterService', () => {
  let service: ZavorthUniversalToolCallingAdapterService;

  beforeEach(() => {
    service = new ZavorthUniversalToolCallingAdapterService();
  });

  it('should build prompt tool specifications in XML and JSON formats', () => {
    const tools = [
      {
        name: 'kanban_board',
        description: 'Swarm Kanban task management',
        parameters: { type: 'object', properties: { action: { type: 'string' } } },
      },
    ];

    const xmlSpec = service.buildPromptToolSpecifications(tools, 'XML_TAGS');
    expect(xmlSpec).toContain('<tool name="kanban_board">');
    expect(xmlSpec).toContain('<tool_call>');

    const jsonSpec = service.buildPromptToolSpecifications(tools, 'JSON_BLOCKS');
    expect(jsonSpec).toContain('# AVAILABLE TOOLS');
    expect(jsonSpec).toContain('kanban_board');
  });

  it('should extract XML tool calls deterministically without regex', () => {
    const rawOutput = `
I will now inspect the project files.
<tool_call>
  <name>zavorth_codebase_graph</name>
  <parameters>{"action": "impact_analysis", "filePath": "src/auth.ts", "symbolName": "verifyToken"}</parameters>
</tool_call>
Please wait while this executes.
`;

    const result = service.extractToolInvocations(rawOutput);

    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].name).toBe('zavorth_codebase_graph');
    expect(result.toolCalls[0].parameters.action).toBe('impact_analysis');
    expect(result.toolCalls[0].parameters.symbolName).toBe('verifyToken');
    expect(result.cleanConversationalText).toContain('I will now inspect the project files.');
  });

  it('should extract JSON code block tool calls as fallback', () => {
    const rawOutput = `
Let me check the diagnostics:
\`\`\`json
{
  "tool": "zavorth_lsp_diagnostics",
  "parameters": {
    "action": "check",
    "filePath": "src/app.ts",
  }
}
\`\`\`
`;

    const result = service.extractToolInvocations(rawOutput);

    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].name).toBe('zavorth_lsp_diagnostics');
    expect(result.toolCalls[0].parameters.filePath).toBe('src/app.ts');
  });

  it('should format tool responses in XML and JSON schemas', () => {
    const xmlResp = service.formatToolResponse('zavorth_power_lock', '{"status":"AC_POWER"}');
    expect(xmlResp).toContain('<tool_response>');
    expect(xmlResp).toContain('<name>zavorth_power_lock</name>');

    const jsonResp = service.formatToolResponse('zavorth_power_lock', '{"status":"AC_POWER"}', 'JSON_BLOCKS');
    expect(jsonResp).toContain('tool_response');
  });

  it('should dynamically resolve execution track based on capability profile without hardcoded models', () => {
    expect(service.resolveExecutionTrack({ supportsNativeTools: true })).toBe('NATIVE');
    expect(service.resolveExecutionTrack({ supportsNativeTools: false })).toBe('EMULATED');
  });
});
