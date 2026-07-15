import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';
import { config } from '../config/index.js';
type AiStudioBuiltinTool = 'google_search' | 'code_execution';

type JsonRecord = Record<string, unknown>;

type AiStudioToolConfig = { googleSearch: JsonRecord } | { codeExecution: JsonRecord };

type AiStudioContentPart = JsonRecord & {
  text?: unknown;
  codeExecutionResult?: {
    output?: unknown;
  };
  functionCall?: {
    name?: unknown;
    args?: unknown;
  };
};

type AiStudioContent = {
  role: string;
  parts: AiStudioContentPart[];
};

type AiStudioCandidate = {
  content: AiStudioContent | null;
  groundingMetadata: AiStudioGroundingMetadata | null;
};

type AiStudioGroundingMetadata = {
  groundingChunks: AiStudioGroundingChunk[];
};

type AiStudioGroundingChunk = {
  web: {
    title: string;
    uri: string;
  };
};

type ParsedPromptOptions = {
  prompt: string;
  model: string | null;
  tools: AiStudioBuiltinTool[];
  services: string[];
};

const SUPPORTED_BUILTIN_TOOLS: AiStudioBuiltinTool[] = ['google_search', 'code_execution'];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class AiStudioExecutor implements IExecutor {
  public readonly name = 'aistudio';

  private get apiKey(): string {
    return String(config.aiStudioApiKey || config.geminiApiKey || '').trim();
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const result: ExecutionResult = {
      execution_id: request.execution_id || uuidv4(),
      task_id: request.task_id,
      executor: this.name,
      success: false,
      started_at: startedAt,
      finished_at: '',
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    };

    const rawPrompt = request.instructions.join('\n').trim();
    if (!rawPrompt) {
      result.error_code = 'AISTUDIO_PROMPT_MISSING';
      result.error_message = 'No prompt was provided for Google AI Studio.';
      result.finished_at = new Date().toISOString();
      return result;
    }

    if (!this.apiKey) {
      result.error_code = 'AISTUDIO_AUTH_MISSING';
      result.error_message = 'Falta configurar AISTUDIO_API_KEY ou GEMINI_API_KEY para usar /aistudio neste host.';
      result.finished_at = new Date().toISOString();
      return result;
    }

    const parsed = this.parsePromptOptions(rawPrompt);
    const modelName = this.resolveModelName(parsed.model, request);
    const requestedTools = this.resolveRequestedTools(parsed, request);
    const approvedTools = this.resolveApprovedList(request, 'aistudio_allowed_tools');
    const missingTools = requestedTools.filter((tool) => !approvedTools.includes(tool));

    if (missingTools.length > 0) {
      result.error_code = 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED';
      result.error_message = `Google AI Studio needs your approval to use tool(s): ${missingTools.join(', ')}.`;
      result.metadata = {
        requested_tools: missingTools,
        requested_tools_display: missingTools.join(', '),
        suggested_scope: 'once',
        suggested_model: modelName,
      };
      result.finished_at = new Date().toISOString();
      return result;
    }

    const approvedServices: string[] = [];
    const explicitServices = this.resolveRequestedServices(parsed, request);
    if (explicitServices.length > 0) {
      result.error_code = 'AISTUDIO_EXTERNAL_SERVICE_UNSUPPORTED';
      result.error_message = `This Zavorth supports only native Gemini API tools in /aistudio. External services such as ${explicitServices.join(', ')} are not enabled here yet.`;
      result.metadata = {
        requested_services: explicitServices,
        requested_services_display: explicitServices.join(', '),
        suggested_model: modelName,
        supported_tools: SUPPORTED_BUILTIN_TOOLS,
      };
      result.finished_at = new Date().toISOString();
      return result;
    }

    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: modelName,
      tools: this.buildTools(requestedTools),
    } as unknown as Parameters<typeof client.getGenerativeModel>[0]);

    const contents: AiStudioContent[] = [
      {
        role: 'user',
        parts: [
          {
            text: this.buildRuntimePrompt(parsed.prompt, request, requestedTools, approvedServices),
          },
        ],
      },
    ];

    const responseChunks: string[] = [];
    const codeExecutionOutputs: string[] = [];
    let groundingMetadata: AiStudioGroundingMetadata | null = null;

    try {
      for (let round = 0; round < Math.max(1, config.aiStudioMaxToolRounds); round++) {
        const response = await model.generateContent({
          contents,
        } as unknown as Parameters<typeof model.generateContent>[0]);
        const candidate = this.extractFirstCandidate(response);

        if (!candidate) {
          throw new Error('Sem candidate valida na resposta do Google AI Studio.');
        }

        if (candidate.groundingMetadata !== null && candidate.groundingMetadata !== undefined) {
          groundingMetadata = candidate.groundingMetadata;
        }

        const assistantContent = candidate.content || { role: 'model', parts: [] };
        contents.push(assistantContent);

        const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

        for (const part of assistantContent.parts) {
          if (part.text) {
            responseChunks.push(String(part.text));
          }
          if (part.codeExecutionResult?.output) {
            codeExecutionOutputs.push(String(part.codeExecutionResult.output));
          }
          if (part.functionCall?.name) {
            functionCalls.push({
              name: String(part.functionCall.name),
              args: this.asRecord(part.functionCall.args),
            });
          }
        }

        if (functionCalls.length === 0) {
          result.success = true;
          break;
        }

        if (functionCalls.length > 0) {
          const requestedService = this.normalizeServiceName(functionCalls[0]?.args?.service);
          const serviceReason = String(
            functionCalls[0]?.args?.purpose ||
              functionCalls[0]?.args?.reason ||
              'External service requested by the model.',
          ).trim();
          result.error_code = 'AISTUDIO_EXTERNAL_SERVICE_UNSUPPORTED';
          result.error_message = requestedService
            ? `This Zavorth supports only native Gemini API tools in /aistudio. The model requested service ${requestedService}, which is not enabled here yet.`
            : 'This Zavorth supports only native Gemini API tools in /aistudio. The model requested an external service that is not enabled here yet.';
          result.metadata = {
            requested_services: requestedService ? [requestedService] : [],
            requested_services_display: requestedService || '',
            service_request_reason: serviceReason,
            suggested_model: modelName,
            supported_tools: SUPPORTED_BUILTIN_TOOLS,
          };
          result.finished_at = new Date().toISOString();
          return result;
        }
      }
    } catch (error: unknown) {
      const classified = this.classifyError(error);
      result.error_code = classified.code;
      result.error_message = classified.message;
      result.stderr = classified.stderr;
      result.metadata = {
        ...(result.metadata || {}),
        aistudio_model: modelName,
        aistudio_requested_tools: requestedTools,
        aistudio_failure_kind: classified.code,
      };
      result.finished_at = new Date().toISOString();
      return result;
    }

    if (!result.success) {
      result.error_code = 'AISTUDIO_NO_FINAL_RESPONSE';
      result.error_message = 'Google AI Studio did not complete a final response in this attempt.';
      result.finished_at = new Date().toISOString();
      return result;
    }

    const finalText = this.cleanFinalText(responseChunks.join('\n').trim());
    result.stdout = this.formatSuccessSummary({
      modelName,
      tools: requestedTools,
      services: approvedServices,
      text: finalText,
      codeOutputs: codeExecutionOutputs,
      groundingMetadata,
    });
    result.metadata = {
      ...(result.metadata || {}),
      aistudio_model: modelName,
      aistudio_requested_tools: requestedTools,
      aistudio_approved_services: approvedServices,
      grounding_metadata: groundingMetadata,
    };
    result.actions_executed.push(`[AIStudio] Model: ${modelName}`);
    if (requestedTools.length > 0) {
      result.actions_executed.push(`[AIStudio] Tools: ${requestedTools.join(', ')}`);
    }
    if (approvedServices.length > 0) {
      result.actions_executed.push(`[AIStudio] Servicos aprovados: ${approvedServices.join(', ')}`);
    }
    result.finished_at = new Date().toISOString();
    return result;
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  public async probeConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.apiKey) {
      return { ok: false, message: 'Falta AISTUDIO_API_KEY ou GEMINI_API_KEY.' };
    }

    try {
      const client = new GoogleGenerativeAI(this.apiKey);
      const model = client.getGenerativeModel({
        model: config.aiStudioModel,
      } as unknown as Parameters<typeof client.getGenerativeModel>[0]);
      const response = await model.generateContent('Responda apenas: OK');
      const text = this.extractResponseText(response);
      return {
        ok: /ok/i.test(text),
        message: /ok/i.test(text)
          ? 'Google AI Studio respondeu normalmente.'
          : 'Google AI Studio authenticated, but the probe response was not expected.',
      };
    } catch (error: unknown) {
      const classified = this.classifyError(error);
      return { ok: false, message: classified.message };
    }
  }

  private parsePromptOptions(rawPrompt: string): ParsedPromptOptions {
    let prompt = rawPrompt.trim();
    let model: string | null = null;
    const tools = new Set<AiStudioBuiltinTool>();
    const services = new Set<string>();

    const modelMatch = prompt.match(/(?:^|\s)model=([A-Za-z0-9._:-]+)/i);
    if (modelMatch?.[1]) {
      model = modelMatch[1].trim();
      prompt = prompt.replace(modelMatch[0], ' ').trim();
    }

    const toolsMatch = prompt.match(/(?:^|\s)tools?=([A-Za-z0-9,_-]+)/i);
    if (toolsMatch?.[1]) {
      this.parseCsvValues(toolsMatch[1]).forEach((tool) => {
        const normalized = this.normalizeBuiltinTool(tool);
        if (normalized) {
          tools.add(normalized);
        }
      });
      prompt = prompt.replace(toolsMatch[0], ' ').trim();
    }

    const servicesMatch = prompt.match(/(?:^|\s)(?:services?|connectors?)=([A-Za-z0-9,_-]+)/i);
    if (servicesMatch?.[1]) {
      this.parseCsvValues(servicesMatch[1]).forEach((service) => {
        const normalized = this.normalizeServiceName(service);
        if (normalized) {
          services.add(normalized);
        }
      });
      prompt = prompt.replace(servicesMatch[0], ' ').trim();
    }

    return {
      prompt,
      model,
      tools: Array.from(tools),
      services: Array.from(services),
    };
  }

  private resolveModelName(inlineModel: string | null, request: ExecutionRequest): string {
    return String(
      inlineModel ||
        request.metadata?.aistudio_model ||
        request.metadata?.task_metadata?.aistudio_model ||
        config.aiStudioModel ||
        config.geminiModel,
    ).trim();
  }

  private resolveRequestedTools(parsed: ParsedPromptOptions, request: ExecutionRequest): AiStudioBuiltinTool[] {
    // Explicit structured tools only (tools=… prompt tokens + metadata-approved lists).
    // Free-text prompt keywords must never inject google_search / code_execution.
    const tools = new Set<AiStudioBuiltinTool>(parsed.tools);

    for (const value of this.resolveApprovedList(request, 'aistudio_preferred_tools')) {
      const normalized = this.normalizeBuiltinTool(value);
      if (normalized) {
        tools.add(normalized);
      }
    }

    for (const value of this.resolveApprovedList(request, 'aistudio_allowed_tools')) {
      const normalized = this.normalizeBuiltinTool(value);
      if (normalized) {
        tools.add(normalized);
      }
    }

    return Array.from(tools);
  }

  private resolveRequestedServices(parsed: ParsedPromptOptions, request: ExecutionRequest): string[] {
    const explicit = new Set<string>(parsed.services);
    const metadataServices = this.resolveApprovedList(request, 'aistudio_requested_services');
    for (const service of metadataServices) {
      const normalized = this.normalizeServiceName(service);
      if (normalized) {
        explicit.add(normalized);
      }
    }
    return Array.from(explicit);
  }

  private resolveApprovedList(request: ExecutionRequest, key: string): string[] {
    const fromMetadata = [
      ...(Array.isArray(request.metadata?.[key]) ? request.metadata[key] : []),
      ...(Array.isArray(request.metadata?.task_metadata?.[key]) ? request.metadata.task_metadata[key] : []),
    ];

    return Array.from(
      new Set(
        fromMetadata
          .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => String(value).trim().toLowerCase()),
      ),
    );
  }

  private buildTools(requestedTools: AiStudioBuiltinTool[]): AiStudioToolConfig[] {
    const tools: AiStudioToolConfig[] = [];

    if (requestedTools.includes('google_search')) {
      tools.push({
        googleSearch: {},
      });
    }

    if (requestedTools.includes('code_execution')) {
      tools.push({
        codeExecution: {},
      });
    }

    return tools;
  }

  private buildRuntimePrompt(
    prompt: string,
    request: ExecutionRequest,
    tools: AiStudioBuiltinTool[],
    approvedServices: string[],
  ): string {
    const forceFinalPlainResponse = Boolean(
      request.metadata?.aistudio_force_final_plain_response ||
        request.metadata?.task_metadata?.aistudio_force_final_plain_response,
    );
    const lines = [
      'You are Zavorth Google AI Studio executor.',
      'Responda de forma util, clara e objetiva.',
      'Do not claim you used search, code execution, or external services without tool results in the conversation.',
      'Este host suporta apenas as tools nativas google_search e code_execution.',
      'Do not try to use external services such as Drive, BigQuery, Maps, or proprietary connectors.',
      `Workspace de referencia: ${request.workspace || config.defaultWorkspace}`,
    ];

    if (tools.length > 0) {
      lines.push(`Tools allowed for this task: ${tools.join(', ')}.`);
    }

    if (approvedServices.length > 0) {
      lines.push(`Servicos ja aprovados pelo operador: ${approvedServices.join(', ')}.`);
    }

    if (forceFinalPlainResponse) {
      lines.push(
        'Esta e uma tentativa de recuperacao. Feche a resposta em texto puro, em uma unica resposta final, sem deixar tool call aberta e sem pedir servicos externos.',
      );
    }

    lines.push('', 'User request:', prompt);
    return lines.join('\n');
  }

  private normalizeBuiltinTool(value: string): AiStudioBuiltinTool | null {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    switch (normalized) {
      case 'search':
      case 'google-search':
      case 'google_search':
      case 'web':
      case 'grounding':
        return 'google_search';
      case 'code':
      case 'python':
      case 'code_execution':
      case 'code-execution':
        return 'code_execution';
      default:
        return null;
    }
  }

  private normalizeServiceName(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private parseCsvValues(value: string): string[] {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private cleanFinalText(value: string): string {
    return String(value || '')
      .replace(/\n{3}/g, '\n\n')
      .trim();
  }

  private formatSuccessSummary(input: {
    modelName: string;
    tools: AiStudioBuiltinTool[];
    services: string[];
    text: string;
    codeOutputs: string[];
    groundingMetadata: AiStudioGroundingMetadata | null;
  }): string {
    const lines = ['Google AI Studio completed the task.', `Model: ${input.modelName}`];

    if (input.tools.length > 0) {
      lines.push(`Tools usadas: ${input.tools.join(', ')}`);
    }

    if (input.services.length > 0) {
      lines.push(`Servicos aprovados: ${input.services.join(', ')}`);
    }

    lines.push('', 'Resultado:', input.text || 'Sem texto final.');

    if (input.codeOutputs.length > 0) {
      lines.push('', 'Saida de code execution:', input.codeOutputs.join('\n\n'));
    }

    const sources = this.extractGroundingSources(input.groundingMetadata);
    if (sources.length > 0) {
      lines.push('', 'Fontes usadas:');
      for (const source of sources) {
        lines.push(`- ${source}`);
      }
    }

    return lines.join('\n');
  }

  private extractGroundingSources(groundingMetadata: AiStudioGroundingMetadata | null): string[] {
    const metadata = this.asRecord(groundingMetadata);
    const chunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];

    return Array.from(
      new Set(
        chunks
          .map((chunk: unknown) => {
            const chunkRecord = this.asRecord(chunk);
            const web = this.asRecord(chunkRecord.web);
            const title = String(web.title || '').trim();
            const uri = String(web.uri || '').trim();
            if (title && uri) {
              return `${title} - ${uri}`;
            }
            return uri || title;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    ).slice(0, 5);
  }

  private extractResponseText(rawResponse: unknown): string {
    const response = this.asRecord(rawResponse);
    const responseBody = this.asRecord(response.response);
    const textReader = responseBody.text;
    if (typeof textReader === 'function') {
      return this.stringFromUnknown(textReader.call(responseBody));
    }

    const candidate = this.extractFirstCandidate(rawResponse);
    return (
      candidate?.content?.parts
        .map((part) => this.stringFromUnknown(part.text))
        .filter(Boolean)
        .join('\n')
        .trim() || ''
    );
  }

  private classifyError(error: unknown): { code: string; message: string; stderr: string | null } {
    const rawMessage = this.getErrorMessage(error);
    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('api key') && normalized.includes('invalid')) {
      return {
        code: 'AISTUDIO_AUTH_FAILED',
        message: 'O Google AI Studio rejeitou a autenticacao. Verifique AISTUDIO_API_KEY ou GEMINI_API_KEY.',
        stderr: rawMessage || null,
      };
    }

    if (normalized.includes('quota') || normalized.includes('429')) {
      return {
        code: 'AISTUDIO_RATE_LIMITED',
        message: 'O Google AI Studio recusou a chamada por limite de taxa ou quota.',
        stderr: rawMessage || null,
      };
    }

    if (normalized.includes('blocked') || normalized.includes('safety')) {
      return {
        code: 'AISTUDIO_SAFETY_BLOCK',
        message: 'The Google AI Studio response was blocked by the model safety policies.',
        stderr: rawMessage || null,
      };
    }

    if (normalized.includes('google_search_retrieval is not supported')) {
      return {
        code: 'AISTUDIO_TOOL_CONFIG_ERROR',
        message:
          'O Google AI Studio falhou por uma configuracao invalida de busca web. O Zavorth ja deve tentar usar a tool correta em novas chamadas.',
        stderr: rawMessage || null,
      };
    }

    return {
      code: 'AISTUDIO_ERROR',
      message: rawMessage || 'O Google AI Studio falhou durante a execucao.',
      stderr: rawMessage || null,
    };
  }

  private extractFirstCandidate(rawResponse: unknown): AiStudioCandidate | null {
    const response = this.asRecord(rawResponse);
    const responseBody = this.asRecord(response.response);
    const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
    const candidate = candidates[0];
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const candidateRecord = this.asRecord(candidate);
    return {
      content: this.normalizeContent(candidateRecord.content),
      groundingMetadata: this.normalizeGroundingMetadata(candidateRecord.groundingMetadata),
    };
  }

  private normalizeGroundingMetadata(rawMetadata: unknown): AiStudioGroundingMetadata | null {
    const metadata = this.asRecord(rawMetadata);
    if (Object.keys(metadata).length === 0) {
      return null;
    }

    const rawChunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];
    const groundingChunks = rawChunks
      .map((chunk) => this.normalizeGroundingChunk(chunk))
      .filter((chunk): chunk is AiStudioGroundingChunk => chunk !== null);

    return { groundingChunks };
  }

  private normalizeGroundingChunk(rawChunk: unknown): AiStudioGroundingChunk | null {
    const chunk = this.asRecord(rawChunk);
    const web = this.asRecord(chunk.web);
    const title = this.stringFromUnknown(web.title).trim();
    const uri = this.stringFromUnknown(web.uri).trim();

    if (!title && !uri) {
      return null;
    }

    return {
      web: {
        title,
        uri,
      },
    };
  }

  private normalizeContent(rawContent: unknown): AiStudioContent | null {
    const content = this.asRecord(rawContent);
    if (Object.keys(content).length === 0) {
      return null;
    }

    const parts = Array.isArray(content.parts)
      ? content.parts
          .map((part) => this.normalizePart(part))
          .filter((part): part is AiStudioContentPart => part !== null)
      : [];

    return {
      role: String(content.role || 'model'),
      parts,
    };
  }

  private normalizePart(rawPart: unknown): AiStudioContentPart | null {
    const part = this.asRecord(rawPart);
    if (Object.keys(part).length === 0) {
      return null;
    }

    const normalized: AiStudioContentPart = {};
    if (part.text !== undefined) {
      normalized.text = part.text;
    }

    const codeExecutionResult = this.asRecord(part.codeExecutionResult);
    if (codeExecutionResult.output !== undefined) {
      normalized.codeExecutionResult = {
        output: codeExecutionResult.output,
      };
    }

    const functionCall = this.asRecord(part.functionCall);
    if (functionCall.name !== undefined) {
      normalized.functionCall = {
        name: functionCall.name,
        args: this.asRecord(functionCall.args),
      };
    }

    return normalized;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
  }

  private stringFromUnknown(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }

    return '';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message.trim();
    }
    const record = this.asRecord(error);
    if (typeof record.message === 'string') {
      return record.message.trim();
    }
    return String(error || '').trim();
  }
}
