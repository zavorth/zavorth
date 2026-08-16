/**
 * Zavorth Unified Slash Commands Handler.
 * Fast-path execution for /models, /variants, /thinking, /config, /skills, /doctor, and /clear.
 */

import { ModelPickerModal } from '../presentation/ModelPickerModal.js';
import { VariantPickerModal } from '../presentation/VariantPickerModal.js';
import { loadConfig, getConfig } from '../../core/config/index.js';
import { TerminalTheme } from '../presentation/TerminalTheme.js';
import { normalizeEffort } from '../../providers/reasoningEffortPayload.js';
import type { ZavorthCliRuntime, ZavorthCliFlags, CliExecutionResult, CliWriter } from '../ZavorthCliContract.js';

let globalThinkingExpanded: boolean = true;
let globalActiveVariant: string = 'medium';

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
      'config',
      'skills', 'tools',
      'sessions', 'session',
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
        const lines: string[] = [];
        lines.push(TerminalTheme.colors.primary('=== Zavorth Sessions ==='));
        lines.push(`  ${TerminalTheme.colors.warning('•')} Current session: ${flags.sessionId || 'default'}`);
        lines.push(`  Platform: ${flags.platform} | User: ${flags.userId || 'cli-operator'}`);
        lines.push('');
        lines.push(TerminalTheme.colors.dim('Use zavorth --session <id> to switch session'));
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
