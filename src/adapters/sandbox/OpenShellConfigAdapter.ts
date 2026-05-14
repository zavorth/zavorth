import path from 'path';
import type {
  OpenShellRemoteSandboxConfig,
  RemoteSandboxMode,
} from '../../contracts/RemoteSandboxContract.js';

export type OpenShellConfigInput = {
  mode?: 'mirror' | 'remote' | 'artifact-first-mirror' | null;
  command?: string | null;
  gateway?: string | null;
  gatewayEndpoint?: string | null;
  source?: string | null;
  policy?: string | null;
  providers?: string[] | null;
  gpu?: boolean | null;
  autoProviders?: boolean | null;
  remoteWorkspaceDir?: string | null;
  remoteAgentWorkspaceDir?: string | null;
  timeoutSeconds?: number | null;
  timeoutMs?: number | null;
};

const MANAGED_ROOTS = ['/sandbox', '/agent'] as const;

export class OpenShellConfigAdapter {
  public resolve(input: OpenShellConfigInput = {}): OpenShellRemoteSandboxConfig {
    return {
      mode: this.resolveMode(input.mode),
      command: this.nonEmpty(input.command, 'openshell'),
      gateway: this.optionalText(input.gateway),
      gatewayEndpoint: this.optionalText(input.gatewayEndpoint),
      source: this.nonEmpty(input.source, 'zavorth'),
      policy: this.optionalText(input.policy),
      providers: this.normalizeProviders(input.providers),
      gpu: input.gpu === true,
      autoProviders: input.autoProviders !== false,
      remoteWorkspaceDir: this.normalizeRemotePath(input.remoteWorkspaceDir, '/sandbox', 'remoteWorkspaceDir'),
      remoteAgentWorkspaceDir: this.normalizeRemotePath(input.remoteAgentWorkspaceDir, '/agent', 'remoteAgentWorkspaceDir'),
      timeoutMs: this.resolveTimeoutMs(input),
    };
  }

  public normalizeRemotePath(
    value: string | null | undefined,
    fallback: string,
    label = 'remote path',
  ): string {
    const candidate = String(value || fallback).trim() || fallback;
    const normalized = path.posix.normalize(candidate);
    if (!normalized.startsWith('/')) {
      throw new Error(`OpenShell ${label} must be absolute: ${candidate}`);
    }
    if (!this.isManagedRemotePath(normalized)) {
      throw new Error(`OpenShell ${label} must stay under /sandbox or /agent: ${candidate}`);
    }
    return normalized;
  }

  public isManagedRemotePath(value: string): boolean {
    const normalized = path.posix.normalize(String(value || '').trim());
    return MANAGED_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`));
  }

  private resolveMode(value: OpenShellConfigInput['mode']): RemoteSandboxMode {
    const normalized = String(value || '').trim();
    if (normalized === 'remote') {
      return 'remote';
    }
    return 'artifact-first-mirror';
  }

  private normalizeProviders(value: string[] | null | undefined): string[] {
    const seen = new Set<string>();
    const providers: string[] = [];
    for (const item of value || []) {
      const normalized = String(item || '').trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      providers.push(normalized);
    }
    return providers;
  }

  private resolveTimeoutMs(input: OpenShellConfigInput): number {
    if (typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs) && input.timeoutMs >= 1) {
      return Math.floor(input.timeoutMs);
    }
    if (typeof input.timeoutSeconds === 'number' && Number.isFinite(input.timeoutSeconds) && input.timeoutSeconds >= 1) {
      return Math.floor(input.timeoutSeconds * 1000);
    }
    return 120_000;
  }

  private nonEmpty(value: string | null | undefined, fallback: string): string {
    return String(value || '').trim() || fallback;
  }

  private optionalText(value: string | null | undefined): string | null {
    return String(value || '').trim() || null;
  }
}
