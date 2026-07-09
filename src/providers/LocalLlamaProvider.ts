import { spawn } from 'child_process';
import { ChatMessage, ILlmProvider, LlmResponse, ProviderChatOptions, ToolDefinition } from './ILlmProvider';
import { safeFetch, readSafeJsonResponse } from '../security/SafeFetchService.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface LocalLlamaProviderOptions {
    baseUrl?: string;
    modelName?: string;
    keepAlive?: string;
    autoStart?: boolean;
    startTimeoutMs?: number;
}

interface ContentPartText {
    type: 'text';
    text: string;
}

interface ContentPartImage {
    type: 'image_url';
    image_url: {
        url: string;
    };
}

type ContentPart = ContentPartText | ContentPartImage;

interface LocalLlamaMessageBody {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | ContentPart[];
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }>;
}

interface LocalLlamaRequestBody {
    model: string;
    messages: LocalLlamaMessageBody[];
    temperature: number;
    keep_alive: string;
    format: string;
}

interface LocalLlamaMessageResponse {
    content: string | null;
    tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
    }>;
}

interface LocalLlamaChoice {
    message: LocalLlamaMessageResponse;
    finish_reason: string | null;
}

interface LocalLlamaResponseData {
    choices: LocalLlamaChoice[];
}

export class LocalLlamaProvider implements ILlmProvider {
    public readonly name = 'local-llama-cpp';
    private baseUrl: string;
    private defaultModel: string;
    private keepAlive: string;
    private autoStart: boolean;
    private startTimeoutMs: number;

    constructor(options?: LocalLlamaProviderOptions) {
        // Defaults to local Ollama serving the OpenAI-compatible API.
        // For LM Studio or llama-server, change the port to 1234 or 8080.
        this.baseUrl = options?.baseUrl || 'http://localhost:11434/v1';
        this.defaultModel = options?.modelName || 'gemma2:2b';
        this.keepAlive = options?.keepAlive || process.env.OLLAMA_KEEP_ALIVE || '30s';
        this.autoStart = options?.autoStart ?? (String(process.env.OLLAMA_AUTO_START || 'true').toLowerCase() !== 'false');
        this.startTimeoutMs = options?.startTimeoutMs || safeParseInt(process.env.OLLAMA_START_TIMEOUT_MS, 15000);
    }

    public async chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse> {
        await this.ensureOllamaServerAvailable();
        const url = `${this.baseUrl}/chat/completions`;
        const modelInfo = options?.modelName || this.defaultModel;

        // Fallback strategy: if the model does not support native API tools,
        // inject the tool definitions directly into the system prompt and require JSON.
        const localMessages = [...messages];
        if (tools && tools.length > 0) {
            const toolPrompt = `
TOOL SYSTEM (ECHO):
You are an assistant that calls functions. If you need to use a tool, respond ONLY with valid JSON.
Never return the schema definition inside arguments; return only concrete values.

EXPECTED RESPONSE EXAMPLE:
{"tool_calls": [{"id": "call_123", "name": "os_open_app", "arguments": {"appName": "spotify", "args": ["search", "Daft Punk"]}}]}

AVAILABLE TOOLS:
${tools.map(t => `- ${t.name}: ${t.description}. Expected parameters: ${JSON.stringify(t.parameters)}`).join('\n')}
`;
            const systemIdx = localMessages.findIndex(m => m.role === 'system');
            if (systemIdx !== -1) {
                localMessages[systemIdx].content += `\n\n${toolPrompt}`;
            } else {
                localMessages.unshift({ role: 'system', content: toolPrompt });
            }
        }

        const payload: LocalLlamaRequestBody = {
            model: modelInfo,
            messages: localMessages.map(m => {
                let finalContent: string | ContentPart[] = m.content || '';

                if (m.inlineData && m.inlineData.length > 0) {
                    const parts: ContentPart[] = [
                        { type: 'text', text: m.content || '' },
                        ...m.inlineData
                            .filter(media => media.mimeType.startsWith('image/'))
                            .map(media => ({
                                type: 'image_url' as const,
                                image_url: {
                                    url: `data:${media.mimeType};base64,${media.data}`
                                }
                            }))
                    ];
                    if (m.inlineData.some(media => media.mimeType.startsWith('audio/'))) {
                        parts.push({
                            type: 'text',
                            text: '[Attached audio omitted in the local provider: use Gemini or an OpenAI-compatible multimodal provider for native audio analysis.]'
                        });
                    }
                    finalContent = parts;
                }

                return {
                    role: m.role,
                    content: finalContent,
                    ...(m.toolCallId && { tool_call_id: m.toolCallId }),
                    ...(m.toolCalls && {
                        tool_calls: m.toolCalls.map(tc => ({
                            id: tc.id,
                            type: 'function' as const,
                            function: {
                                name: tc.name,
                                arguments: JSON.stringify(tc.arguments)
                            }
                        }))
                    })
                };
            }),
            temperature: 0.1,
            keep_alive: this.keepAlive,
            format: 'json'
        };

        // Only send the "tools" field when native tool support is known to work.
        // The prompt fallback is safer for small local models.
        // payload.tools = ...

        try {
            const res = await safeFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: options?.signal,
            }, {
                serviceName: 'Local Llama provider',
                allowLoopback: true,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`LLM Error: [${res.status}] ${errText}`);
            }

