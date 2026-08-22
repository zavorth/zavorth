import { skillExecutor } from "./executor";
import { detectProvider } from "./injection";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../utils/errorLike';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface OpenAIToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAIChoice {
  message?: { tool_calls?: OpenAIToolCall[] };
}

interface OpenAIRawResponse {
  tool_calls?: OpenAIToolCall[];
  choices?: OpenAIChoice[];
}

interface AnthropicContentBlock {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicRawResponse {
  content?: AnthropicContentBlock[];
}

interface GoogleFunctionCall {
  name?: string;
  args?: Record<string, unknown>;
}

interface GoogleRawResponse {
  functionCalls?: GoogleFunctionCall[];
}

interface ExecutionContext {
  apiKeyId: string;
  sessionId: string;
  requestId: string;
}

export async function interceptToolCalls(
  toolCalls: ToolCall[],
  context: ExecutionContext
): Promise<{ id: string; result: unknown }[]> {
  const results = await Promise.all(
    toolCalls.map(async (call) => {
      try {
        const [name, version] = call.name.includes("@")
          ? call.name.split("@")
          : [call.name, "latest"];

        const skillName = version === "latest" ? name : `${name}@${version}`;

        const execution = await skillExecutor.execute(skillName, call.arguments, {
          apiKeyId: context.apiKeyId,
          sessionId: context.sessionId,
        });

        const result =
          execution.output ??           (execution.errorMessage
            ? { error: execution.errorMessage }
            : { error: "Skill execution returned no output" });

        return {
          id: call.id,
          result,
        };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[interception] process execution failed', error);
    return {
          id: call.id,
          result: { error: err instanceof Error ? err.message : String(err) },
        };
  }
    })
  );

  return results;
}

export function extractToolCalls(response: unknown, modelId: string): ToolCall[] {
  const provider = detectProvider(modelId);

  switch (provider) {
    case "openai": {
      const openaiResponse = response as OpenAIRawResponse;
      const rootToolCalls = Array.isArray(openaiResponse?.tool_calls) ? openaiResponse.tool_calls : [];
      const choiceToolCalls = Array.isArray(openaiResponse?.choices)
        ? openaiResponse.choices.flatMap((choice) =>
            Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls : []
          )
        : [];
      const toolCalls = rootToolCalls.length > 0 ? rootToolCalls : choiceToolCalls;

      return toolCalls.map((tc) => ({
        id: tc.id || `call_${Date.now()}`,
        name: tc.function?.name || "",
        arguments: parseArguments(tc.function?.arguments || "{}"),
      }));
    }

    case "anthropic": {
      const anthropicResponse = response as AnthropicRawResponse;
      return (anthropicResponse.content || [])
        .filter((c) => c.type === "tool_use")
        .map((tc) => ({
          id: tc.id || `call_${Date.now()}`,
          name: tc.name || "",
          arguments: tc.input || {},
        }));
    }

    case "google": {
      const googleResponse = response as GoogleRawResponse;
      return (googleResponse.functionCalls || []).map((fc) => ({
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: fc.name || "",
        arguments: fc.args || {},
      }));
    }

    default:
      return [];
  }
}

function parseArguments(args: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof args === "object") {
    return args;
  }

  try {
    return JSON.parse(args);
  } catch (error: unknown) {logger.warn('[interception] JSON parse failed', error); return {}; }
}

export async function handleToolCallExecution(
  response: unknown,
  modelId: string,
  context: ExecutionContext
): Promise<unknown> {
  const toolCalls = extractToolCalls(response, modelId);

  if (toolCalls.length === 0) {
    return response;
  }

  const results = await interceptToolCalls(toolCalls, context);

  const provider = detectProvider(modelId);

  switch (provider) {
    case "openai": {
      const openaiResponse = response as OpenAIRawResponse;
      return {
        ...openaiResponse,
        tool_results: results.map((r) => ({
          tool_call_id: r.id,
          output: JSON.stringify(r.result),
        })),
      };
    }

    case "anthropic": {
      const anthropicResponse = response as AnthropicRawResponse;
      return {
        ...anthropicResponse,
        content: [
          ...(anthropicResponse.content || []),
          ...results.map((r) => ({
            type: "tool_result",
            tool_use_id: r.id,
            content: JSON.stringify(r.result),
          })),
        ],
      };
    }

    default:
      return response;
  }
}
