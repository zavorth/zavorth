import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
  last_active: string;
  preferences: Record<string, unknown>;
  permissions: string[];
}

export class MultiUserService {
  private readonly storageDir: string;
  private users: Map<string, User> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'multi-user');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadUsers();
  }

  private loadUsers(): void {
    const p = path.join(this.storageDir, 'users.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(data)) {
        for (const u of data) this.users.set(u.id, u);
      }
    } catch { /* ignore */ }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'users.json'), JSON.stringify(Array.from(this.users.values()), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public addUser(name: string, email: string, role: User['role'] = 'member'): string {
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const user: User = {
      id, name, email, role,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      preferences: {},
      permissions: this.getDefaultPermissions(role),
    };
    this.users.set(id, user);
    this.scheduleFlush();
    return `User "${name}" added as ${role} (${id})`;
  }

  public removeUser(userId: string): string {
    const user = this.users.get(userId);
    if (!user) return `Error: user "${userId}" not found.`;
    if (user.role === 'owner') return 'Error: cannot remove the owner.';
    this.users.delete(userId);
    this.scheduleFlush();
    return `User "${user.name}" removed.`;
  }

  public updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'role' | 'preferences'>>): string {
    const user = this.users.get(userId);
    if (!user) return `Error: user "${userId}" not found.`;
    if (updates.name) user.name = updates.name;
    if (updates.role) {
      user.role = updates.role;
      user.permissions = this.getDefaultPermissions(updates.role);
    }
    if (updates.preferences) user.preferences = { ...user.preferences, ...updates.preferences };
    user.last_active = new Date().toISOString();
    this.scheduleFlush();
    return `User "${user.name}" updated.`;
  }

  public getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  public listUsers(): string {
    if (this.users.size === 0) return 'No users configured.';
    const lines: string[] = ['Users:'];
    for (const [, u] of this.users) {
      const icon = { owner: '👑', admin: '🛡️', member: '👤', viewer: '👁️' }[u.role];
      lines.push(`  ${icon} ${u.id}: ${u.name} (${u.role}) - ${u.email}`);
    }
    return lines.join('\n');
  }

  public hasPermission(userId: string, permission: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    return user.permissions.includes(permission) || user.permissions.includes('*');
  }

  public getStats(): string {
    const users = Array.from(this.users.values());
    const byRole: Record<string, number> = {};
    for (const u of users) byRole[u.role] = (byRole[u.role] || 0) + 1;
    return [
      'Multi-User Stats:',
      `  Total users: ${users.length}`,
      ...Object.entries(byRole).map(([r, c]) => `  ${r}: ${c}`),
    ].join('\n');
  }

  private getDefaultPermissions(role: User['role']): string[] {
    switch (role) {
      case 'owner': return ['*'];
      case 'admin': return ['read', 'write', 'execute', 'manage_users', 'manage_settings'];
      case 'member': return ['read', 'write', 'execute'];
      case 'viewer': return ['read'];
      default: return ['read'];
    }
  }
}
