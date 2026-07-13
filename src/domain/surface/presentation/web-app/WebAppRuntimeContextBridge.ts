import * as http from 'http';
import { CanonicalPublicApiService } from '../../../../api/public/CanonicalPublicApiService.js';
import { ZavorthLayeredMemoryService } from '../../../../services/ZavorthLayeredMemoryService.js';
import { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService.js';
import { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import { HybridMemoryService } from '../../../../services/HybridMemoryService.js';
import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { WebAppRealtimeTransportService } from './WebAppRealtimeTransportService.js';
import type { WebRealtimeService } from '../../../../services/WebRealtimeService.js';
import type { GatewaySessionToolsService } from '../../../../runtime/sessions/GatewaySessionToolsService.js';

interface GatewaySessionStore {
  resolveTarget(params: {
    userId: string | null;
    platform: string;
    chatId: string | null;
    sourceUserId: string | null;
  }): { sessionId?: string | null } | null;
}

interface RuntimeTaskManager {
  getTask(taskId: string): { chat_id?: string; chatId?: string } | null | undefined;
}

interface WebAppRuntime {
  webUserId: string;
  taskManager: RuntimeTaskManager;
}

interface TaskWithChatId {
  chat_id?: string;
}

interface RuntimeServices {
  gatewaySessionTools?: GatewaySessionToolsService | null;
  gatewaySessionStore?: GatewaySessionStore | null;
  sessionPlane?: ZavorthSessionPlaneService | null;
  memoryPlane?: ZavorthMemoryPlaneService | null;
  layeredMemory?: ZavorthLayeredMemoryService | null;
  learningPlane?: ZavorthLearningPlaneService | null;
}

interface Operations {
  sessionPlane?: ZavorthSessionPlaneService | null;
  memoryPlane?: ZavorthMemoryPlaneService | null;
  layeredMemory?: ZavorthLayeredMemoryService | null;
  learningPlane?: ZavorthLearningPlaneService | null;
}

type WebAppRuntimeContextBridgeOptions = {
  operations: Operations;
  runtimeServices: RuntimeServices;
  getRuntime: () => WebAppRuntime | null;
  getRealtime: () => WebRealtimeService | null;
  publicApi: CanonicalPublicApiService;
  realtimeTransport: WebAppRealtimeTransportService;
};

export class WebAppRuntimeContextBridge {
  constructor(private readonly options: WebAppRuntimeContextBridgeOptions) {}

  public getGatewaySessionTools(): GatewaySessionToolsService {
    if (!this.options.runtimeServices.gatewaySessionTools) {
      throw new Error('Gateway session tools unavailable para o web runtime.');
    }
    return this.options.runtimeServices.gatewaySessionTools;
  }

  public async buildMemoryPlaneSnapshot(
    sessionId: string,
  ): Promise<Awaited<ReturnType<ZavorthMemoryPlaneService['buildSnapshot']>> | null> {
    const service = this.getMemoryPlaneService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return null;
    }

    return service.buildSnapshot({
      userId: runtime.webUserId,
      platform: 'web',
      sessionId,
      chatId: realtime.getChatId(sessionId),
      sourceUserId: sessionId,
    });
  }

  public async buildLayeredMemoryStatus(
    sessionId: string,
  ): Promise<Awaited<ReturnType<ZavorthLayeredMemoryService['buildStatus']>> | null> {
    const service = this.getLayeredMemoryService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return null;
    }

    return service.buildStatus({
      userId: runtime.webUserId,
      platform: 'web',
      sessionId,
      chatId: realtime.getChatId(sessionId),
      workspaceHint: null,
    });
  }

  public async buildLearningPlaneStatus(
    _sessionId: string,
  ): Promise<ReturnType<ZavorthLearningPlaneService['buildSnapshot']> | null> {
    const service = this.getLearningPlaneService();
    if (!service) {
      return null;
    }

    return service.buildSnapshot();
  }

  public async buildLearningPlaneSnapshot(
    sessionId: string,
  ): Promise<ReturnType<ZavorthLearningPlaneService['buildSnapshot']> | null> {
    return this.buildLearningPlaneStatus(sessionId);
  }

  public async buildLearningPlaneMetrics(
    _sessionId: string,
  ): Promise<ReturnType<ZavorthLearningPlaneService['readMetrics']> | null> {
    const service = this.getLearningPlaneService();
    if (!service) {
      return null;
    }

    return service.readMetrics();
  }

  public async executeLearningPlaneAction(input: {
    candidateId: string;
    actionId: 'approve' | 'reject' | 'promote' | 'forget' | 'promoteProcedure' | 'promoteSkill';
    approvalId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<Awaited<ReturnType<ZavorthLearningPlaneService['executeAction']>> | null> {
    const service = this.getLearningPlaneService();
    if (!service) {
      return null;
    }
    return service.executeAction({
      ...input,
      requestedBy: input.requestedBy || 'web:learning-dreams',
      sourceSurface: input.sourceSurface || 'web:learning-dreams',
    });
  }

  public async searchLayeredMemory(input: {
    sessionId: string;
    query: string;
    limit?: number;
  }): Promise<Awaited<ReturnType<ZavorthLayeredMemoryService['search']>> | null> {
    const service = this.getLayeredMemoryService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return null;
    }

    return service.search({
      userId: runtime.webUserId,
      platform: 'web',
      sessionId: input.sessionId,
      chatId: realtime.getChatId(input.sessionId),
      workspaceHint: null,
      query: input.query,
      limit: input.limit,
    });
  }

  public async readLayeredMemoryProcedures(
    _sessionId: string,
  ): Promise<Awaited<ReturnType<ZavorthLayeredMemoryService['readProcedures']>> | null> {
    const service = this.getLayeredMemoryService();
    if (!service) {
      return null;
    }

    return service.readProcedures({
      workspaceHint: null,
    });
  }

  public async readLayeredMemoryMetrics(
    sessionId: string,
  ): Promise<Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>> | null> {
    const service = this.getLayeredMemoryService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return null;
    }

    return service.readMetrics({
      userId: runtime.webUserId,
      platform: 'web',
      sessionId,
      chatId: realtime.getChatId(sessionId),
      workspaceHint: null,
    });
  }

  public async previewHybridMemoryRecall(input: {
    sessionId: string;
    query?: string | null;
    limit?: number | null;
    contextTokenBudget?: number | null;
    userId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sourceUserId?: string | null;
    workspaceHint?: string | null;
  }): Promise<Awaited<ReturnType<HybridMemoryService['previewRecall']>>> {
    const service = this.buildHybridMemoryService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return new HybridMemoryService({
        createVectorStore: null,
      }).previewRecall({
        sessionId: input.sessionId,
        query: input.query,
        limit: input.limit,
        contextTokenBudget: input.contextTokenBudget,
      });
    }
    const sessionId = String(input.sessionId || '').trim();
    return service.previewRecall({
      userId: input.userId || runtime.webUserId,
      platform: input.platform || 'web',
      sessionId,
      chatId: input.chatId || realtime.getChatId(sessionId),
      sourceUserId: input.sourceUserId || sessionId,
      workspaceHint: input.workspaceHint || null,
      query: input.query,
      limit: input.limit,
      contextTokenBudget: input.contextTokenBudget,
    });
  }

  public async listHybridMemorySources(input: {
    sessionId: string;
    userId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    workspaceHint?: string | null;
  }): Promise<Awaited<ReturnType<HybridMemoryService['listSources']>>> {
    const service = this.buildHybridMemoryService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return new HybridMemoryService({
        createVectorStore: null,
      }).listSources({
        sessionId: input.sessionId,
      });
    }
    const sessionId = String(input.sessionId || '').trim();
    return service.listSources({
      userId: input.userId || runtime.webUserId,
      platform: input.platform || 'web',
      sessionId,
      chatId: input.chatId || realtime.getChatId(sessionId),
      workspaceHint: input.workspaceHint || null,
    });
  }

  public async buildOpsQuality(
    sessionId: string,
  ): Promise<Awaited<ReturnType<CanonicalPublicApiService['readOpsQuality']>>> {
    const runtime = this.options.getRuntime();
    const chatId = this.options.getRealtime()?.getChatId(sessionId) || null;
    return this.options.publicApi.readOpsQuality({
      mode: 'fast',
      userId: runtime?.webUserId || null,
      sessionId,
      chatId,
      workspaceHint: null,
    });
  }

  public async buildSessionPlaneSnapshot(
    sessionId: string,
  ): Promise<Awaited<ReturnType<ZavorthSessionPlaneService['buildSnapshot']>> | null> {
    const service = this.getSessionPlaneService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return null;
    }

    return service.buildSnapshot({
      userId: runtime.webUserId,
      platform: 'web',
      sessionId,
      chatId: realtime.getChatId(sessionId),
      sourceUserId: sessionId,
    });
  }

  public async buildSessionPlaneStatusSummary(
    sessionId: string,
  ): Promise<Awaited<ReturnType<ZavorthSessionPlaneService['buildStatusSummary']>> | null> {
    const service = this.getSessionPlaneService();
    const runtime = this.options.getRuntime();
    const realtime = this.options.getRealtime();
    if (!service || !runtime || !realtime) {
      return null;
    }

    return service.buildStatusSummaryFast({
      userId: runtime.webUserId,
      platform: 'web',
      sessionId,
      chatId: realtime.getChatId(sessionId),
      sourceUserId: sessionId,
    });
  }

  public resolveSessionId(url: URL): string {
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    if (!sessionId) {
      throw new Error('sessionId obrigatorio.');
    }
    return sessionId;
  }

  public async resolveSessionIdFromPermission(
    permission: PermissionRequest,
    requestedSessionId: string,
  ): Promise<string> {
    const normalized = String(requestedSessionId || '').trim();
    if (normalized) {
      return normalized;
    }

    const taskId = String(permission.task_id || '').trim();
    if (!taskId) {
      throw new Error('Permissao sem task associada.');
    }

    const runtime = this.options.getRuntime();
    const task = runtime!.taskManager.getTask(taskId);
    return this.resolveSessionIdFromChatId(String(task?.chat_id || '').trim());
  }

  public resolveSessionIdFromTask(task: TaskWithChatId, requestedSessionId: string): string {
    const normalized = String(requestedSessionId || '').trim();
    if (normalized) {
      return normalized;
    }

    return this.resolveSessionIdFromChatId(String(task?.chat_id || '').trim());
  }

  public openEventStream(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sessionId: string,
  ): void {
    this.options.realtimeTransport.openEventStream(
      req,
      res,
      this.options.getRealtime()!,
      sessionId,
    );
  }

  public async readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }

    if (!body.trim()) {
      return {};
    }

    return JSON.parse(body);
  }

  public writeJson(res: http.ServerResponse, body: unknown, statusCode: number = 200): void {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
    });
    res.end(payload);
  }

  private getSessionPlaneService(): ZavorthSessionPlaneService | null {
    return this.options.runtimeServices.sessionPlane || this.options.operations.sessionPlane || null;
  }

  private getMemoryPlaneService(): ZavorthMemoryPlaneService | null {
    return this.options.operations.memoryPlane || this.options.runtimeServices.memoryPlane || null;
  }

  private getLayeredMemoryService(): ZavorthLayeredMemoryService | null {
    return this.options.operations.layeredMemory || this.options.runtimeServices.layeredMemory || null;
  }

  private getLearningPlaneService(): ZavorthLearningPlaneService | null {
    return this.options.operations.learningPlane || this.options.runtimeServices.learningPlane || null;
  }

  private buildHybridMemoryService(): HybridMemoryService | null {
    const layeredMemory = this.getLayeredMemoryService();
    const memoryPlane = this.getMemoryPlaneService();
    if (!layeredMemory && !memoryPlane) {
      return null;
    }
    return new HybridMemoryService({
      layeredMemory,
      memoryPlane,
    });
  }

  private resolveSessionIdFromChatId(chatId: string): string {
    const normalizedChatId = String(chatId || '').trim();
    const runtime = this.options.getRuntime();
    const target = this.options.runtimeServices.gatewaySessionStore?.resolveTarget({
      userId: runtime?.webUserId || null,
      platform: 'web',
      chatId: normalizedChatId || null,
      sourceUserId: normalizedChatId.startsWith('web:') ? normalizedChatId.slice(4) : null,
    });
    if (target?.sessionId) {
      return target.sessionId;
    }
    if (normalizedChatId.startsWith('web:')) {
      return normalizedChatId.slice(4);
    }
    throw new Error('A referencia informada nao pertence a uma sessao web.');
  }
}

