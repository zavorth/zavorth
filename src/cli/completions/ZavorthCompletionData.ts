/**
 * Shell completions: everyday / anyone-path only (gate 2).
 * Platform namespaces stay available but are not auto-suggested.
 */
export const ZAVORTH_COMPLETION_COMMANDS = [
  'setup',
  'start',
  'open',
  'ready',
  'ask',
  'chat',
  'connect',
  'anyone',
  'learn',
  'approve',
  'doctor',
  'providers',
  'channels',
  'home',
  'help',
  'status',
  'diff',
  'reach',
  'power',
  'product',
  'proof',
  'where',
  'hatch',
  'quickstart',
  'trust',
  'hud',
  'todo',
  'work',
  'version',
  'completions',
] as const;

export const ZAVORTH_COMPLETION_FLAGS = [
  '--help',
  '--json',
  '--debug',
  '--workspace',
  '--session',
  '--channel',
  '--approval-mode',
  '--simple',
  '--advanced',
  '--yes',
  '--dry-run',
] as const;

export const ZAVORTH_COMPLETION_CHANNELS = ['stable', 'beta', 'nightly', 'dev'] as const;

export const ZAVORTH_COMPLETION_APPROVAL_MODES = ['manual', 'governed', 'speculative'] as const;

export const ZAVORTH_COMPLETION_SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;

export type ZavorthCompletionShell = typeof ZAVORTH_COMPLETION_SHELLS[number];
