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

export type EmulationFormat = 'XML_TAGS' | 'JSON_BLOCKS';

function extractBalancedJson(text: string, startIndex: number): { json: string; endIndex: number } | null {
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];
    if (isEscaped) { isEscaped = false; continue; }
    if (char === '\\' && inString) { isEscaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { json: text.slice(startIndex, i + 1), endIndex: i + 1 };
    }
  }
  return null;
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

    const text = rawText;
    const toolCalls: ExtractedToolCall[] = [];
    const rawSnippets: string[] = [];
    let callCounter = 0;

    // 1. Extract XML <tool_call> blocks (canonical emulation format).
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
        rawSnippets.push(blockSnippet);
      }

      searchStart = closeTagIdx + 12;
    }

    // 2. Extract DeepSeek-style <function>name</function>({...}) blocks.
    let functionSearch = 0;
    while (functionSearch < text.length) {
      const openIdx = text.indexOf('<function>', functionSearch);
      if (openIdx < 0) break;
      const nameStart = openIdx + '<function>'.length;
      const nameEnd = text.indexOf('</function>', nameStart);
      if (nameEnd < 0) break;
      const toolName = text.substring(nameStart, nameEnd).trim();
      const jsonStart = text.indexOf('{', nameEnd);
      if (jsonStart < 0) break;
      const balanced = extractBalancedJson(text, jsonStart);
      if (!balanced) break;
      if (toolName) {
        const repairRes = this.jsonRepair.parseSafe<Record<string, unknown>>(balanced.json, {});
        toolCalls.push({
          id: `call-emulated-${Date.now()}-${callCounter++}`,
          name: toolName,
          parameters: repairRes.data || {},
          rawInvocationSnippet: text.substring(openIdx, balanced.endIndex),
        });
        rawSnippets.push(text.substring(openIdx, balanced.endIndex));
      }
      functionSearch = balanced.endIndex;
    }

    // 3. Extract ```json blocks with {"tool": ..., "parameters": {...}} (JSON_BLOCKS format).
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
          rawSnippets.push(snippet);
        }

        codeSearch = fenceEnd + 3;
      }
    }

    // 4. Extract inline JSON tool invocations (Nemotron-style {"tool": "...", "arguments": {...}}).
    if (toolCalls.length === 0) {
      let jsonSearch = 0;
      while (jsonSearch < text.length) {
        const jsonStart = text.indexOf('{', jsonSearch);
        if (jsonStart < 0) break;
        const balanced = extractBalancedJson(text, jsonStart);
        if (!balanced) break;
        const parsed = this.jsonRepair.parseSafe<Record<string, unknown>>(balanced.json);
        const data = parsed.success ? parsed.data : null;
        const name = data && (typeof data.tool === 'string'
          ? data.tool
          : typeof data.name === 'string' ? data.name : null);
        if (name) {
          const argumentsValue = data && (
            (data.arguments && typeof data.arguments === 'object' ? data.arguments : null)
            || (data.parameters && typeof data.parameters === 'object' ? data.parameters : null)
            || (data.args && typeof data.args === 'object' ? data.args : null)
            || {}
          );
          toolCalls.push({
            id: `call-emulated-${Date.now()}-${callCounter++}`,
            name,
            parameters: argumentsValue as Record<string, unknown>,
            rawInvocationSnippet: balanced.json,
          });
          rawSnippets.push(balanced.json);
        }
        jsonSearch = balanced.endIndex;
      }
    }

    // Remove raw tool call snippets to produce clean conversational text.
    let cleanText = rawText;
    for (const snippet of rawSnippets) {
      cleanText = cleanText.replace(snippet, '');
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
    format: EmulationFormat = 'XML_TAGS'
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

    return `<tool_response>\n  <name>${escapeXmlText(toolName)}</name>\n  <result>${escapeXmlText(resultPayload)}</result>\n</tool_response>`;
  }

  public resolveExecutionTrack(capability: ProviderCapabilityProfile): 'NATIVE' | 'EMULATED' {
    return capability.supportsNativeTools ? 'NATIVE' : 'EMULATED';
  }
}

function escapeXmlText(value: string): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
