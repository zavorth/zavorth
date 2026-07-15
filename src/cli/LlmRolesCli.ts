/**
 * CLI surface for dual-role LLM preferences (default / strong / background).
 * Same store as Telegram, Discord, Desktop, Control, and agent free-text setup.
 */

import { LlmRoleSurfaceCommands } from '../services/llm/LlmRoleSurfaceCommands.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { ProviderControlPlaneService } from '../services/ProviderControlPlaneService.js';
import { config } from '../config/index.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function printHelp(): void {
  console.log(
    [
      '=== Zavorth LLM roles ===',
      '',
      'Configure default/strong/background models shared across every surface.',
      '',
      'Usage:',
      '  zavorth roles status',
      '  zavorth roles setup',
      '  zavorth roles default <provider|model>',
      '  zavorth roles strong <provider|model>',
      '  zavorth roles background <provider|model>',
      '  zavorth roles fallback on|off',
      '  zavorth strong on|off',
      '  zavorth roles --user <id> --surface <name> status',
      '',
      'Aliases: zavorth model setup | zavorth model status (roles view)',
    ].join('\n'),
  );
}

function buildCtx(args: string[]) {
  const userIdx = args.indexOf('--user');
  const surfaceIdx = args.indexOf('--surface');
  const userId =
    userIdx >= 0 ? String(args[userIdx + 1] || '').trim() : process.env.USER || process.env.USERNAME || 'cli';
  const surface = surfaceIdx >= 0 ? String(args[surfaceIdx + 1] || '').trim() : 'cli';
  const runtime = new LlmRuntimeService();
  const plane = new ProviderControlPlaneService();
  return {
    userId,
    surface,
    isProviderUsable: (name: string) => runtime.isProviderAvailable(name),
    defaultModelForProvider: (provider: string) => {
      const p = String(provider || '').toLowerCase();
      if (p === 'gemini') return config.geminiModel;
      if (p === 'openai') return config.openaiModel;
      if (p === 'deepseek') return config.deepseekModel;
      if (p === 'openrouter') return config.openRouterModel;
      if (p === 'xai') return config.xaiModel;
      return '';
    },
    resolveSelection: (target: string) => plane.resolveSelection(target),
    usageTargets: () => plane.getUsageTargets(),
  };
}

export async function runLlmRolesCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const args = rawArgs.filter(
    (a) =>
      a !== '--user' &&
      a !== '--surface' &&
      rawArgs[rawArgs.indexOf(a) - 1] !== '--user' &&
      rawArgs[rawArgs.indexOf(a) - 1] !== '--surface',
  );
  // Keep only non-flag positionals
  const positional: string[] = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const t = rawArgs[i];
    if (t === '--user' || t === '--surface') {
      i += 1;
      continue;
    }
    if (t.startsWith('--')) continue;
    positional.push(t);
  }

  const commands = new LlmRoleSurfaceCommands();
  const ctx = buildCtx(rawArgs);
  const sub = String(positional[0] || 'status').toLowerCase();
  const rest = positional.slice(1).join(' ').trim();

  if (sub === 'help') {
    printHelp();
    return 0;
  }

  if (sub === 'on' || sub === 'off' || sub === 'strong') {
    // zavorth strong on|off  or  zavorth roles strong flash
    if (sub === 'on' || sub === 'off') {
      console.log(commands.setForceStrong(ctx, sub === 'on'));
      return 0;
    }
  }

  if (sub === 'force-strong' || sub === 'forcestrong') {
    const enabled = !/^(off|0|false|default)$/i.test(rest || 'on');
    console.log(commands.setForceStrong(ctx, enabled));
    return 0;
  }

  const modelArgs = sub === 'status' || sub === 'show' ? 'status' : rest ? `${sub} ${rest}` : sub;

  const handled = commands.handleModelArgs(ctx, modelArgs);
  if (handled.handled && handled.text) {
    if (hasFlag(rawArgs, '--json')) {
      console.log(JSON.stringify({ ok: true, text: handled.text, surface: ctx.surface, userId: ctx.userId }, null, 2));
    } else {
      console.log(handled.text);
    }
    return 0;
  }

  printHelp();
  return 1;
}

export async function runStrongCli(rawArgs: string[] = []): Promise<number> {
  const mode = String(rawArgs[0] || 'on').toLowerCase();
  const commands = new LlmRoleSurfaceCommands();
  const ctx = buildCtx(rawArgs);
  const enabled = !(mode === 'off' || mode === 'default' || mode === '0' || mode === 'false');
  console.log(commands.setForceStrong(ctx, enabled));
  return 0;
}