            const data = await readSafeJsonResponse<LocalLlamaResponseData>(res, 'Local Llama provider');
            const choice = data.choices[0];
            const message = choice.message;

            let toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

            if (message.tool_calls) {
                for (const tc of message.tool_calls) {
                    toolCalls.push({
                        id: tc.id,
                        name: tc.function.name,
                        arguments: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
                    });
                }
            } else if (message.content && message.content.includes('tool_calls')) {
                try {
                    const cleanedContent = message.content.replace(/```json\n?|```/g, '').trim();
                    const parsed = JSON.parse(cleanedContent);
                    if (parsed.tool_calls) {
                        toolCalls = parsed.tool_calls;
                    }
                } catch (error: unknown) {// Not valid JSON or does not contain tool_calls.
      logger.warn('[Local Llama] JSON parse failed', error);
    }
            }

            return {
                content: toolCalls.length > 0 ? null : message.content,
                toolCalls,
                finishReason: choice.finish_reason || 'stop'
            };
        } catch (error: unknown) {
          const err = asErrorLike(error);
          const message = error instanceof Error ? err.message : String(error);
             throw new Error(`Failure in local llama.cpp provider (${this.baseUrl}): ${message}`);
        }
    }

    private async ensureOllamaServerAvailable(): Promise<void> {
        if (!this.autoStart || !this.isLocalOllamaUrl()) {
            return;
        }

        if (await this.isOllamaNativeApiReachable()) {
            return;
        }

        try {
            const child = spawn('ollama', ['serve'], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            });
            child.unref();
        } catch (error: unknown) {logger.warn('[Local Llama] process execution failed', error);
    return;
  }

        await this.waitForOllama();
    }

    private async waitForOllama(): Promise<void> {
        const deadline = Date.now() + Math.max(1000, this.startTimeoutMs);
        while (Date.now() < deadline) {
            if (await this.isOllamaNativeApiReachable()) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    private async isOllamaNativeApiReachable(): Promise<boolean> {
        try {
            const response = await safeFetch(`${this.getNativeOllamaBaseUrl()}/api/tags`, {
                signal: AbortSignal.timeout(1500),
            }, {
                serviceName: 'Ollama native healthcheck',
                allowLoopback: true,
            });
            return response.ok;
        } catch (error: unknown) {logger.warn('[Local Llama] network request failed', error); return false; }
    }

    private isLocalOllamaUrl(): boolean {
        try {
            const url = new URL(this.baseUrl);
            const host = url.hostname.toLowerCase();
            return host === 'localhost' || host === '127.0.0.1' || host === '::1';
        } catch (error: unknown) {logger.warn('[Local Llama] operation failed', error); return false; }
    }

    private getNativeOllamaBaseUrl(): string {
        const url = new URL(this.baseUrl);
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/+$/, '');
    }
}
