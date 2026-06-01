import { spawn } from 'child_process';
import { ChatMessage, ILlmProvider, LlmResponse, ProviderChatOptions, ToolDefinition } from './ILlmProvider';
import { safeFetch } from '../security/SafeFetchService.js';

export interface LocalLlamaProviderOptions {
    baseUrl?: string; // e.g. http://localhost:11434/v1 for Ollama, http://localhost:8080/v1 for llama.cpp server
    modelName?: string;
    keepAlive?: string;
    autoStart?: boolean;
    startTimeoutMs?: number;
}

export class LocalLlamaProvider implements ILlmProvider {
    public readonly name = 'local-llama-cpp';
    private baseUrl: string;
    private defaultModel: string;
    private keepAlive: string;
    private autoStart: boolean;
    private startTimeoutMs: number;

    constructor(options?: LocalLlamaProviderOptions) {
        // Usa por padrao o Ollama local que serve a API da OpenAI. 
        // Se usar LM Studio ou llama-server, basta alterar o port para 1234 ou 8080.
        this.baseUrl = options?.baseUrl || 'http://localhost:11434/v1';
        this.defaultModel = options?.modelName || 'gemma2:2b';
        this.keepAlive = options?.keepAlive || process.env.OLLAMA_KEEP_ALIVE || '30s';
        this.autoStart = options?.autoStart ?? (String(process.env.OLLAMA_AUTO_START || 'true').toLowerCase() !== 'false');
        this.startTimeoutMs = options?.startTimeoutMs || Number.parseInt(process.env.OLLAMA_START_TIMEOUT_MS || '15000', 10);
    }

    public async chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse> {
        await this.ensureOllamaServerAvailable();
        const url = `${this.baseUrl}/chat/completions`;
        const modelInfo = options?.modelName || this.defaultModel;

        // Estratégia de fallback: Se o modelo não suporta ferramentas nativas via API (como o gemma2:2b no Ollama)
        // injetamos a definição das ferramentas diretamente no System Prompt para que ele responda em JSON.
        let localMessages = [...messages];
        if (tools && tools.length > 0) {
            const toolPrompt = `
SISTEMA DE FERRAMENTAS (ECHO):
Você é um assistente que chama funções. Se precisar usar uma ferramenta, responda APENAS um JSON válido.
Nunca retorne a definição do esquema nos argumentos, apenas os VALORES.

EXEMPLO DE RESPOSTA ESPERADA:
{"tool_calls": [{"id": "call_123", "name": "os_open_app", "arguments": {"appName": "spotify", "args": ["search", "Daft Punk"]}}]}

FERRAMENTAS DISPONÍVEIS:
${tools.map(t => `- ${t.name}: ${t.description}. Parâmetros esperados: ${JSON.stringify(t.parameters)}`).join('\n')}
`;
            // Encontra o system prompt ou cria um
            const systemIdx = localMessages.findIndex(m => m.role === 'system');
            if (systemIdx !== -1) {
                localMessages[systemIdx].content += `\n\n${toolPrompt}`;
            } else {
                localMessages.unshift({ role: 'system', content: toolPrompt });
            }
        }

        const payload: any = {
            model: modelInfo,
            messages: localMessages.map(m => {
                let finalContent: any = m.content || '';
                
                if (m.inlineData && m.inlineData.length > 0) {
                    finalContent = [
                        { type: 'text', text: m.content || '' },
                        ...m.inlineData
                            .filter(media => media.mimeType.startsWith('image/'))
                            .map(media => ({
                                type: 'image_url',
                                image_url: {
                                    url: `data:${media.mimeType};base64,${media.data}`
                                }
                            }))
                    ];
                    if (m.inlineData.some(media => media.mimeType.startsWith('audio/'))) {
                        finalContent.push({
                            type: 'text',
                            text: '[Audio anexado omitido no provider local: use Gemini/OpenAI-compatible multimodal para analise nativa de audio.]'
                        });
                    }
                }

                return {
                    role: m.role,
                    content: finalContent,
                    ...(m.toolCallId && { tool_call_id: m.toolCallId }),
                    ...(m.toolCalls && { tool_calls: m.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments)
                        }
                    }))})
                };
            }),
            temperature: 0.1,
            keep_alive: this.keepAlive,
            format: 'json' // Força o modelo a responder em JSON para facilitar o parse das tool calls
        };

        // Somente enviamos o campo "tools" se soubermos que o modelo suporta (fallback via prompt é mais seguro para modelos 2B)
        // Mas para manter a compatibilidade com modelos que suportam (como llama3.1), podemos tentar.
        // Se falhar (400), o código abaixo já lida com o erro ou podemos remover esta parte:
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

            const data = await res.json();
            const choice = data.choices[0];
            const message = choice.message;

            let toolCalls = [];
            
            // 1. Tenta pegar tool_calls nativas
            if (message.tool_calls) {
                for (const tc of message.tool_calls) {
                    toolCalls.push({
                        id: tc.id,
                        name: tc.function.name,
                        arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
                    });
                }
            } 
            // 2. Tenta fazer o parse manual do conteúdo se for um JSON (estratégia de fallback)
            else if (message.content && message.content.includes('tool_calls')) {
                try {
                    // Limpa blocos de código markdown se existirem
                    let cleanedContent = message.content.replace(/```json\n?|```/g, '').trim();
                    const parsed = JSON.parse(cleanedContent);
                    if (parsed.tool_calls) {
                        toolCalls = parsed.tool_calls;
                    }
                } catch (e) {
                    // Não é um JSON válido ou não contém tool_calls
                }
            }

            return {
                content: toolCalls.length > 0 ? null : message.content,
                toolCalls,
                finishReason: choice.finish_reason || 'stop'
            };
        } catch (error: any) {
             throw new Error(`Falha no provedor llama.cpp local (${this.baseUrl}): ${error.message}`);
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
        } catch {
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
        } catch {
            return false;
        }
    }

    private isLocalOllamaUrl(): boolean {
        try {
            const url = new URL(this.baseUrl);
            const host = url.hostname.toLowerCase();
            return host === 'localhost' || host === '127.0.0.1' || host === '::1';
        } catch {
            return false;
        }
    }

    private getNativeOllamaBaseUrl(): string {
        const url = new URL(this.baseUrl);
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/+$/, '');
    }
}
