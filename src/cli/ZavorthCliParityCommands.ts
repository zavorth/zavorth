export type ZavorthCliParityCommand = {
  name: string;
  summary: string;
  usage: string;
  description: string;
  options?: string[];
  commands?: Array<[string, string]>;
  examples?: Array<[string, string]>;
  docs?: string;
  status?: 'ready' | 'prepared';
};

const BORDER_WIDTH = 86;

const COMMANDS: ZavorthCliParityCommand[] = [
  { name: 'acp', summary: 'Run and manage ACP-backed coding agents.', usage: 'zavorth acp [command]', description: 'Bridge ACP-compatible coding agents through Zavorth governance.', status: 'ready', commands: [['status', 'Inspect ACP readiness.'], ['run', 'Run an ACP-backed task when configured.']], examples: [['zavorth acp status', 'Inspect ACP integration readiness.']] },
  { name: 'actions', summary: 'Lookup, preview and apply first-class Zavorth actions.', usage: 'zavorth actions [lookup|preview|apply|receipts]', description: 'Natural Action Harness gateway for governed configuration and operational changes.', status: 'ready', commands: [['list', 'List registered actions.'], ['lookup', 'Find an action from natural language.'], ['preview', 'Preview a state change.'], ['apply', 'Apply with approval or trusted operator confirmation.']], examples: [['zavorth actions lookup "mude skill governance para governed"', 'Find the canonical action.'], ['zavorth actions preview --id skills.governance.set --args-json {"mode":"governed"}', 'Preview a governed change.']] },
  { name: 'agent', summary: 'Run one governed agent turn.', usage: 'zavorth agent [options]', description: 'Run a single LLM-first turn through the local harness.', status: 'ready', options: ['--json           Output JSON when supported'], commands: [['run', 'Run a task.'], ['import', 'Import/migrate an external agent profile.']], examples: [['zavorth agent run "summarize this repo"', 'Run one governed turn.']] },
  { name: 'agents', summary: 'Manage isolated agents, workspaces and routing.', usage: 'zavorth agents [command]', description: 'Inspect and manage agent profiles, imports and routing boundaries.', status: 'ready', commands: [['import', 'Import another agent profile.'], ['gateway', 'Inspect external agent gateway state.'], ['onboarding', 'Run external agent onboarding.']], examples: [['zavorth agents import', 'Start a governed migration/import flow.']] },
  { name: 'approvals', summary: 'Manage governed approvals.', usage: 'zavorth approvals [command]', description: 'Review, approve, reject or inspect governed actions.', status: 'ready', commands: [['list', 'Show pending approvals.'], ['diff', 'Inspect a related sandbox diff.'], ['policy', 'Manage persistent approval preferences.']], examples: [['zavorth approvals', 'Show pending approvals.'], ['zavorth approve <id> --yes', 'Approve a plan only.']] },
  { name: 'backup', summary: 'Create and verify local state backups.', usage: 'zavorth backup [command]', description: 'Prepare local backup and verification flows for Zavorth state, evidence and config.', status: 'prepared', commands: [['create', 'Create a local backup archive.'], ['verify', 'Verify a backup archive.'], ['list', 'List known backups.']], examples: [['zavorth backup create', 'Create a governed backup when configured.']] },
  { name: 'capability', summary: 'Run ability and provider ability commands.', usage: 'zavorth capability [command]', description: 'Inspect provider, tool, media, search and embedding abilities.', status: 'ready', commands: [['catalog', 'Show ability catalog.'], ['doctor', 'Diagnose ability readiness.'], ['infer', 'Route to provider-backed ability commands.']], examples: [['zavorth capability catalog', 'Inspect available abilities.']] },
  { name: 'channels', summary: 'Add, inspect and configure messaging channels.', usage: 'zavorth channels [command]', description: 'Configure Telegram, Discord, Slack, email and other chat channels.', status: 'ready', commands: [['add', 'Add or update a channel.'], ['status', 'Show readiness.'], ['list', 'List available channels.']], examples: [['zavorth channels telegram', 'Configure Telegram ChatOps.']] },
  { name: 'chat', summary: 'Open the terminal conversation UI.', usage: 'zavorth chat', description: 'Talk with Zavorth in the terminal.', status: 'ready', examples: [['zavorth chat', 'Start terminal conversation.']] },
  { name: 'certify', summary: 'Certify operational readiness across channels, gateway, plugins, QA and onboarding.', usage: 'zavorth certify [options]', description: 'Run a no-secret, no-network certification pass over the native Zavorth control plane.', status: 'ready', options: ['--json           Output JSON', '--strict         Exit non-zero unless every domain passes'], examples: [['zavorth certify', 'Show operational parity certification.'], ['zavorth certify --json', 'Export certification snapshot.']] },
  { name: 'commitments', summary: 'List and manage inferred follow-up commitments.', usage: 'zavorth commitments [command]', description: 'Inspect follow-ups and operator commitments inferred from runs and evidence.', status: 'prepared', commands: [['list', 'List commitments.'], ['resolve', 'Resolve a commitment.']], examples: [['zavorth commitments list', 'Show pending follow-ups.']] },
  { name: 'completion', summary: 'Generate shell completion scripts.', usage: 'zavorth completion <shell>', description: 'Generate shell completions for bash, zsh, fish or PowerShell.', status: 'ready', commands: [['bash', 'Generate bash completion.'], ['zsh', 'Generate zsh completion.'], ['fish', 'Generate fish completion.'], ['powershell', 'Generate PowerShell completion.']], examples: [['zavorth completions powershell', 'Print PowerShell completions.']] },
  { name: 'completions', summary: 'Generate shell completion scripts.', usage: 'zavorth completions <shell>', description: 'Generate shell completions for bash, zsh, fish or PowerShell.', status: 'ready', commands: [['bash', 'Generate bash completion.'], ['zsh', 'Generate zsh completion.'], ['fish', 'Generate fish completion.'], ['powershell', 'Generate PowerShell completion.']], examples: [['zavorth completions powershell', 'Print PowerShell completions.']] },
  { name: 'config', summary: 'Non-interactive config helpers.', usage: 'zavorth config [command]', description: 'Inspect and update local configuration with preview-first behavior.', status: 'prepared', commands: [['get', 'Read a config key.'], ['set', 'Set a config key.'], ['unset', 'Remove a config key.'], ['file', 'Show config file path.'], ['validate', 'Validate config.']], examples: [['zavorth config validate', 'Validate local config.']] },
  { name: 'configure', summary: 'Interactive configuration.', usage: 'zavorth configure', description: 'Friendly alias for guided provider/channel/trust setup.', status: 'ready', examples: [['zavorth configure', 'Open QuickStart setup.']] },
  { name: 'cron', summary: 'Schedule and inspect background jobs.', usage: 'zavorth cron [command]', description: 'Prepare scheduled task inspection and background job management.', status: 'prepared', commands: [['list', 'List scheduled jobs.'], ['run', 'Run a scheduled job.'], ['doctor', 'Diagnose scheduling.']], examples: [['zavorth cron list', 'Show scheduled jobs when configured.']] },
  { name: 'daemon', summary: 'Manage the local runtime service.', usage: 'zavorth daemon [command]', description: 'Service-oriented alias for runtime start/status/log operations.', status: 'prepared', commands: [['start', 'Start local runtime service.'], ['stop', 'Stop local runtime service.'], ['status', 'Show service status.']], examples: [['zavorth daemon status', 'Inspect service state.']] },
  { name: 'dashboard', summary: 'Open the visual Dashboard.', usage: 'zavorth dashboard', description: 'Open the local visual control plane.', status: 'ready', examples: [['zavorth dashboard', 'Open Dashboard.']] },
  { name: 'devices', summary: 'Device pairing and token management.', usage: 'zavorth devices [command]', description: 'Prepare paired-device flows for mobile and remote operators.', status: 'prepared', commands: [['pair', 'Pair a device.'], ['list', 'List paired devices.'], ['revoke', 'Revoke a device.']], examples: [['zavorth devices list', 'Inspect paired devices.']] },
  { name: 'directory', summary: 'Lookup contact, peer and group IDs.', usage: 'zavorth directory [command]', description: 'Channel directory lookup for supported messaging surfaces.', status: 'prepared', commands: [['self', 'Show current channel identity.'], ['peers', 'List peers.'], ['groups', 'List groups.']], examples: [['zavorth directory self --channel telegram', 'Show current Telegram identity.']] },
  { name: 'dns', summary: 'DNS and discovery helpers.', usage: 'zavorth dns [command]', description: 'Discovery helper namespace for remote nodes and local network setup.', status: 'prepared', commands: [['status', 'Show DNS/discovery status.'], ['doctor', 'Diagnose discovery.']], examples: [['zavorth dns status', 'Inspect discovery status.']] },
  { name: 'docs', summary: 'Open or search local documentation.', usage: 'zavorth docs [query]', description: 'Find local docs and command references.', status: 'prepared', options: ['--json           Output JSON when supported'], examples: [['zavorth docs install', 'Search install docs.']] },
  { name: 'doctor', summary: 'Diagnose setup and suggest safe repairs.', usage: 'zavorth doctor [scope]', description: 'Diagnose provider, channel, runtime and security problems.', status: 'ready', commands: [['provider', 'Diagnose provider/model setup.'], ['channels', 'Diagnose channel setup.'], ['security', 'Run security checks.']], examples: [['zavorth doctor', 'Run normal diagnostics.']] },
  { name: 'exec-policy', summary: 'Show or synchronize execution policy.', usage: 'zavorth exec-policy [command]', description: 'Inspect requested shell/tool execution policy against host approvals.', status: 'prepared', commands: [['status', 'Show policy status.'], ['sync', 'Synchronize requested policy.']], examples: [['zavorth exec-policy status', 'Inspect execution policy.']] },
  { name: 'gateway', summary: 'Run, inspect and query the local gateway.', usage: 'zavorth gateway [command]', description: 'Inspect the Gateway Spine and runtime projection.', status: 'ready', commands: [['status', 'Show gateway status.'], ['sessions', 'List sessions.'], ['channels', 'Show channel projection.'], ['receipts', 'Show receipts.']], examples: [['zavorth gateway status', 'Inspect gateway state.']] },
  { name: 'health', summary: 'Fetch detailed local runtime health.', usage: 'zavorth health [options]', description: 'Alias-oriented health check for runtime and gateway readiness.', status: 'prepared', options: ['--json           Output JSON when supported'], examples: [['zavorth health', 'Show health projection.']] },
  { name: 'hooks', summary: 'Manage internal agent hooks.', usage: 'zavorth hooks [command]', description: 'Inspect or prepare automation hooks attached to agent events.', status: 'prepared', commands: [['list', 'List hooks.'], ['doctor', 'Diagnose hooks.'], ['run', 'Run a hook when configured.']], examples: [['zavorth hooks list', 'Show configured hooks.']] },
  { name: 'infer', summary: 'Run provider-backed model, media and search commands.', usage: 'zavorth infer [command]', description: 'Route model, image, audio, video, search and embedding abilities.', status: 'prepared', commands: [['text', 'Run text generation.'], ['image', 'Run image generation when configured.'], ['audio', 'Run audio when configured.'], ['video', 'Run video when configured.'], ['search', 'Run search.']], examples: [['zavorth infer search "latest TypeScript release"', 'Run governed search when configured.']] },
  { name: 'logs', summary: 'Inspect local runtime logs.', usage: 'zavorth logs [options]', description: 'Tail or inspect gateway/runtime logs with redaction.', status: 'prepared', options: ['--json           Output JSON when supported', '--tail           Follow logs when supported'], examples: [['zavorth logs --tail', 'Follow runtime logs.']] },
  { name: 'mcp', summary: 'Manage MCP configuration and bridges.', usage: 'zavorth mcp [command]', description: 'Inspect and prepare Model Context Protocol servers and channel bridges.', status: 'prepared', commands: [['list', 'List configured MCP servers.'], ['doctor', 'Diagnose MCP config.'], ['add', 'Add a server config.']], examples: [['zavorth mcp list', 'List MCP servers.']] },
  { name: 'message', summary: 'Send, read and manage channel messages.', usage: 'zavorth message [command]', description: 'Governed channel messaging through configured surfaces.', status: 'prepared', commands: [['send', 'Send a message when channel is configured.'], ['read', 'Read recent messages when permitted.'], ['status', 'Show message readiness.']], examples: [['zavorth message send --channel telegram --target @chat --message "Hi"', 'Send through a configured channel.']] },
  { name: 'migrate', summary: 'Import state from another agent system.', usage: 'zavorth migrate [command]', description: 'Governed migration/import namespace for external profiles and histories.', status: 'ready', commands: [['agent', 'Import an agent profile.'], ['preview', 'Preview migration.']], examples: [['zavorth migrate agent', 'Start migration preview.']] },
  { name: 'models', summary: 'List, scan and set model providers.', usage: 'zavorth models [command]', description: 'Inspect and configure model/provider readiness.', status: 'ready', commands: [['status', 'Show provider readiness.'], ['catalog', 'Show provider catalog.'], ['add', 'Configure provider.'], ['switch', 'Switch active model.']], examples: [['zavorth models status', 'Show provider status.']] },
  { name: 'node', summary: 'Run and manage the headless node host.', usage: 'zavorth node [command]', description: 'Prepare node-host service lifecycle commands.', status: 'prepared', commands: [['start', 'Start node host.'], ['status', 'Show node host status.'], ['stop', 'Stop node host.']], examples: [['zavorth node status', 'Inspect node host.']] },
  { name: 'nodes', summary: 'Pair nodes and run node-host commands.', usage: 'zavorth nodes [command]', description: 'Inspect and manage remote/local node pairing.', status: 'prepared', commands: [['pair', 'Pair a node.'], ['list', 'List nodes.'], ['run', 'Run a node command through policy.']], examples: [['zavorth nodes list', 'Show paired nodes.']] },
  { name: 'onboard', summary: 'Interactive onboarding.', usage: 'zavorth onboard [options]', description: 'First Light for workspace, auth, channels, Mnemos and trust.', status: 'ready', options: ['--dry-run        Preview setup without writing files', '--json           Output JSON when supported'], commands: [['conversation', 'Calibrate profile and tone.'], ['journey', 'Run guided first-run journey.'], ['legacy', 'Use the legacy setup path.']], examples: [['zavorth onboarding', 'Open guided onboarding.'], ['zavorth onboard --dry-run', 'Preview setup without writing files.']] },
  { name: 'onboarding', summary: 'Interactive onboarding.', usage: 'zavorth onboarding [options]', description: 'First Light for workspace, auth, channels, Mnemos and trust.', status: 'ready', options: ['--dry-run        Preview setup without writing files', '--json           Output JSON when supported'], commands: [['conversation', 'Calibrate profile and tone.'], ['journey', 'Run guided first-run journey.'], ['legacy', 'Use the legacy setup path.']], examples: [['zavorth onboarding', 'Open guided onboarding.'], ['zavorth onboard --dry-run', 'Preview setup without writing files.']] },
  { name: 'pairing', summary: 'Secure channel and device pairing.', usage: 'zavorth pairing [command]', description: 'Prepare inbound pairing approval flows.', status: 'prepared', commands: [['approve', 'Approve a pairing request.'], ['list', 'List pending pairings.'], ['revoke', 'Revoke a pairing.']], examples: [['zavorth pairing list', 'Show pending pairings.']] },
  { name: 'plugins', summary: 'Install, enable and inspect plugins.', usage: 'zavorth plugins [command]', description: 'Plugin management namespace with governed install/enable flows.', status: 'prepared', commands: [['list', 'List plugins.'], ['scaffold', 'Create a governed plugin package.'], ['install', 'Install a plugin.'], ['enable', 'Enable a plugin.'], ['disable', 'Disable a plugin.']], examples: [['zavorth plugins list', 'Inspect plugin state.'], ['zavorth plugins scaffold my-plugin', 'Preview a plugin SDK scaffold.']] },
  { name: 'proxy', summary: 'Run and inspect the debug proxy.', usage: 'zavorth proxy [command]', description: 'Prepare local debug proxy capture and inspection flows.', status: 'prepared', commands: [['start', 'Start proxy.'], ['status', 'Show proxy status.'], ['captures', 'Inspect captures.']], examples: [['zavorth proxy status', 'Inspect debug proxy.']] },
  { name: 'qr', summary: 'Generate mobile pairing setup codes.', usage: 'zavorth qr [command]', description: 'Prepare QR setup for mobile/channel pairing.', status: 'prepared', commands: [['pairing', 'Generate a pairing QR.'], ['status', 'Show QR setup readiness.']], examples: [['zavorth qr pairing', 'Generate pairing QR when configured.']] },
  { name: 'reset', summary: 'Reset local config or state safely.', usage: 'zavorth reset [scope]', description: 'Preview reset actions before touching local state.', status: 'prepared', options: ['--dry-run        Preview only', '--yes            Confirm destructive reset'], examples: [['zavorth reset --dry-run', 'Preview reset impact.']] },
  { name: 'sandbox', summary: 'Manage sandbox execution backends.', usage: 'zavorth sandbox [command]', description: 'Inspect sandbox backends, rehearsal state and validation runs.', status: 'ready', commands: [['status', 'Show sandbox readiness.'], ['backends', 'Inspect available backends.'], ['validate', 'Run validation when configured.']], examples: [['zavorth sandbox status', 'Show sandbox readiness.']] },
  { name: 'secrets', summary: 'Audit, apply and reload credentials.', usage: 'zavorth secrets [command]', description: 'SecretRef-backed credential audit and reload namespace.', status: 'prepared', commands: [['audit', 'Audit configured secrets.'], ['reload', 'Reload local secret references.'], ['doctor', 'Diagnose secrets.']], examples: [['zavorth secrets audit', 'Audit secret references without printing values.']] },
  { name: 'security', summary: 'Security tools and local config audits.', usage: 'zavorth security [command]', description: 'Run local safety, policy and pre-push security checks.', status: 'ready', commands: [['audit', 'Run security audit.'], ['prepush', 'Run security pre-push check.'], ['policy', 'Inspect policy.']], examples: [['zavorth security audit', 'Run a local security audit.']] },
  { name: 'sessions', summary: 'List stored conversation sessions.', usage: 'zavorth sessions [command]', description: 'Inspect conversation sessions, history and resumable work.', status: 'prepared', commands: [['list', 'List sessions.'], ['show', 'Show a session.'], ['resume', 'Resume a session.']], examples: [['zavorth sessions list', 'Show sessions.']] },
  { name: 'setup', summary: 'Initialize local config and workspace.', usage: 'zavorth setup [options]', description: 'First Light for provider, channels, Mnemos, workspace and trust.', status: 'ready', options: ['--dry-run        Preview setup without writing files', '--json           Output JSON when supported'], commands: [['legacy', 'Use the legacy setup path.'], ['conversation', 'Calibrate profile and tone.']], examples: [['zavorth setup', 'Open First Light.'], ['zavorth setup --dry-run', 'Preview setup without writing files.'], ['zavorth onboard --dry-run', 'Alias for setup preview.'], ['zavorth ready', 'Check whether setup is ready for daily use.'], ['zavorth start', 'Start or resume the local runtime.'], ['zavorth open', 'Open the visual dashboard.']] },
  { name: 'skills', summary: 'List, inspect and install skills.', usage: 'zavorth skills [command]', description: 'Skill catalog and readiness namespace.', status: 'ready', commands: [['list', 'List skills.'], ['inspect', 'Inspect a skill.'], ['install', 'Install a skill when configured.']], examples: [['zavorth skills list', 'List available skills.']] },
  { name: 'status', summary: 'Show runtime, channel, model and recent status.', usage: 'zavorth status [options]', description: 'Short readiness report for daily use.', status: 'ready', options: ['--json           Output JSON when supported'], examples: [['zavorth status', 'Show daily readiness.']] },
  { name: 'system', summary: 'System events, heartbeat and presence.', usage: 'zavorth system [command]', description: 'Inspect system events and runtime presence.', status: 'prepared', commands: [['events', 'Show system events.'], ['heartbeat', 'Show heartbeat.'], ['presence', 'Show presence.']], examples: [['zavorth system heartbeat', 'Inspect heartbeat.']] },
  { name: 'tasks', summary: 'Inspect durable background tasks and flows.', usage: 'zavorth tasks [command]', description: 'Background task, journey and durable workflow namespace.', status: 'prepared', commands: [['list', 'List tasks.'], ['show', 'Show task details.'], ['cancel', 'Cancel a task.']], examples: [['zavorth tasks list', 'List background tasks.']] },
  { name: 'terminal', summary: 'Open the terminal UI.', usage: 'zavorth terminal', description: 'Alias for the terminal conversation UI.', status: 'ready', examples: [['zavorth terminal', 'Open terminal UI.']] },
  { name: 'tui', summary: 'Open the terminal UI.', usage: 'zavorth tui', description: 'Terminal UI entrypoint for local operation.', status: 'ready', examples: [['zavorth tui', 'Open terminal UI.']] },
  { name: 'uninstall', summary: 'Uninstall local service/data with confirmation.', usage: 'zavorth uninstall [scope]', description: 'Preview uninstall actions before removing local data.', status: 'prepared', options: ['--dry-run        Preview only', '--yes            Confirm removal'], examples: [['zavorth uninstall --dry-run', 'Preview uninstall impact.']] },
  { name: 'update', summary: 'Update Zavorth and inspect channels.', usage: 'zavorth update [command]', description: 'Release channel and update management.', status: 'ready', commands: [['status', 'Show update channel status.'], ['--channel beta', 'Preview beta channel update.']], examples: [['zavorth update --channel beta', 'Preview beta update.']] },
  { name: 'webhooks', summary: 'Webhook helpers and integrations.', usage: 'zavorth webhooks [command]', description: 'Prepare inbound/outbound webhook integration helpers.', status: 'prepared', commands: [['list', 'List webhooks.'], ['add', 'Add webhook config.'], ['doctor', 'Diagnose webhooks.']], examples: [['zavorth webhooks list', 'Show configured webhooks.']] },
];

