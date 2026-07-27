import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike';
export interface WorkspaceWriteApprovalPayload {
  file: string;
  content?: string;
}

export class WorkspaceWriteApprovalPayloadCache {
  private static instance: WorkspaceWriteApprovalPayloadCache | null = null;
  private readonly cache = new Map<string, WorkspaceWriteApprovalPayload>();

  private constructor() {}

  public static getInstance(): WorkspaceWriteApprovalPayloadCache {
    if (!WorkspaceWriteApprovalPayloadCache.instance) {
      WorkspaceWriteApprovalPayloadCache.instance = new WorkspaceWriteApprovalPayloadCache();
    }
    return WorkspaceWriteApprovalPayloadCache.instance;
  }

  public cachePayload(operationId: string, payload: WorkspaceWriteApprovalPayload): void {
    // Evict any existing cache entries for the same file path to support replaced/cancelled operations
    for (const [id, entry] of this.cache.entries()) {
      if (entry.file === payload.file) {
        this.cache.delete(id);
      }
    }
    this.cache.set(operationId, payload);
  }

  public getPayload(operationId: string): WorkspaceWriteApprovalPayload | undefined {
    return this.cache.get(operationId);
  }

  public clearPayload(operationId: string): void {
    this.cache.delete(operationId);
  }

  public async clearExpired(db: any): Promise<void> {
    const now = new Date().toISOString();
    try {
      const activeRows = db.all(
        'SELECT operation_id FROM workspace_write_approvals WHERE expires_at > ...',
        [now]
      );
      const activeIds = new Set(activeRows.map((r: any) => r.operation_id));
      for (const id of this.cache.keys()) {
        if (!activeIds.has(id)) {
          this.cache.delete(id);
        }
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error('Error clearing expired cache payloads:', err);
    }
  }

  // Helper to clear the entire cache (useful for workspace close or testing)
  public clearAll(): void {
    this.cache.clear();
  }
}
