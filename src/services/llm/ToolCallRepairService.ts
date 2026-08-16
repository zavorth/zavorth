/**
 * Tool Call Auto-Repair Service.
 * Detects, parses, and promotes plain-text, markdown JSON, XML-ish, and ReAct tool invocations
 * emitted by smaller/local open-source LLMs (Ollama, DeepSeek, Llama 3, Qwen) into strictly-typed ToolCall objects.
 */

import type { ToolCall } from '../../adapters/llm/LLMAdapterContract.js';

export interface RepairedToolCallResult {
  cleanedContent: string;
  toolCalls: ToolCall[];
  repaired: boolean;
}

export class ToolCallRepairService {
  /**
   * Scans content for non-standard tool invocations and repairs them into standard ToolCall objects.
   */
  static repair(rawContent: string): RepairedToolCallResult {
    if (!rawContent || typeof rawContent !== 'string') {
      return { cleanedContent: rawContent || '', toolCalls: [], repaired: false };
    }

    const toolCalls: ToolCall[] = [];
    let workingContent = rawContent;

    // 1. Scan for XML-style tool calls: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
    const xmlToolCallRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi;
    let match: RegExpExecArray | null;
    while ((match = xmlToolCallRegex.exec(rawContent)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name) {
          toolCalls.push({
            id: `repaired_xml_${Date.now()}_${toolCalls.length}`,
            type: 'function',
            function: {
              name: parsed.name,
              arguments: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments || {}),
            },
          });
        }
      } catch {
        // Invalid JSON inside tag
      }
    }
    workingContent = workingContent.replace(xmlToolCallRegex, '').trim();

    // 2. Scan for OpenCode / Harmony XML tags: <function=tool_name><parameter=key>value</parameter></function>
    const functionTagRegex = /<function=([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/function>/gi;
    while ((match = functionTagRegex.exec(rawContent)) !== null) {
      const toolName = match[1];
      const paramsBody = match[2];
      const argsObj: Record<string, string> = {};

      const paramRegex = /<parameter=([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/parameter>/gi;
      let paramMatch: RegExpExecArray | null;
      while ((paramMatch = paramRegex.exec(paramsBody)) !== null) {
        argsObj[paramMatch[1]] = paramMatch[2].trim();
      }

      toolCalls.push({
        id: `repaired_fn_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(argsObj),
        },
      });
    }
    workingContent = workingContent.replace(functionTagRegex, '').trim();

    // 3. Scan for ReAct format: Action: tool_name\nAction Input: {...}
    const reactRegex = /Action:\s*([a-zA-Z0-9_\-]+)\s*\nAction Input:\s*(\{[\s\S]*?\}|\[[\s\S]*?\]|".*?"|\d+)/gi;
    while ((match = reactRegex.exec(rawContent)) !== null) {
      const toolName = match[1];
      const rawInput = match[2].trim();
      let argsString = '{}';

      try {
        if (rawInput.startsWith('{') || rawInput.startsWith('[')) {
          JSON.parse(rawInput); // Validate JSON
          argsString = rawInput;
        } else {
          argsString = JSON.stringify({ input: rawInput });
        }
      } catch {
        argsString = JSON.stringify({ input: rawInput });
      }

      toolCalls.push({
        id: `repaired_react_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: argsString,
        },
      });
    }
    workingContent = workingContent.replace(reactRegex, '').trim();

    // 4. Scan for Markdown JSON tool code blocks if standalone: ```json {"tool": "...", "parameters": {...}} ```
    const markdownJsonRegex = /```(?:json)?\s*\{\s*"tool"\s*:\s*"([a-zA-Z0-9_\-]+)"\s*,\s*"(?:parameters|arguments|args)"\s*:\s*(\{[\s\S]*?\})\s*\}\s*```/gi;
    while ((match = markdownJsonRegex.exec(rawContent)) !== null) {
      const toolName = match[1];
      const argsBody = match[2];

      toolCalls.push({
        id: `repaired_md_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: argsBody,
        },
      });
    }
    workingContent = workingContent.replace(markdownJsonRegex, '').trim();

    return {
      cleanedContent: workingContent,
      toolCalls,
      repaired: toolCalls.length > 0,
    };
  }
}