const COMMAND_BY_NAME = new Map(COMMANDS.map((command) => [command.name, command]));

const IMPLEMENTED_COMMANDS = new Set([
  'acp', 'actions', 'agent', 'agents', 'approvals', 'capability', 'channels', 'chat', 'completion',
  'certify', 'completions', 'configure', 'dashboard', 'doctor', 'gateway', 'migrate', 'models',
  'onboard', 'onboarding', 'sandbox', 'security', 'setup', 'skills', 'status', 'terminal', 'tui', 'update',
  'backup', 'commitments', 'config', 'cron', 'daemon', 'devices', 'directory', 'dns',
  'docs', 'exec-policy', 'health', 'hooks', 'infer', 'logs', 'mcp', 'message', 'node',
  'nodes', 'pairing', 'plugins', 'proxy', 'qr', 'reset', 'secrets', 'sessions', 'system',
  'tasks', 'uninstall', 'webhooks',
]);

export function getZavorthPublicCommandRows(): Array<[string, string]> {
  return COMMANDS.map((command) => [
    command.commands && command.commands.length > 0 ? `${command.name} *` : command.name,
    command.summary,
  ]);
}

export function resolveZavorthParityCommand(name: string): ZavorthCliParityCommand | undefined {
  return COMMAND_BY_NAME.get(String(name || '').trim().toLowerCase());
}

