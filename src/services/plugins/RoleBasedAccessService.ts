import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  created_at: string;
}

export interface AccessPolicy {
  id: string;
  resource: string;
  action: string;
  roles: string[];
  conditions: Record<string, unknown>;
  created_at: string;
}

export class RoleBasedAccessService {
  private readonly storageDir: string;
  private roles: Map<string, Role> = new Map();
  private policies: Map<string, AccessPolicy> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'rbac');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadData();
    this.initDefaultRoles();
  }

  private loadData(): void {
    try {
      const r = path.join(this.storageDir, 'roles.json');
      if (fs.existsSync(r)) {
        const data = JSON.parse(fs.readFileSync(r, 'utf-8'));
        if (Array.isArray(data)) for (const role of data) this.roles.set(role.id, role);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Role Based Access] JSON parse failed', error); }
    try {
      const p = path.join(this.storageDir, 'policies.json');
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (Array.isArray(data)) for (const policy of data) this.policies.set(policy.id, policy);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Role Based Access] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'roles.json'), JSON.stringify(Array.from(this.roles.values()), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'policies.json'), JSON.stringify(Array.from(this.policies.values()), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  private initDefaultRoles(): void {
    if (this.roles.size > 0) return;
    const defaults: Array<Omit<Role, 'created_at'>> = [
      { id: 'owner', name: 'Owner', description: 'Full access to everything', permissions: ['*'] },
      { id: 'admin', name: 'Admin', description: 'Manage users and settings', permissions: ['read', 'write', 'execute', 'manage_users', 'manage_settings', 'manage_workspaces'] },
      { id: 'member', name: 'Member', description: 'Standard access', permissions: ['read', 'write', 'execute'] },
      { id: 'viewer', name: 'Viewer', description: 'Read-only access', permissions: ['read'] },
    ];
    for (const d of defaults) {
      this.roles.set(d.id, { ...d, created_at: new Date().toISOString() });
    }
    this.scheduleFlush();
  }

  public createRole(name: string, description: string, permissions: string[]): string {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (this.roles.has(id)) return `Error: role "${id}" already exists.`;
    this.roles.set(id, { id, name, description, permissions, created_at: new Date().toISOString() });
    this.scheduleFlush();
    return `Role "${name}" created (${id})`;
  }

  public deleteRole(roleId: string): string {
    if (['owner', 'admin', 'member', 'viewer'].includes(roleId)) return 'Error: cannot delete built-in roles.';
    if (!this.roles.has(roleId)) return `Error: role "${roleId}" not found.`;
    this.roles.delete(roleId);
    this.scheduleFlush();
    return `Role "${roleId}" deleted.`;
  }

  public addPolicy(resource: string, action: string, roles: string[], conditions: Record<string, unknown> = {}): string {
    const id = `policy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.policies.set(id, { id, resource, action, roles, conditions, created_at: new Date().toISOString() });
    this.scheduleFlush();
    return `Policy created: ${resource}/${action} -> ${roles.join(', ')}`;
  }

  public checkAccess(roleId: string, resource: string, action: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) return false;
    if (role.permissions.includes('*')) return true;
    if (role.permissions.includes(action)) return true;

    for (const [, policy] of this.policies) {
      if (policy.resource === resource && policy.action === action && policy.roles.includes(roleId)) {
        return true;
      }
    }

    return false;
  }

  public getRole(roleId: string): Role | null {
    return this.roles.get(roleId) || null;
  }

  public listRoles(): string {
    if (this.roles.size === 0) return 'No roles defined.';
    const lines: string[] = ['Roles:'];
    for (const [, role] of this.roles) {
      lines.push(`  ${role.id}: ${role.name} [${role.permissions.join(', ')}]`);
    }
    return lines.join('\n');
  }

  public listPolicies(): string {
    if (this.policies.size === 0) return 'No policies defined.';
    const lines: string[] = ['Access Policies:'];
    for (const [, p] of this.policies) {
      lines.push(`  ${p.id}: ${p.resource}/${p.action} -> ${p.roles.join(', ')}`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    return [
      'RBAC Stats:',
      `  Roles: ${this.roles.size}`,
      `  Policies: ${this.policies.size}`,
    ].join('\n');
  }
}
