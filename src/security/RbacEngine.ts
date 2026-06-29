import fs from 'fs';
import path from 'path';

export interface Role {
  id: string;
  name: string;
  description: string;
  parentRoleId?: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  assignedAt: string;
  expiresAt?: string;
}

export interface AccessCheckRequest {
  userId: string;
  resource: string;
  action: string;
  context?: Record<string, unknown>;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  roles: string[];
  permissions: string[];
  deniedBy?: string;
}

export interface RbacStore {
  roles: Map<string, Role>;
  permissions: Map<string, Permission>;
  userRoles: Map<string, UserRoleAssignment[]>;
}

export class RbacEngine {
  private store: RbacStore;

  constructor() {
    this.store = {
      roles: new Map(),
      permissions: new Map(),
      userRoles: new Map(),
    };
  }

  public createRole(role: Role): void {
    if (this.store.roles.has(role.id)) {
      throw new Error(`Role with id '${role.id}' already exists`);
    }
    if (role.parentRoleId && !this.store.roles.has(role.parentRoleId)) {
      throw new Error(`Parent role '${role.parentRoleId}' does not exist`);
    }
    this.store.roles.set(role.id, { ...role, permissions: [...role.permissions] });
  }

  public getRole(id: string): Role | undefined {
    const role = this.store.roles.get(id);
    return role ? { ...role, permissions: [...role.permissions] } : undefined;
  }

  public updateRole(id: string, updates: Partial<Omit<Role, 'id'>>): void {
    const existing = this.store.roles.get(id);
    if (!existing) {
      throw new Error(`Role with id '${id}' not found`);
    }
    if (updates.parentRoleId && updates.parentRoleId === id) {
      throw new Error('Role cannot be its own parent');
    }
    if (updates.parentRoleId && !this.store.roles.has(updates.parentRoleId)) {
      throw new Error(`Parent role '${updates.parentRoleId}' does not exist`);
    }
    this.store.roles.set(id, { ...existing, ...updates });
  }

  public deleteRole(id: string): void {
    if (!this.store.roles.has(id)) {
      throw new Error(`Role with id '${id}' not found`);
    }
    for (const [userId, assignments] of this.store.userRoles.entries()) {
      const filtered = assignments.filter((a) => a.roleId !== id);
      if (filtered.length === 0) {
        this.store.userRoles.delete(userId);
      } else {
        this.store.userRoles.set(userId, filtered);
      }
    }
    for (const [, role] of this.store.roles) {
      if (role.parentRoleId === id) {
        role.parentRoleId = undefined;
      }
    }
    this.store.roles.delete(id);
  }

  public listRoles(): Role[] {
    return Array.from(this.store.roles.values()).map((r) => ({
      ...r,
      permissions: [...r.permissions],
    }));
  }

  public createPermission(permission: Permission): void {
    if (this.store.permissions.has(permission.id)) {
      throw new Error(`Permission with id '${permission.id}' already exists`);
    }
    this.store.permissions.set(permission.id, { ...permission });
  }

  public getPermission(id: string): Permission | undefined {
    const perm = this.store.permissions.get(id);
    return perm ? { ...perm } : undefined;
  }

  public updatePermission(id: string, updates: Partial<Omit<Permission, 'id'>>): void {
    const existing = this.store.permissions.get(id);
    if (!existing) {
      throw new Error(`Permission with id '${id}' not found`);
    }
    this.store.permissions.set(id, { ...existing, ...updates });
  }

  public deletePermission(id: string): void {
    if (!this.store.permissions.has(id)) {
      throw new Error(`Permission with id '${id}' not found`);
    }
    for (const [, role] of this.store.roles) {
      role.permissions = role.permissions.filter((p) => p !== id);
    }
    this.store.permissions.delete(id);
  }

  public listPermissions(): Permission[] {
    return Array.from(this.store.permissions.values()).map((p) => ({ ...p }));
  }

