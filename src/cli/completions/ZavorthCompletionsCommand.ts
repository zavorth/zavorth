import fs from 'fs';
import path from 'path';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags } from '../ZavorthCliContract.js';
import {
  ZAVORTH_COMPLETION_APPROVAL_MODES,
  ZAVORTH_COMPLETION_CHANNELS,
  ZAVORTH_COMPLETION_COMMANDS,
  ZAVORTH_COMPLETION_FLAGS,
  ZAVORTH_COMPLETION_SHELLS,
  type ZavorthCompletionShell,
} from './ZavorthCompletionData.js';

export async function handleZavorthCompletionsCommand(input: {
  commandName: string | null;
  args: string;
  flags: ZavorthCliFlags;
  writer: CliWriter;
}): Promise<CliExecutionResult | null> {
  if (input.commandName !== 'completions' && input.commandName !== 'completion') {
    return null;
  }

  const parsed = parseCompletionArgs(input.args);
  if (!parsed.shell) {
    const body = renderCompletionHelp();
    input.writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const script = renderCompletionScript(parsed.shell);
  if (parsed.install) {
    const result = installCompletion(parsed.shell, script, { profile: parsed.profile, yes: parsed.yes });
    const body = input.flags.json
      ? JSON.stringify(result, null, 2)
      : renderInstallResult(result);
    input.writer.line(body);
    return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.message };
  }

  input.writer.line(input.flags.json
    ? JSON.stringify({ shell: parsed.shell, script }, null, 2)
    : script);
  return { ok: true, handled: true, output: [script], error: null };
}

export function renderCompletionScript(shell: ZavorthCompletionShell): string {
  const commands = ZAVORTH_COMPLETION_COMMANDS.join(' ');
  const flags = ZAVORTH_COMPLETION_FLAGS.join(' ');
  const channels = ZAVORTH_COMPLETION_CHANNELS.join(' ');
  const approvalModes = ZAVORTH_COMPLETION_APPROVAL_MODES.join(' ');

  switch (shell) {
    case 'bash':
      return `# Zavorth bash completion
_zavorth_complete() {
  local cur prev commands flags channels approval_modes
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${commands}"
  flags="${flags}"
  channels="${channels}"
  approval_modes="${approvalModes}"
  if [[ "$prev" == "--channel" ]]; then
    COMPREPLY=( $(compgen -W "$channels" -- "$cur") )
    return 0
  fi
  if [[ "$prev" == "--approval-mode" ]]; then
    COMPREPLY=( $(compgen -W "$approval_modes" -- "$cur") )
    return 0
  fi
  if [[ "$cur" == -* ]]; then
    COMPREPLY=( $(compgen -W "$flags" -- "$cur") )
    return 0
  fi
  COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
}
complete -F _zavorth_complete zavorth
`;
    case 'zsh':
      return `#compdef zavorth
# Zavorth zsh completion
_zavorth() {
  local -a commands flags channels approval_modes
  commands=(${commands})
  flags=(${flags})
  channels=(${channels})
  approval_modes=(${approvalModes})
  if [[ "\${words[CURRENT-1]}" == "--channel" ]]; then
    _describe 'channel' channels
    return
  fi
  if [[ "\${words[CURRENT-1]}" == "--approval-mode" ]]; then
    _describe 'approval mode' approval_modes
    return
  fi
  if [[ "\${words[CURRENT]}" == -* ]]; then
    _describe 'flag' flags
    return
  fi
  _describe 'command' commands
}
compdef _zavorth zavorth
`;
    case 'fish':
      return `# Zavorth fish completion
set -l commands ${commands}
set -l flags ${flags}
set -l channels ${channels}
set -l approval_modes ${approvalModes}
complete -c zavorth -f
for cmd in $commands
  complete -c zavorth -n "not __fish_seen_subcommand_from $commands" -a $cmd
end
for flag in $flags
  complete -c zavorth -l (string replace -- '--' '' $flag)
end
complete -c zavorth -n "__fish_seen_argument --channel" -a "$channels"
complete -c zavorth -n "__fish_seen_argument --approval-mode" -a "$approval_modes"
`;
    case 'powershell':
      return `# Zavorth PowerShell completion
Register-ArgumentCompleter -Native -CommandName zavorth -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = '${commands}'.Split(' ')
  $flags = '${flags}'.Split(' ')
  $channels = '${channels}'.Split(' ')
  $approvalModes = '${approvalModes}'.Split(' ')
  $tokens = $commandAst.CommandElements | ForEach-Object { $_.ToString() }
  $previous = if ($tokens.Count -gt 1) { $tokens[$tokens.Count - 2] } else { '' }
  $source = if ($previous -eq '--channel') { $channels } elseif ($previous -eq '--approval-mode') { $approvalModes } elseif ($wordToComplete -like '-*') { $flags } else { $commands }
  $source |
    Where-Object { $_ -like "$wordToComplete*" } |
    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
`;
  }
}

