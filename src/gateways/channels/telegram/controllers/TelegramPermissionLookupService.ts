import { PermissionRequest, PermissionStatus } from '../../../../contracts/PermissionRequest.js';
import { PermissionService } from '../../../../services/PermissionService.js';

export type TelegramPermissionLookupServiceDeps = {
  permissionService: PermissionService;
};

export class TelegramPermissionLookupService {
  constructor(private readonly deps: TelegramPermissionLookupServiceDeps) {}

  public async listPermissions(
    status: PermissionStatus | 'all',
    limit: number,
  ): Promise<PermissionRequest[]> {
    return this.deps.permissionService.listRequests(status, limit);
  }

  public async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    const list = await this.deps.permissionService.listRequests('pending', 50);
    const found = list.find((permission) => permission.permission_id.startsWith(ref));
    if (found) {
      return found;
    }

    const all = await this.deps.permissionService.listRequests('all', 100);
    const fallback = all.find((permission) => permission.permission_id.startsWith(ref));
    if (!fallback) {
      throw new Error(`Permissao ${ref} nao encontrada.`);
    }

    return fallback;
  }
}
