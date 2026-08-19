import { ZavorthJsonSchemaRepairService } from '../repair/ZavorthJsonSchemaRepairService.js';
import type { ToolDefinition } from '../../../providers/ILlmProvider.js';

export interface ExtractedToolCall {
  readonly id: string;
  readonly name: string;
  readonly parameters: Record<string, unknown>;
  readonly rawInvocationSnippet: string;
}

export interface EmulatedToolParsingResult {
  readonly hasToolCalls: boolean;
  readonly toolCalls: readonly ExtractedToolCall[];
  readonly cleanConversationalText: string;
}

export interface ProviderCapabilityProfile {
  readonly supportsNativeTools: boolean;
  readonly preferredEmulationFormat?: 'XML_TAGS' | 'JSON_BLOCKS';
}

export class ZavorthUniversalToolCallingAdapterService {
  private readonly jsonRepair = new ZavorthJsonSchemaRepairService();

  public buildPromptToolSpecifications(
    tools: readonly ToolDefinition[],
    format: 'XML_TAGS' | 'JSON_BLOCKS' = 'XML_TAGS'
  ): string {
    if (!tools || tools.length === 0) {
      return '';
    }

    if (format === 'JSON_BLOCKS') {
      const toolSchemas = tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
      return [
        '# AVAILABLE TOOLS',
        'To invoke a tool, output a JSON code block in this exact schema:',
        '```json',
        '{\n  "tool": "tool_name",\n  "parameters": { ... }\n}',
        '```',
        '# TOOLS DEFINITIONS:',
        '```json',
        JSON.stringify(toolSchemas, null, 2),
        '```',
      ].join('\n');
    }

    // Default XML format
    const lines: string[] = [
      '# TOOLS SYSTEM',
      'You have access to the following tools. To call a tool, respond with an XML block in this format:',
      '<tool_call>',
      '  <name>tool_name</name>',
      '  <parameters>{"param": "value"}</parameters>',
      '</tool_call>',
      '',
      '<tools>',
    ];

    for (const tool of tools) {
      lines.push(`  <tool name="${tool.name}">`);
      lines.push(`    <description>${tool.description}</description>`);
      lines.push(`    <parameters>${JSON.stringify(tool.parameters)}</parameters>`);
      lines.push('  </tool>');
    }

    lines.push('</tools>');
    return lines.join('\n');
  }

  public extractToolInvocations(rawText: string): EmulatedToolParsingResult {
    if (!rawText || rawText.trim().length === 0) {
      return {
        hasToolCalls: false,
        toolCalls: [],
        cleanConversationalText: '',
      };
    }

    const toolCalls: ExtractedToolCall[] = [];
    let text = rawText;
    let callCounter = 0;

    // 1. Try Extracting XML <tool_call> blocks (token-based delimiter search)
    let searchStart = 0;
    while (searchStart < text.length) {
      const openTagIdx = text.indexOf('<tool_call>', searchStart);
      if (openTagIdx < 0) break;

      const closeTagIdx = text.indexOf('</tool_call>', openTagIdx + 11);
      if (closeTagIdx < 0) break;

      const blockSnippet = text.substring(openTagIdx, closeTagIdx + 12);
      const innerContent = text.substring(openTagIdx + 11, closeTagIdx);

      const nameStart = innerContent.indexOf('<name>');
      const nameEnd = innerContent.indexOf('</name>', nameStart + 6);

      let toolName = '';
      if (nameStart >= 0 && nameEnd > nameStart) {
        toolName = innerContent.substring(nameStart + 6, nameEnd).trim();
      }

      const paramStart = innerContent.indexOf('<parameters>');
      const paramEnd = innerContent.indexOf('</parameters>', paramStart + 12);

      let rawParamString = '{}';
      if (paramStart >= 0 && paramEnd > paramStart) {
        rawParamString = innerContent.substring(paramStart + 12, paramEnd).trim();
      }

      if (toolName) {
        const repairRes = this.jsonRepair.parseSafe<Record<string, unknown>>(rawParamString, {});
        toolCalls.push({
          id: `call-emulated-${Date.now()}-${callCounter++}`,
          name: toolName,
          parameters: repairRes.data || {},
          rawInvocationSnippet: blockSnippet,
        });
      }

      searchStart = closeTagIdx + 12;
    }

    // 2. If no XML tool calls found, try Extracting JSON Code Block tool calls
    if (toolCalls.length === 0) {
      let codeSearch = 0;
      while (codeSearch < text.length) {
        const fenceStart = text.indexOf('```json', codeSearch);
        if (fenceStart < 0) break;

        const fenceEnd = text.indexOf('```', fenceStart + 7);
        if (fenceEnd < 0) break;

        const snippet = text.substring(fenceStart, fenceEnd + 3);
        const jsonContent = text.substring(fenceStart + 7, fenceEnd).trim();
        const parsed = this.jsonRepair.parseSafe<Record<string, unknown>>(jsonContent);

        if (parsed.success && parsed.data && typeof parsed.data.tool === 'string') {
          const params = (parsed.data.parameters as Record<string, unknown>) || {};
          toolCalls.push({
            id: `call-emulated-${Date.now()}-${callCounter++}`,
            name: parsed.data.tool,
            parameters: params,
            rawInvocationSnippet: snippet,
          });
        }

        codeSearch = fenceEnd + 3;
      }
    }

    // Remove raw tool call snippets to produce clean conversational text
    let cleanText = rawText;
    for (const call of toolCalls) {
      cleanText = cleanText.replace(call.rawInvocationSnippet, '');
    }

    return {
      hasToolCalls: toolCalls.length > 0,
      toolCalls,
      cleanConversationalText: cleanText.trim(),
    };
  }

  public formatToolResponse(
    toolName: string,
    resultPayload: string,
    format: 'XML_TAGS' | 'JSON_BLOCKS' = 'XML_TAGS'
  ): string {
    if (format === 'JSON_BLOCKS') {
      return [
        '```json',
        JSON.stringify({
          tool_response: toolName,
          result: resultPayload,
        }, null, 2),
        '```',
      ].join('\n');
    }

    return `<tool_response>\n  <name>${toolName}</name>\n  <result>${resultPayload}</result>\n</tool_response>`;
  }

  public resolveExecutionTrack(capability: ProviderCapabilityProfile): 'NATIVE' | 'EMULATED' {
    return capability.supportsNativeTools ? 'NATIVE' : 'EMULATED';
  }
}