export function isZavorthParityCommand(name: string): boolean {
  return Boolean(resolveZavorthParityCommand(name));
}

export function isZavorthParityStubCommand(name: string): boolean {
  const command = resolveZavorthParityCommand(name);
  return Boolean(command && !IMPLEMENTED_COMMANDS.has(command.name));
}

export function formatZavorthParityHelp(name: string): string | null {
  const command = resolveZavorthParityCommand(name);
  if (!command) return null;
  return renderPremiumCommandHelp({
    title: `Zavorth ${command.name}`,
    usage: command.usage,
    description: command.description,
    options: ['-h, --help       Display help for command', ...(command.options || [])],
    commands: command.commands || [],
    examples: command.examples || [[`zavorth ${command.name}`, command.summary]],
    status: command.status === 'ready'
      ? 'wired to Zavorth runtime'
      : 'Zavorth-native namespace prepared; configure/adapter proof may be required',
    docs: command.docs || 'zavorth help reference',
  });
}

export function formatZavorthParityPreparedNotice(name: string, args: string[] = []): string | null {
  const command = resolveZavorthParityCommand(name);
  if (!command) return null;
  const attempted = [`zavorth ${command.name}`, ...args].join(' ').trim();
  return premiumBox(`Zavorth ${command.name}`, [
    command.summary,
    '',
    `Requested: ${attempted}`,
    '',
    'This command namespace is available in Zavorth, but this specific action still needs',
    'configuration, credentials, adapter proof evidence, or a dedicated backend before it',
    'can run live.',
    '',
    'Next:',
    `  zavorth ${command.name} --help`,
    '  zavorth doctor',
    '  zavorth native catalog',
  ]);
}

