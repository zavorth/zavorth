export interface WorkspaceSessionGrant {
  workspaceId: string;
  expiresAt: string;
  allowRiskUpTo: 'LOW' | 'MEDIUM';
  allowPackageInstall: boolean;
  allowNetwork: boolean;
}

export class WorkspaceSessionGrantCache {
  private static instance: WorkspaceSessionGrantCache | null = null;
  private readonly grants = new Map<string, WorkspaceSessionGrant>();
  private readonly developerModeWorkspaces = new Set<string>();

  private constructor() {}

  public static getInstance(): WorkspaceSessionGrantCache {
    if (!WorkspaceSessionGrantCache.instance) {
      WorkspaceSessionGrantCache.instance = new WorkspaceSessionGrantCache();
    }
    return WorkspaceSessionGrantCache.instance;
  }

  public setDeveloperMode(workspaceId: string, active: boolean): void {
    if (active) {
      this.developerModeWorkspaces.add(workspaceId);
    } else {
      this.developerModeWorkspaces.delete(workspaceId);
      this.grants.delete(workspaceId);
    }
  }

  public isDeveloperModeActive(workspaceId: string): boolean {
    return this.developerModeWorkspaces.has(workspaceId);
  }

  public setGrant(workspaceId: string, grant: WorkspaceSessionGrant): void {
    this.grants.set(workspaceId, grant);
  }

  public getGrant(workspaceId: string): WorkspaceSessionGrant | null {
    const grant = this.grants.get(workspaceId);
    if (!grant) {
      return null;
    }
    if (new Date(grant.expiresAt) <= new Date()) {
      this.grants.delete(workspaceId);
      return null;
    }
    return grant;
  }

  public revokeGrant(workspaceId: string): void {
    this.grants.delete(workspaceId);
  }

  public clearAll(): void {
    this.grants.clear();
    this.developerModeWorkspaces.clear();
  }
}