function parseCompletionArgs(args: string): { shell: ZavorthCompletionShell | null; install: boolean; profile: boolean; yes: boolean } {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const shell = tokens.find((token): token is ZavorthCompletionShell =>
    (ZAVORTH_COMPLETION_SHELLS as readonly string[]).includes(token));
  return {
    shell: shell || null,
    install: tokens.includes('--install'),
    profile: !tokens.includes('--no-profile'),
    yes: tokens.includes('--yes') || tokens.includes('-y'),
  };
}

function renderCompletionHelp(): string {
  return [
    'Zavorth shell completions',
    '',
    'Usage:',
    '  zavorth completions bash',
    '  zavorth completions zsh',
    '  zavorth completions fish',
    '  zavorth completions powershell',
    '',
    'Optional install:',
    '  zavorth completions powershell --install --yes',
    '  zavorth completions bash --install --yes',
    '',
    'Install is opt-in. Use --no-profile to write the completion file without editing a shell profile.',
  ].join('\n');
}

function installCompletion(shell: ZavorthCompletionShell, script: string, options: { profile: boolean; yes: boolean }): { ok: boolean; shell: ZavorthCompletionShell; path: string; profilePath?: string; profileUpdated: boolean; message: string } {
  const home = process.env.USERPROFILE || process.env.HOME || process.cwd();
  const target = shell === 'powershell'
    ? path.join(home, 'Documents', 'PowerShell', 'Zavorth.Completions.ps1')
    : path.join(home, '.zavorth', 'completions', `zavorth.${shell}`);
  const profilePath = resolveShellProfilePath(shell, home);
  if (!options.yes) {
    return {
      ok: true,
      shell,
      path: target,
      profilePath: options.profile ? profilePath : undefined,
      profileUpdated: false,
      message: `Completion install preview for ${shell}. Re-run with --yes to write files.`,
    };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, script, 'utf8');
  let profileUpdated = false;
  if (options.profile && profilePath) {
    fs.mkdirSync(path.dirname(profilePath), { recursive: true });
    const snippet = shellProfileSnippet(shell, target);
    const current = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf8') : '';
    if (!current.includes(snippet.trim())) {
      fs.writeFileSync(profilePath, `${current}${current.endsWith('\n') || !current ? '' : '\n'}${snippet}`, 'utf8');
      profileUpdated = true;
    }
  }
  return {
    ok: true,
    shell,
    path: target,
    profilePath: options.profile ? profilePath : undefined,
    profileUpdated,
    message: `Completion script installed for ${shell}${profileUpdated ? ' and shell profile updated' : ''}.`,
  };
}

function renderInstallResult(result: { shell: ZavorthCompletionShell; path: string; profilePath?: string; profileUpdated: boolean; message: string }): string {
  return [
    result.message,
    `path: ${result.path}`,
    result.profilePath ? `profile: ${result.profilePath}` : '',
    `profile updated: ${String(result.profileUpdated)}`,
    '',
    result.shell === 'powershell'
      ? `Add this to your PowerShell profile: . "${result.path}"`
      : `Add this to your shell profile: source "${result.path}"`,
  ].filter(Boolean).join('\n');
}

function resolveShellProfilePath(shell: ZavorthCompletionShell, home: string): string {
  if (shell === 'powershell') return process.env.PROFILE || path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  if (shell === 'fish') return path.join(home, '.config', 'fish', 'conf.d', 'zavorth.fish');
  if (shell === 'zsh') return path.join(home, '.zshrc');
  return path.join(home, '.bashrc');
}

function shellProfileSnippet(shell: ZavorthCompletionShell, target: string): string {
  if (shell === 'powershell') return `\n# Zavorth completions\n. "${target}"\n`;
  if (shell === 'fish') return `\n# Zavorth completions\nsource "${target}"\n`;
  return `\n# Zavorth completions\nsource "${target}"\n`;
}
