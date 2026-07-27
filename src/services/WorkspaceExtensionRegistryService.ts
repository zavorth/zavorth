import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { WorkspaceCommand, WorkspaceHook, WorkspaceProfile } from './WorkspaceProfileService.js';
import { logger } from '../logger.js';

type WorkspaceExtensionRegistryRuntime = {
  now?: () => Date;
  profilesDir?: string;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
};

export type WorkspaceExtensionEntry = {
  workspace: string;
  workspaceName: string;
  slug: string;
  instructionFile: string | null;
  instructionSummary: string;
  commandCount: number;
  hookCount: number;
  commands: WorkspaceCommand[];
  hooks: WorkspaceHook[];
  lastRefreshed: string | null;
};

export type WorkspaceExtensionRegistrySnapshot = {
  generatedAt: string;
  summary: {
    workspaces: number;
    commands: number;
    hooks: number;
    withInstructions: number;
  };
  query: string | null;
  entries: WorkspaceExtensionEntry[];
  selected: WorkspaceExtensionEntry | null;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class WorkspaceExtensionRegistryService {
  private readonly now: () => Date;
  private readonly profilesDir: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: WorkspaceExtensionRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.profilesDir = runtime.profilesDir || config.workspaceProfilesDir;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public listEntries(): WorkspaceExtensionEntry[] {
    if (!this.existsSyncImpl(this.profilesDir)) {
      return [];
    }

    return this.readdirSyncImpl(this.profilesDir)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .map((entry) => this.readProfile(path.join(this.profilesDir, entry)))
      .filter((entry): entry is WorkspaceProfile => Boolean(entry))
      .map((profile) => ({
        workspace: profile.workspace,
        workspaceName: profile.workspace_name,
        slug: profile.slug,
        instructionFile: profile.instruction_file || null,
        instructionSummary: profile.instruction_summary || '',
        commandCount: Array.isArray(profile.workspace_commands) ? profile.workspace_commands.length : 0,
        hookCount: Array.isArray(profile.workspace_hooks) ? profile.workspace_hooks.length : 0,
        commands: Array.isArray(profile.workspace_commands) ? profile.workspace_commands : [],
        hooks: Array.isArray(profile.workspace_hooks) ? profile.workspace_hooks : [],
        lastRefreshed: profile.last_refreshed || null,
      }))
      .sort((left, right) => left.workspaceName.localeCompare(right.workspaceName));
  }

  public buildSummary(): {
    workspaces: number;
    commands: number;
    hooks: number;
    withInstructions: number;
  } {
    const entries = this.listEntries();
    return {
      workspaces: entries.length,
      commands: entries.reduce((total, entry) => total + entry.commandCount, 0),
      hooks: entries.reduce((total, entry) => total + entry.hookCount, 0),
      withInstructions: entries.filter((entry) => Boolean(entry.instructionFile)).length,
    };
  }

  public buildSnapshot(input: { selectedId?: string | null; query?: string | null } = {}): WorkspaceExtensionRegistrySnapshot {
    const selectedId = this.normalizeSearchValue(input.selectedId);
    const query = this.normalizeSearchValue(input.query);
    const allEntries = this.listEntries();
    const entries = query
      ? allEntries.filter((entry) => this.buildSearchText(entry).includes(query))
      : allEntries;
    const summary = {
      workspaces: entries.length,
      commands: entries.reduce((total, entry) => total + entry.commandCount, 0),
      hooks: entries.reduce((total, entry) => total + entry.hookCount, 0),
      withInstructions: entries.filter((entry) => Boolean(entry.instructionFile)).length,
    };
    const selected = this.resolveSelectedEntry(entries, selectedId, query);

    return {
      generatedAt: this.now().toISOString(),
      summary,
      query: query || null,
      entries,
      selected,
      narrative: {
        headline: entries.length ? `Workspace plane com ${entries.length} workspace(s) profileado(s).`
          : 'No workspace extension registered yet.',
        operatorSummary: entries.length ? `${summary.commands} command(s), ${summary.hooks} hook(s), and ${summary.withInstructions} workspace(s) with visible instructions.`
          : 'Add ZAVORTH.md or generate workspace profiles to expose local commands and hooks.',
      },
    };
  }

  private readProfile(filePath: string): WorkspaceProfile | null {
    try {
      const parsed = JSON.parse(this.readFileSyncImpl(filePath, 'utf8')) as Partial<WorkspaceProfile>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      if (!parsed.workspace || !parsed.workspace_name || !parsed.slug) {
        return null;
      }
      return parsed as WorkspaceProfile;
    } catch (error: unknown) {logger.warn('[Workspace Extension Registry] JSON parse failed', error); return null; }
  }

  private resolveSelectedEntry(
    entries: WorkspaceExtensionEntry[],
    selectedId: string,
    query: string,
  ): WorkspaceExtensionEntry | null {
    if (entries.length === 0) {
      return null;
    }

    if (selectedId) {
      return entries.find((entry) => this.normalizeSearchValue(entry.slug) === selectedId) || null;
    }

    if (query) {
      return entries[0] || null;
    }

    return entries[0] || null;
  }

  private buildSearchText(entry: WorkspaceExtensionEntry): string {
    return [
      entry.workspace,
      entry.workspaceName,
      entry.slug,
      entry.instructionSummary,
      entry.instructionFile || '',
      ...entry.commands.map((command) => `${command.name} ${command.template}`),
      ...entry.hooks.map((hook) => `${hook.event} ${hook.command}`),
    ]
      .map((value) => this.normalizeSearchValue(value))
      .filter(Boolean)
      .join(' ');
  }

  private normalizeSearchValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