  public assignPermissionToRole(roleId: string, permissionId: string): void {
    const role = this.store.roles.get(roleId);
    if (!role) {
      throw new Error(`Role with id '${roleId}' not found`);
    }
    if (!this.store.permissions.has(permissionId)) {
      throw new Error(`Permission with id '${permissionId}' not found`);
    }
    if (!role.permissions.includes(permissionId)) {
      role.permissions.push(permissionId);
    }
  }

  public removePermissionFromRole(roleId: string, permissionId: string): void {
    const role = this.store.roles.get(roleId);
    if (!role) {
      throw new Error(`Role with id '${roleId}' not found`);
    }
    role.permissions = role.permissions.filter((p) => p !== permissionId);
  }

  public assignRoleToUser(userId: string, roleId: string): void {
    if (!this.store.roles.has(roleId)) {
      throw new Error(`Role with id '${roleId}' not found`);
    }
    const existing = this.store.userRoles.get(userId) || [];
    if (existing.some((a) => a.roleId === roleId)) {
      throw new Error(`User '${userId}' already has role '${roleId}'`);
    }
    existing.push({ userId, roleId, assignedAt: new Date().toISOString() });
    this.store.userRoles.set(userId, existing);
  }

  public removeRoleFromUser(userId: string, roleId: string): void {
    const existing = this.store.userRoles.get(userId);
    if (!existing) {
      throw new Error(`User '${userId}' has no role assignments`);
    }
    const filtered = existing.filter((a) => a.roleId !== roleId);
    if (filtered.length === 0) {
      this.store.userRoles.delete(userId);
    } else {
      this.store.userRoles.set(userId, filtered);
    }
  }

  public getUserRoles(userId: string): Role[] {
    const assignments = this.store.userRoles.get(userId) || [];
    return assignments
      .map((a) => this.store.roles.get(a.roleId))
      .filter((r): r is Role => r !== undefined)
      .map((r) => ({ ...r, permissions: [...r.permissions] }));
  }

  public getEffectivePermissions(userId: string): string[] {
    const roles = this.getUserRoles(userId);
    const visited = new Set<string>();
    const permissionIds = new Set<string>();

    const collectPermissions = (roleId: string): void => {
      if (visited.has(roleId)) return;
      visited.add(roleId);
      const role = this.store.roles.get(roleId);
      if (!role) return;
      for (const permId of role.permissions) {
        permissionIds.add(permId);
      }
      if (role.parentRoleId) {
        collectPermissions(role.parentRoleId);
      }
    };

    for (const role of roles) {
      collectPermissions(role.id);
    }

    return Array.from(permissionIds);
  }

  public checkAccess(request: AccessCheckRequest): AccessCheckResult {
    const roles = this.getUserRoles(request.userId);
    if (roles.length === 0) {
      return {
        allowed: false,
        reason: 'User has no assigned roles',
        roles: [],
        permissions: [],
        deniedBy: 'RBAC_NO_ROLES',
      };
    }

    const effectivePermIds = this.getEffectivePermissions(request.userId);
    const permissions: Permission[] = [];
    for (const permId of effectivePermIds) {
      const perm = this.store.permissions.get(permId);
      if (perm) permissions.push(perm);
    }

    const matched = permissions.find(
      (p) => p.resource === request.resource && p.action === request.action
    );

    if (matched) {
      return {
        allowed: true,
        reason: `Access granted via role '${roles[0].id}' and permission '${matched.id}'`,
        roles: roles.map((r) => r.id),
        permissions: effectivePermIds,
      };
    }

    return {
      allowed: false,
      reason: `No matching permission for resource '${request.resource}' and action '${request.action}'`,
      roles: roles.map((r) => r.id),
      permissions: effectivePermIds,
      deniedBy: 'RBAC_NO_MATCH',
    };
  }

  public save(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      roles: Array.from(this.store.roles.entries()),
      permissions: Array.from(this.store.permissions.entries()),
      userRoles: Array.from(this.store.userRoles.entries()),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  public load(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File '${filePath}' not found`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.store.roles = new Map(raw.roles || []);
    this.store.permissions = new Map(raw.permissions || []);
    this.store.userRoles = new Map(raw.userRoles || []);
  }

  public getStore(): RbacStore {
    return this.store;
  }
}
