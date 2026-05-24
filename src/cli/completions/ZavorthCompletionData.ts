export const ZAVORTH_COMPLETION_COMMANDS = [
  'ask',
  'run',
  'setup',
  'install',
  'build',
  'check',
  'doctor',
  'open',
  'hud',
  'approve',
  'reject',
  'diff',
  'learn',
  'pulse',
  'version',
  'update',
  'completions',
  'inspect',
  'managed-config',
  'help',
] as const;

export const ZAVORTH_COMPLETION_FLAGS = [
  '--help',
  '--json',
  '--debug',
  '--workspace',
  '--session',
  '--channel',
  '--approval-mode',
  '--source',
  '--checksum',
  '--deployment-key',
  '--yes',
  '--dry-run',
] as const;

export const ZAVORTH_COMPLETION_CHANNELS = ['stable', 'beta', 'nightly', 'dev'] as const;

export const ZAVORTH_COMPLETION_APPROVAL_MODES = ['manual', 'governed', 'speculative'] as const;

export const ZAVORTH_COMPLETION_SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;

export type ZavorthCompletionShell = typeof ZAVORTH_COMPLETION_SHELLS[number];
