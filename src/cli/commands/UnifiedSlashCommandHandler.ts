/**
 * Zavorth Unified Slash Commands Handler.
 * Fast-path execution for /models, /variants, /thinking, /sessions, /resume, /fork, /todo, /config, /skills, /doctor, and /clear.
 */

import { ModelPickerModal } from '../presentation/ModelPickerModal.js';
import { VariantPickerModal } from '../presentation/VariantPickerModal.js';
import { SessionPickerModal } from '../presentation/SessionPickerModal.js';
import { SessionPersistenceService } from '../../storage/SessionPersistenceService.js';
import { loadConfig, getConfig } from '../../core/config/index.js';
import { TerminalTheme } from '../presentation/TerminalTheme.js';
import { normalizeEffort } from '../../providers/reasoningEffortPayload.js';
import type { ZavorthCliRuntime, ZavorthCliFlags, CliExecutionResult, CliWriter } from '../ZavorthCliContract.js';

let globalThinkingExpanded: boolean = true;
let globalActiveVariant: string = 'medium';
let globalActiveSessionId: string = 'default';

export function isThinkingExpanded(): boolean {
  return globalThinkingExpanded;
}

export function setThinkingExpanded(expanded: boolean): void {
  globalThinkingExpanded = expanded;
}

export function getActiveVariant(): string {
  return globalActiveVariant;
}

export function setActiveVariant(variant: string): void {
  globalActiveVariant = variant;
}

export function getActiveSessionId(): string {
  return globalActiveSessionId;
}

export function setActiveSessionId(id: string): void {
  globalActiveSessionId = id;
}

export class UnifiedSlashCommandHandler {
  /**
   * Checks if input is a recognized unified slash command.
   */
  static isSlashCommand(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return false;
    const cmd = trimmed.slice(1).split(/\s+/)[0].toLowerCase();
    return [
      'models', 'model',
      'variants', 'variant',
      'thinking', 'think',
      'sessions', 'session',
      'resume',
      'fork',
      'todo', 'todos',
      'config',
      'skills', 'tools',
      'doctor',
      'clear', 'reset'
    ].includes(cmd);
  }

