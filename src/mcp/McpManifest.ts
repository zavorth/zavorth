import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export type McpServerManifestEntry = {
  id: string;
  enabled?: boolean;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  allowedEnv?: string[];
  capability?: string;
};

export type ResolvedMcpServerManifestEntry = {
  id: string;
  enabled: boolean;
  command: string;
  args: string[];
  env: Record<string, string>;
  allowedEnv: string[];
  capability?: string;
};

type TemplateContext = Record<string, string>;

export class McpManifestLoader {
  constructor(
    private readonly manifestPath: string = config.mcpServersManifestPath,
    private readonly templateContext: TemplateContext = McpManifestLoader.createDefaultTemplateContext(),
  ) {}

  public load(): ResolvedMcpServerManifestEntry[] {
    const manifest = this.readManifestFile();
    return manifest.map((entry) => this.resolveEntry(entry));
  }

  public loadEnabled(): ResolvedMcpServerManifestEntry[] {
    return this.load().filter((entry) => entry.enabled);
  }

  private readManifestFile(): McpServerManifestEntry[] {
    const absolutePath = path.resolve(this.manifestPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`Manifesto MCP invalido em ${absolutePath}: o conteudo precisa ser uma lista JSON.`);
    }

    return parsed as McpServerManifestEntry[];
  }

  private resolveEntry(entry: McpServerManifestEntry): ResolvedMcpServerManifestEntry {
    if (!entry.id || !entry.command) {
      throw new Error('Cada servidor MCP precisa definir pelo menos "id" e "command" no manifesto.');
    }

    return {
      id: String(entry.id).trim(),
      enabled: entry.enabled !== false,
      command: this.interpolate(String(entry.command)),
      args: Array.isArray(entry.args) ? entry.args.map((value) => this.interpolate(String(value))) : [],
      env: Object.fromEntries(
        Object.entries(entry.env || {}).map(([key, value]) => [key, this.interpolate(String(value))]),
      ),
      allowedEnv: Array.isArray(entry.allowedEnv)
        ? entry.allowedEnv
          .map((value) => String(value || '').trim())
          .filter(Boolean)
        : [],
      capability: entry.capability ? this.interpolate(String(entry.capability)) : undefined,
    };
  }

  private interpolate(template: string): string {
    return String(template || '').replace(/\$\{([^}]+)\}/g, (_match, token: string) => {
      const normalized = String(token).trim();

      if (normalized.startsWith('env:')) {
        const envKey = normalized.slice(4).trim();
        return process.env[envKey] || '';
      }

      return this.templateContext[normalized] || '';
    });
  }

  public static createDefaultTemplateContext(): TemplateContext {
    return {
      projectRoot: config.defaultWorkspace,
      defaultWorkspace: config.defaultWorkspace,
      workspaceRoot: config.workspaceRoot,
      npxCommand: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      nodeCommand: process.platform === 'win32' ? 'node.exe' : 'node',
    };
  }
}