function renderPremiumCommandHelp(input: {
  title: string;
  usage: string;
  description: string;
  options: string[];
  commands: Array<[string, string]>;
  examples: Array<[string, string]>;
  status: string;
  docs: string;
}): string {
  const lines = [
    premiumBox(input.title, [`Usage: ${input.usage}`, '', input.description]),
    input.options.length ? premiumBox('Options', input.options) : '',
    input.commands.length
      ? premiumBox('Commands', input.commands.map(([command, description]) => `${command.padEnd(18)} ${description}`))
      : '',
    premiumBox('Examples', input.examples.flatMap(([command, description]) => [command, `  ${description}`])),
    premiumBox('Status', [input.status, `Docs: ${input.docs}`]),
  ].filter(Boolean);
  return lines.join('\n');
}

function premiumBox(title: string, lines: string[]): string {
  const cleanTitle = String(title || 'Zavorth').trim();
  const columns = Number(process.stdout?.columns || 0);
  const availableWidth = columns > 0 ? Math.max(48, Math.min(BORDER_WIDTH, columns - 4)) : BORDER_WIDTH;
  const panelWidth = Math.min(availableWidth, Math.max(44, cleanTitle.length + 8, ...lines.map((line) => visibleWidth(line) + 4)));
  return renderParityBox(cleanTitle, lines, panelWidth);
  const width = Math.min(BORDER_WIDTH, Math.max(44, cleanTitle.length + 8, ...lines.map((line) => visibleWidth(line) + 4)));
  const inner = width - 4;
  const titleText = ` ${cleanTitle} `;
  const top = `╭─${titleText}${'─'.repeat(Math.max(0, width - titleText.length - 3))}╮`;
  const body = lines.flatMap((line) => wrapLine(line, width - 4))
    .map((line) => `│ ${line.padEnd(inner)} │`);
  const bottom = `╰${'─'.repeat(width - 2)}╯`;
  return [top, ...body, bottom].join('\n');
}

function renderParityBox(title: string, lines: string[], width: number): string {
  const inner = width - 4;
  const titleText = ` ${title} `;
  const top = `╭${titleText}${'─'.repeat(Math.max(0, width - visibleWidth(titleText) - 2))}╮`;
  const body = lines.flatMap((line) => wrapLine(line, inner))
    .map((line) => `│ ${line.padEnd(inner)} │`);
  const bottom = `╰${'─'.repeat(width - 2)}╯`;
  return [top, ...body, bottom].join('\n');
}

function wrapLine(value: string, width: number): string[] {
  if (!value) return [''];
  if (visibleWidth(value) <= width) return [value];
  const words = value.split(/\s+/u);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (visibleWidth(next) > width && current) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

function visibleWidth(value: string): number {
  return String(value).replace(/\x1b\[[0-9;]*m/gu, '').length;
}