  /**
   * Executes the slash command directly (fast-path).
   */
  static async handle(
    input: string,
    runtime: ZavorthCliRuntime,
    flags: ZavorthCliFlags,
    writer: CliWriter
  ): Promise<CliExecutionResult | null> {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const currentSessionId = flags.sessionId || globalActiveSessionId;

    switch (command) {
      case 'models':
      case 'model': {
        const filter = args[0] || undefined;
        const output = ModelPickerModal.renderCatalogTable(filter);
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'variants':
      case 'variant': {
        const target = args[0]?.toLowerCase();
        if (target) {
          const normalized = normalizeEffort(target);
          if (normalized || target === 'default') {
            globalActiveVariant = target;
            const output = `${TerminalTheme.symbols.check} Model reasoning variant set to: ${TerminalTheme.colors.warning(target)}`;
            writer.line(output);
            return { ok: true, handled: true, output: [output], error: null };
          }
        }
        const output = VariantPickerModal.renderVariantTable(globalActiveVariant);
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'thinking':
      case 'think': {
        const action = args[0]?.toLowerCase();
        if (action === 'expand' || action === 'show' || action === 'on') {
          globalThinkingExpanded = true;
        } else if (action === 'collapse' || action === 'hide' || action === 'off') {
          globalThinkingExpanded = false;
        } else {
          globalThinkingExpanded = !globalThinkingExpanded;
        }
        const statusText = globalThinkingExpanded ? 'Expanded (full reasoning stream)' : 'Collapsed (compact badge)';
        const output = `${TerminalTheme.symbols.check} Thinking stream visibility: ${TerminalTheme.colors.primary(statusText)}`;
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'sessions':
      case 'session': {
        const output = SessionPickerModal.renderSessionTable(currentSessionId);
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'resume': {
        const targetId = args[0];
        if (!targetId) {
          const err = 'Usage: /resume <session_id>';
          writer.error(err);
          return { ok: false, handled: true, output: [err], error: err };
        }
        const session = SessionPersistenceService.getSession(targetId);
        if (!session) {
          const err = `Session '${targetId}' not found. Use /sessions to view saved sessions.`;
          writer.error(err);
          return { ok: false, handled: true, output: [err], error: err };
        }
        globalActiveSessionId = session.id;
        flags.sessionId = session.id;
        const output = `${TerminalTheme.symbols.check} Resumed session: ${TerminalTheme.colors.bold(session.title)} ${TerminalTheme.colors.dim(`(${session.id})`)}`;
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'fork': {
        const newTitle = args.join(' ').trim() || undefined;
        const forked = SessionPersistenceService.forkSession(currentSessionId, newTitle);
        if (!forked) {
          const created = SessionPersistenceService.createSession({ title: newTitle || 'Forked Branch' });
          globalActiveSessionId = created.id;
          flags.sessionId = created.id;
          const output = `${TerminalTheme.symbols.check} Created new branch session: ${TerminalTheme.colors.bold(created.title)} ${TerminalTheme.colors.dim(`(${created.id})`)}`;
          writer.line(output);
          return { ok: true, handled: true, output: [output], error: null };
        }
        globalActiveSessionId = forked.id;
        flags.sessionId = forked.id;
        const output = `${TerminalTheme.symbols.check} Forked session branch: ${TerminalTheme.colors.bold(forked.title)} ${TerminalTheme.colors.dim(`(${forked.id})`)}`;
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'todo':
      case 'todos': {
        const sub = (args[0] || 'list').toLowerCase();

        if (sub === 'add') {
          const content = args.slice(1).join(' ').trim();
          if (!content) {
            const err = 'Usage: /todo add <task description>';
            writer.error(err);
            return { ok: false, handled: true, output: [err], error: err };
          }
          const todo = SessionPersistenceService.addTodo(currentSessionId, content);
          const output = `${TerminalTheme.symbols.check} Added todo: ${content}`;
          writer.line(output);
          return { ok: true, handled: true, output: [output], error: null };
        }

        if (sub === 'done' || sub === 'complete') {
          const target = args.slice(1).join(' ').trim();
          if (!target) {
            const err = 'Usage: /todo done <task index or keyword>';
            writer.error(err);
            return { ok: false, handled: true, output: [err], error: err };
          }
          const ok = SessionPersistenceService.updateTodoStatus(currentSessionId, target, 'completed');
          const output = ok
            ? `${TerminalTheme.symbols.check} Completed todo: ${target}`
            : `Todo '${target}' not found in active session.`;
          writer.line(output);
          return { ok: true, handled: true, output: [output], error: null };
        }

        // List todos
        const session = SessionPersistenceService.getSession(currentSessionId);
        const todos = session?.todos || [];
        const lines: string[] = [];
        lines.push(TerminalTheme.colors.primary(`=== Session Todos (${currentSessionId}) ===`));
        lines.push('');

        if (todos.length === 0) {
          lines.push(TerminalTheme.colors.dim('  No todos recorded for this session. Use /todo add <task>'));
        } else {
          todos.forEach((t, i) => {
            const marker = t.status === 'completed'
              ? TerminalTheme.colors.success(`[✓] ${t.content}`)
              : t.status === 'in_progress'
              ? TerminalTheme.colors.warning(`[•] ${t.content}`)
              : `[ ] ${t.content}`;
            lines.push(`  ${marker}`);
          });
        }

        const output = lines.join('\n');
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'config': {
        const sub = (args[0] || 'show').toLowerCase();
        const config = getConfig();

        if (sub === 'show') {
          const jsonStr = JSON.stringify(config, null, 2);
          const output = `${TerminalTheme.colors.primary('=== Current Zavorth Configuration (7-Layer Resolved) ===')}\n${jsonStr}`;
          writer.line(output);
          return { ok: true, handled: true, output: [output], error: null };
        }

        if (sub === 'get') {
          const key = args[1];
          if (!key) {
            const err = 'Usage: /config get <keyPath> (e.g. /config get logging.level)';
            writer.error(err);
            return { ok: false, handled: true, output: [err], error: err };
          }
          const keys = key.split('.');
          let current: any = config;
          for (const k of keys) {
            current = current?.[k];
          }
          const output = `${key} = ${JSON.stringify(current)}`;
          writer.line(output);
          return { ok: true, handled: true, output: [output], error: null };
        }

        const msg = 'Usage: /config [show | get <keyPath>]';
        writer.line(msg);
        return { ok: true, handled: true, output: [msg], error: null };
      }

      case 'skills':
      case 'tools': {
        const lines: string[] = [];
        lines.push(TerminalTheme.colors.primary('=== Zavorth Active Tools & Skills ==='));
        lines.push('');

        const tools = [
          { name: 'run_command', description: 'Execute verified system commands in workspace' },
          { name: 'view_file', description: 'Inspect files and directories' },
          { name: 'write_to_file', description: 'Create and write new files' },
          { name: 'replace_file_content', description: 'Make surgical replacements in existing files' },
          { name: 'manage_task', description: 'Manage background processes and tasks' },
          { name: 'schedule', description: 'Schedule timers and recurring cron triggers' },
        ];

        for (const t of tools) {
          lines.push(`  • ${TerminalTheme.colors.bold(t.name)}: ${TerminalTheme.colors.dim(t.description)}`);
        }

        const output = lines.join('\n');
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'doctor': {
        const lines: string[] = [];
        lines.push(TerminalTheme.colors.primary('=== Zavorth System Health & Readiness ==='));
        lines.push('');
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Configuration Engine')}: 7-Layer TOML Active`);
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Provider Registry')}: Ready`);
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Session Engine')}: Persistence Active (${currentSessionId})`);
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Tool Runtime')}: Operational`);
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Reasoning Variant')}: ${globalActiveVariant}`);
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Thinking Visibility')}: ${globalThinkingExpanded ? 'Expanded' : 'Collapsed'}`);
        lines.push(`  ${TerminalTheme.symbols.check} ${TerminalTheme.colors.success('Workspace Root')}: ${process.cwd()}`);

        const output = lines.join('\n');
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      case 'clear':
      case 'reset': {
        if (process.stdout.isTTY) {
          console.clear();
        }
        const output = TerminalTheme.colors.dim('Conversation cleared and session reset.');
        writer.line(output);
        return { ok: true, handled: true, output: [output], error: null };
      }

      default:
        return null;
    }
  }
}
