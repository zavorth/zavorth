export function formatImportHelp(): string {
  return [
    'Usage: zavorth import [command]',
    '',
    'Import agent homes, packs, and skills.',
    '',
    'Examples:',
    '  zavorth import home <path>   Import an agent home',
    '  zavorth import pack <path>   Import a pack',
    '  zavorth import skills <id>   Import skills from a peer link',
    '',
    'See also: zavorth link',
  ].join('\n');
}

export function formatLinkHelp(): string {
  return [
    'Usage: zavorth link [command]',
    '',
    'Mediated full surface access for peer links.',
    '',
    'Examples:',
    '  zavorth link open <id>      Open a peer link',
    '  zavorth link use <id>       Use a tool from a peer link',
    '  zavorth link ask <id>       Ask a peer link',
    '  zavorth link sync <id>      Sync with a peer link',
  ].join('\n');
}

export function resolveImportIntent(args: string[]): any {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { kind: 'help' };
  }
  const cmd = args[0];
  if (cmd === 'home') {
    const pathArg = args[1] || '';
    const smart = args.includes('--smart');
    const json = args.includes('--json');
    return { kind: 'home', path: pathArg, smart, json };
  }
  if (cmd === 'pack') {
    return { kind: 'pack', path: args[1] || '' };
  }
  if (cmd === 'skills') {
    const linkId = args[1] || '';
    const consent = args.includes('--consent');
    return { kind: 'skills', linkId, consent };
  }
  return { kind: 'help' };
}

export function resolveLinkIntent(args: string[]): any {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { kind: 'help' };
  }
  const cmd = args[0];
  const rest = args.slice(1);
  const live = rest.includes('--live');
  const approve = rest.includes('--approve');
  const mirror = rest.includes('--mirror');
  const consent = rest.includes('--consent');

  if (cmd === 'open') {
    return { kind: 'open', linkId: rest[0] || '', live, approve };
  }
  if (cmd === 'use') {
    return { kind: 'use', linkId: rest[0] || '', toolName: rest[1] || '', approve };
  }
  if (cmd === 'ask') {
    const linkId = rest[0] || '';
    const promptParts = rest.slice(1).filter((a: string) => !a.startsWith('--'));
    return { kind: 'ask', linkId, prompt: promptParts.join(' '), approve };
  }
  if (cmd === 'sync') {
    return { kind: 'sync', linkId: rest[0] || '', mirror, consent, live, approve };
  }
  if (cmd === 'find') {
    return { kind: 'find' };
  }
  if (cmd === 'add') {
    return { kind: 'add' };
  }
  if (cmd === 'list') {
    return { kind: 'list' };
  }
  return { kind: 'help' };
}
