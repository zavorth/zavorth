import type { WorkspaceCommand, WorkspaceProfile } from './WorkspaceProfileService.js';

type WorkspaceCommandSource = WorkspaceProfile | Record<string, unknown> | null | undefined;

export type ResolvedWorkspaceCommand = {
  name: string;
  template: string;
  resolvedText: string;
  argsText: string;
};

export class WorkspaceCommandService {
  public listCommands(source: WorkspaceCommandSource): WorkspaceCommand[] {
    const record = this.toRecord(source);
    const commands = Array.isArray(record.workspace_commands) ? record.workspace_commands : [];
    return commands
      .map((entry) => this.normalizeCommand(entry))
      .filter((entry): entry is WorkspaceCommand => Boolean(entry));
  }

  public getCommandByName(source: WorkspaceCommandSource, name: string): WorkspaceCommand | null {
    const normalizedName = this.normalizeName(name);
    if (!normalizedName) {
      return null;
    }

    return this.listCommands(source).find((entry) => entry.name === normalizedName) || null;
  }

  public buildNotes(source: WorkspaceCommandSource): string[] {
    return this.listCommands(source)
      .slice(0, 6)
      .map((command) => `/${command.name}: ${command.template}`);
  }

  public resolveInvocation(
    source: WorkspaceCommandSource,
    name: string,
    argsText = '',
  ): ResolvedWorkspaceCommand | null {
    const command = this.getCommandByName(source, name);
    if (!command) {
      return null;
    }

    const normalizedArgs = String(argsText || '').trim();
    let resolvedText = command.template;

    if (/\$\{\s*args\s*\}|\{\{\s*args\s*\}\}/i.test(resolvedText)) {
      resolvedText = resolvedText
        .replace(/\$\{\s*args\s*\}/gi, normalizedArgs)
        .replace(/\{\{\s*args\s*\}\}/gi, normalizedArgs)
        .replace(/\s{2,}/g, ' ')
        .trim();
    } else if (normalizedArgs) {
      resolvedText = `${resolvedText.trim()} ${normalizedArgs}`.trim();
    } else {
      resolvedText = resolvedText.trim();
    }

    return {
      name: command.name,
      template: command.template,
      resolvedText,
      argsText: normalizedArgs,
    };
  }

  private normalizeCommand(value: unknown): WorkspaceCommand | null {
    const record = this.toRecord(value);
    const name = this.normalizeName(record.name);
    const template = String(record.template || '').trim();
    if (!name || !template) {
      return null;
    }

    return {
      name,
      template,
    };
  }

  private normalizeName(value: unknown): string {
    return String(value || '')
      .trim()
      .replace(/^\//, '')
      .toLowerCase();
  }

  private toRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, any>;
  }
}
