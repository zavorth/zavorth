import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  members: string[];
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
  files: string[];
}

export class SharedWorkspaceService {
  private readonly storageDir: string;
  private workspaces: Map<string, Workspace> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'shared-workspaces');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadWorkspaces();
  }

  private loadWorkspaces(): void {
    const p = path.join(this.storageDir, 'workspaces.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(data)) {
        for (const w of data) this.workspaces.set(w.id, w);
      }
    } catch (error: any) { /* ignore */ logger.warn('[Shared Workspace] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'workspaces.json'), JSON.stringify(Array.from(this.workspaces.values()), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public createWorkspace(name: string, description: string, ownerId: string): string {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const workspace: Workspace = {
      id, name, description,
      owner_id: ownerId,
      members: [ownerId],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      settings: {},
      files: [],
    };
    this.workspaces.set(id, workspace);
    this.scheduleFlush();
    return `Workspace "${name}" created (${id})`;
  }

  public deleteWorkspace(workspaceId: string): string {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return `Error: workspace "${workspaceId}" not found.`;
    this.workspaces.delete(workspaceId);
    this.scheduleFlush();
    return `Workspace "${ws.name}" deleted.`;
  }

  public addMember(workspaceId: string, userId: string): string {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return `Error: workspace "${workspaceId}" not found.`;
    if (ws.members.includes(userId)) return `User "${userId}" is already a member.`;
    ws.members.push(userId);
    ws.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `User "${userId}" added to workspace "${ws.name}".`;
  }

  public removeMember(workspaceId: string, userId: string): string {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return `Error: workspace "${workspaceId}" not found.`;
    if (ws.owner_id === userId) return 'Error: cannot remove the owner.';
    ws.members = ws.members.filter((m) => m !== userId);
    ws.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `User "${userId}" removed from workspace "${ws.name}".`;
  }

  public getWorkspace(workspaceId: string): Workspace | null {
    return this.workspaces.get(workspaceId) || null;
  }

  public listWorkspaces(): string {
    if (this.workspaces.size === 0) return 'No shared workspaces.';
    const lines: string[] = ['Shared Workspaces:'];
    for (const [, ws] of this.workspaces) {
      lines.push(`  ${ws.id}: ${ws.name} (${ws.members.length} members)`);
    }
    return lines.join('\n');
  }

  public isMember(workspaceId: string, userId: string): boolean {
    const ws = this.workspaces.get(workspaceId);
    return ws ? ws.members.includes(userId) : false;
  }

  public getStats(): string {
    const workspaces = Array.from(this.workspaces.values());
    const totalMembers = workspaces.reduce((s, ws) => s + ws.members.length, 0);
    return [
      'Shared Workspace Stats:',
      `  Workspaces: ${workspaces.length}`,
      `  Total members: ${totalMembers}`,
      `  Avg members/workspace: ${workspaces.length > 0 ? (totalMembers / workspaces.length).toFixed(1) : 0}`,
    ].join('\n');
  }
}
