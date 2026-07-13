import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';

export interface PermissionRequest {
  id: string;
  action: string;
  resource?: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * ZavorthProactivePermissionService
 * Gerencia o fluxo de pedidos de permiss??o proativos em linguagem natural.
 */
export class ZavorthProactivePermissionService {
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private readonly filePath: string | null;

  constructor(options: { filePath?: string | null } = {}) {
    this.filePath = options.filePath ? path.resolve(options.filePath) : null;
    this.loadFromDisk();
  }

  /**
   * Cria uma nova solicitacao de permissao
   */
  public async request(input: {
    action: string;
    resource?: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<PermissionRequest> {
    const id = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const request: PermissionRequest = {
      id,
      action: input.action,
      resource: input.resource,
      reason: input.reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    };

    this.pendingRequests.set(id, request);
    this.persist();
    
    // In a real scenario, this would trigger a notification via WebSocket to the UI
    // or a message in the current chat channel (Telegram/WhatsApp).
    logger.info(`[PermissionService] Nova solicitacao: ${request.reason}`);
    
    return request;
  }

  /**
   * Verifica se uma permissao especifica foi concedida
   */
  public check(id: string): PermissionRequest | undefined {
    const request = this.pendingRequests.get(id);
    return request ? this.clone(request) : undefined;
  }

  /**
   * Resolve uma solicitacao (Aprova/Nega)
   */
  public resolve(id: string, approved: boolean): boolean {
    const request = this.pendingRequests.get(id);
    if (!request) return false;

    request.status = approved ? 'approved' : 'denied';
    this.persist();
    return true;
  }

  /**
   * Retorna todas as solicitacoes pendentes
   */
  public listPending(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values())
      .filter(r => r.status === 'pending')
      .map((request) => this.clone(request));
  }

  /**
   * Gera a mensagem amigavel para o usuario
   */
  public formatRequestMessage(request: PermissionRequest): string {
    const resourcePart = request.resource ? ` ao recurso "${request.resource}"` : '';
    return `?? **Pedido de Permiss??o**: Preciso de acesso para "${request.action}"${resourcePart}.\n\n` +
           `**Motivo**: ${request.reason}\n\n` +
           `Voc?? autoriza esta opera????o? (Acesse o painel ou responda aqui)`;
  }

  private clone(request: PermissionRequest): PermissionRequest {
    return {
      ...request,
      metadata: request.metadata ? JSON.parse(JSON.stringify(request.metadata)) : undefined,
    };
  }

  private loadFromDisk(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const requests = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.requests) ? parsed.requests : [];
      for (const request of requests) {
        if (!request || typeof request !== 'object') {
          continue;
        }
        const normalized = this.clone(request as PermissionRequest);
        if (normalized.id) {
          this.pendingRequests.set(normalized.id, normalized);
        }
      }
    } catch (error: unknown) {this.pendingRequests.clear();
    }
  }

  private persist(): void {
    if (!this.filePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({ requests: Array.from(this.pendingRequests.values()).map((entry) => this.clone(entry)) }, null, 2),
        'utf8',
      );
    } catch (error: unknown) {// Permission durability is best-effort; the active process keeps the in-memory source of truth.
      logger.warn('[Zavorth Proactive Permission] filesystem operation failed', error);
    }
  }
}
