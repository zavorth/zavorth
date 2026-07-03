import {
  buildTerminalShellSnapshot,
  formatTerminalShellScreen,
  type TerminalShellCard,
  type TerminalShellMessage,
  type TerminalShellQueuedItem,
  type TerminalShellReceipt,
} from '../ZavorthCliTerminalShell.js';
import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliAction,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatusRow,
} from '../premium/index.js';
import type { ZavorthCliRuntimeTuiItem, ZavorthCliRuntimeTuiSnapshot, ZavorthCliRuntimeTuiStatus } from './ZavorthCliRuntimeTuiTypes.js';

export type ZavorthCliRuntimeTuiRenderOptions = {
  mode?: 'daily' | 'technical';
};

export function renderZavorthCliRuntimeTui(
  snapshot: ZavorthCliRuntimeTuiSnapshot,
  options: ZavorthCliRuntimeTuiRenderOptions = {},
): string {
  if (options.mode === 'technical') {
    return renderZavorthCliRuntimeTechnicalTui(snapshot);
  }
  return renderZavorthCliRuntimeDailyShell(snapshot);
}

function renderZavorthCliRuntimeTerminalShell(snapshot: ZavorthCliRuntimeTuiSnapshot): string {
  const activeRun = snapshot.goalLoop.running > 0 || snapshot.tasks.running > 0;
  const messages: TerminalShellMessage[] = snapshot.chat.recent.length
    ? snapshot.chat.recent.slice(0, 4).reverse().map((item) => ({
      role: 'assistant',
      text: `${item.title}: ${item.detail}`,
    }))
    : [{
      role: 'assistant',
      text: snapshot.status === 'ready'
        ? 'Ready for a new request.'
        : `${labelForStatus(snapshot.status)}. ${snapshot.agentKernel.missing[0] || 'Check setup when you have a minute.'}`,
    }];
  const cards: TerminalShellCard[] = [
    ...snapshot.approvals.items.slice(0, 3).map((item) => ({
      kind: 'approval' as const,
      title: item.title,
      status: item.status,
      body: item.detail,
      command: item.id ? `zavorth approve ${item.id}` : 'zavorth approve',
    })),
    ...snapshot.diffs.slice(0, 2).map((item) => ({
      kind: 'diff' as const,
      title: item.title,
      status: item.status,
      body: item.detail,
      command: item.id ? `zavorth diff ${item.id}` : 'zavorth diff',
    })),
    ...snapshot.timeline.slice(0, 2).map((item) => ({
      kind: 'status' as const,
      title: item.title,
      status: item.status,
      body: item.detail,
    })),
  ];
  const queue: TerminalShellQueuedItem[] = snapshot.tasks.items
    .filter((item) => item.status === 'queued' || item.status === 'running')
    .slice(0, 4)
    .map((item, index) => ({
      id: item.id || `task-${index + 1}`,
      text: item.title,
      kind: 'message',
      status: item.status === 'running' ? 'ready' : 'queued',
    }));
  const receipts: TerminalShellReceipt[] = [
    ...snapshot.capabilityActions.items.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
    })),
    ...snapshot.logs.slice(0, 2).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
    })),
  ];
  return formatTerminalShellScreen(buildTerminalShellSnapshot({
    mode: 'daily',
    sessionId: snapshot.sessions[0]?.id || 'main',
    profileId: snapshot.agentKernel.profile,
    providerLabel: snapshot.agentKernel.provider || 'auto',
    modelLabel: snapshot.agentKernel.model || 'auto',
    activeRun,
    messages,
    cards,
    receipts,
    queue,
    voiceArmed: snapshot.voice.mode !== 'off',
  }));
}

function renderZavorthCliRuntimeDailyShell(snapshot: ZavorthCliRuntimeTuiSnapshot): string {
  return renderZavorthCliRuntimeTerminalShell(snapshot);
  const provider = snapshot.agentKernel.model && snapshot.agentKernel.model !== 'not configured'
    ? snapshot.agentKernel.model
    : snapshot.agentKernel.provider || 'auto';
  const readyChannels = snapshot.channels.filter((channel) => channel.status === 'ready').length;
  const latest = [
    ...snapshot.chat.recent.slice(0, 2),
    ...snapshot.timeline.slice(0, 3),
    ...snapshot.logs.slice(0, 2),
  ].slice(0, 5);
  const activeWork = snapshot.goalLoop.running > 0
    ? `${snapshot.goalLoop.running} goal continuation(s) running`
    : snapshot.tasks.running > 0
      ? `${snapshot.tasks.running} task(s) running`
      : 'No active work';
  const approvalState = snapshot.approvals.pending > 0
    ? `${snapshot.approvals.pending} waiting`
    : 'none waiting';
  const setupState = snapshot.agentKernel.missing.length
    ? snapshot.agentKernel.missing.slice(0, 2).join('; ')
    : 'ready';
  const lines = [
    'Zavorth Terminal Shell',
    `${labelForStatus(snapshot.status)} · profile ${snapshot.agentKernel.profile} · provider ${provider}`,
    '',
    'Ask Zavorth',
    '  zavorth chat "review this workspace"',
    '  zavorth tui --technical        show full runtime diagnostics',
    '',
    'Now',
    `  Work       ${activeWork}`,
    `  Approvals  ${approvalState}`,
    `  Channels   ${readyChannels}/${snapshot.channels.length} ready`,
    `  Voice      ${snapshot.voice.mode}`,
    `  Setup      ${setupState}`,
    '',
    'Quick actions',
    '  p  Open chat              zavorth chat',
    '  a  Review approvals       zavorth approve',
    '  t  Show tasks             zavorth tasks list',
    '  m  Search memory          zavorth mnemos recall',
    '  v  Voice wake status      zavorth echo wake status',
    '  c  Check channels         zavorth channels status',
    '',
    'Latest',
    ...(latest.length ? latest.flatMap(renderDailyItem) : ['  Nothing recorded yet.']),
    '',
    'Low-risk maintenance stays quiet. Risky changes still show preview, approval and receipt.',
  ];
  return lines.join('\n');
}

function renderZavorthCliRuntimeTechnicalTui(snapshot: ZavorthCliRuntimeTuiSnapshot): string {
  const latestChat = snapshot.chat.recent.slice(0, 4);
  const latestTimeline = snapshot.timeline.slice(0, 5);
  const pendingApprovals = snapshot.approvals.items.slice(0, 5);
  const diffPreview = snapshot.diffs.slice(0, 5);
  const integrationItems = [
    ...snapshot.tools.items.slice(0, 4),
    ...snapshot.channels.filter((channel) => channel.status === 'ready').slice(0, 4),
  ];
  const sessionLogItems = [
    ...snapshot.sessions.slice(0, 4),
    ...snapshot.logs.slice(0, 4),
  ];
  const taskItems = snapshot.tasks.items.slice(0, 5);
  const sandboxItems = snapshot.sandbox.items.slice(0, 4);
  const capabilityActionItems = snapshot.capabilityActions.items.slice(0, 4);
  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: 'Today',
      accent: snapshot.status === 'ready' ? 'emerald' : snapshot.status === 'blocked' ? 'rose' : 'amber',
      dense: true,
      lines: [
        snapshot.chat.total > 0
          ? `${snapshot.chat.total} chat record(s) available.`
          : 'Start with: zavorth chat',
        snapshot.approvals.pending > 0
          ? `${snapshot.approvals.pending} governed action(s) need review.`
          : 'No governed action is waiting right now.',
        snapshot.goalLoop.running > 0 || snapshot.goalLoop.queued > 0
          ? `Goal Loop: ${snapshot.goalLoop.queued} queued, ${snapshot.goalLoop.running} running.`
          : snapshot.goalLoop.lines[0] || 'Goal Loop idle.',
        snapshot.status === 'ready'
          ? 'Zavorth looks ready for daily work.'
          : snapshot.status === 'blocked'
            ? 'Zavorth needs attention before normal work.'
            : 'Zavorth is usable, with a few setup items to review.',
        `Agent Kernel: ${snapshot.agentKernel.status} / ${snapshot.agentKernel.profile} / ${snapshot.agentKernel.intent}.`,
      ],
    },
    {
      title: 'Daily product',
      accent: snapshot.dailyProduct.status === 'ready' ? 'emerald' : snapshot.dailyProduct.status === 'blocked' ? 'rose' : 'amber',
      dense: true,
      lines: [
        snapshot.dailyProduct.headline,
        '',
        ...renderPremiumKeyValueTable([
          { key: 'Primary surface', value: snapshot.dailyProduct.primarySurface },
          { key: 'Visible tabs', value: snapshot.dailyProduct.visibleTabs.join(', ') },
          { key: 'Quiet autonomy', value: snapshot.dailyProduct.quietMode },
          { key: 'Silent', value: snapshot.dailyProduct.silentLanes.slice(0, 5).join(', ') || 'none' },
          { key: 'Digest', value: snapshot.dailyProduct.digestLanes.slice(0, 4).join(', ') || 'none' },
          { key: 'Approval', value: snapshot.dailyProduct.approvalBoundaries.slice(0, 5).join(', ') || 'none' },
        ]).split('\n'),
      ],
    },
    {
      title: 'Agent Kernel',
      accent: snapshot.agentKernel.status === 'blocked' ? 'rose' : snapshot.agentKernel.status === 'ready' ? 'emerald' : 'amber',
      dense: true,
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'Profile', value: snapshot.agentKernel.profile },
          { key: 'Provider', value: snapshot.agentKernel.provider },
          { key: 'Model', value: snapshot.agentKernel.model },
          { key: 'Intent route', value: snapshot.agentKernel.intent },
          { key: 'Quiet autonomy', value: snapshot.agentKernel.quietAutonomy },
          { key: 'Performance samples', value: `${snapshot.agentKernel.performanceSamples}` },
        ]).split('\n'),
        '',
        ...(snapshot.agentKernel.missing.length
          ? snapshot.agentKernel.missing.slice(0, 3).map((item) => `- ${item}`)
          : ['No critical kernel setup item.']),
      ],
    },
    {
      title: 'Chat & Timeline',
      accent: 'cyan',
      lines: [
        ...(latestChat.length ? renderItems(latestChat) : ['No chat records yet.']),
        '',
        ...(latestTimeline.length ? renderItems(latestTimeline) : ['No runtime events yet.']),
      ],
    },
    {
      title: 'Approvals & Diff',
      accent: snapshot.approvals.pending > 0 ? 'amber' : 'emerald',
      lines: [
        ...(pendingApprovals.length ? renderItems(pendingApprovals) : ['No pending approvals.']),
        '',
        ...(diffPreview.length ? renderItems(diffPreview) : ['No diff previews available.']),
      ],
    },
    {
      title: 'Goal Loop',
      accent: snapshot.goalLoop.status === 'active' ? 'emerald' : snapshot.goalLoop.queued > 0 ? 'amber' : 'cyan',
      dense: true,
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'Daemon', value: snapshot.goalLoop.status },
          { key: 'Current', value: snapshot.goalLoop.current },
          { key: 'Queued', value: `${snapshot.goalLoop.queued}` },
          { key: 'Running', value: `${snapshot.goalLoop.running}` },
          { key: 'Next tick', value: snapshot.goalLoop.nextRunAfter || 'waiting' },
        ]).split('\n'),
        '',
        ...snapshot.goalLoop.lines.slice(0, 3),
      ],
    },
    {
      title: 'Connection',
      accent: 'violet',
      dense: true,
      lines: renderPremiumKeyValueTable([
        row(snapshot.connection.gateway.label, snapshot.connection.gateway.value, snapshot.connection.gateway.status, snapshot.connection.gateway.detail),
        row(snapshot.connection.daemon.label, snapshot.connection.daemon.value, snapshot.connection.daemon.status, snapshot.connection.daemon.detail),
        row(snapshot.connection.zavorthControl.label, snapshot.connection.zavorthControl.value, snapshot.connection.zavorthControl.status, snapshot.connection.zavorthControl.detail),
        row('Home', snapshot.home.isolated ? 'isolated' : 'compat', snapshot.home.isolated ? 'ready' : 'warning', `${snapshot.home.source}: ${snapshot.home.migrationStatus}`),
        row('Voice', snapshot.voice.mode, snapshot.voice.mode === 'off' ? 'warning' : 'ready', snapshot.voice.configured ? snapshot.voice.detector : 'no detector configured'),
      ]).split('\n'),
    },
    {
      title: 'Tasks',
      accent: snapshot.tasks.waitingApproval > 0 ? 'amber' : 'cyan',
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'Total', value: `${snapshot.tasks.total}` },
          { key: 'Queued', value: `${snapshot.tasks.queued}` },
          { key: 'Running', value: `${snapshot.tasks.running}` },
          { key: 'Waiting approval', value: `${snapshot.tasks.waitingApproval}` },
        ]).split('\n'),
        '',
        ...(taskItems.length ? renderItems(taskItems) : ['No persistent tasks recorded yet.']),
      ],
    },
    {
      title: 'Voice & Sandbox',
      accent: snapshot.voice.mode === 'off' && snapshot.sandbox.strongProfilesReady === 0 ? 'amber' : 'emerald',
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'Wake mode', value: snapshot.voice.mode },
          { key: 'Armed until', value: snapshot.voice.armedUntil || 'off' },
          { key: 'Detector', value: snapshot.voice.configured ? snapshot.voice.detector : 'not configured' },
          { key: 'Sandbox posture', value: snapshot.sandbox.posture },
          { key: 'Strong profiles', value: `${snapshot.sandbox.strongProfilesReady}` },
          { key: 'Preferred profile', value: snapshot.sandbox.preferredProfile },
        ]).split('\n'),
        '',
        ...(sandboxItems.length ? renderItems(sandboxItems) : ['Sandbox is preview-only on this host.']),
      ],
    },
    {
      title: 'Integrations',
      accent: 'emerald',
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'MCP servers', value: `${snapshot.tools.mcpServers}` },
          { key: 'MCP tools', value: `${snapshot.tools.mcpTools}` },
          { key: 'Skills', value: `${snapshot.tools.skills}` },
          { key: 'Plugins', value: `${snapshot.tools.plugins}` },
          { key: 'Ready channels', value: `${snapshot.channels.filter((channel) => channel.status === 'ready').length}/${snapshot.channels.length}` },
        ]).split('\n'),
        '',
        ...(integrationItems.length ? renderItems(integrationItems) : ['No live integrations recorded yet.']),
      ],
    },
    {
      title: 'Capability actions',
      accent: snapshot.capabilityActions.status === 'attention' ? 'amber' : 'emerald',
      dense: true,
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'Available', value: `${snapshot.capabilityActions.exposed}` },
          { key: 'Receipts', value: `${snapshot.capabilityActions.receipts}` },
          { key: 'Activation', value: 'preview + approval' },
        ]).split('\n'),
        '',
        ...(capabilityActionItems.length ? renderItems(capabilityActionItems) : ['No verified capability action is exposed yet.']),
      ],
    },
    {
      title: 'Sessions',
      accent: 'amber',
      lines: sessionLogItems.length ? renderItems(sessionLogItems) : ['No local sessions or logs recorded yet.'],
    },
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Daily terminal',
    subtitle: 'Chat, approvals, tasks, voice, channels, sandbox and logs in one keyboard view.',
    mode: 'compact',
    statusRows: buildStatusRows(snapshot),
    panels,
    actions: buildActions(snapshot),
    notice: {
      title: 'Safety',
      body: 'Sensitive work still goes through preview, approval and evidence before anything important changes.',
    },
  });
}

function labelForStatus(status: ZavorthCliRuntimeTuiStatus): string {
  if (status === 'ready') return 'Ready';
  if (status === 'blocked') return 'Needs attention';
  return 'Partially ready';
}

function renderDailyItem(item: ZavorthCliRuntimeTuiItem): string[] {
  return [
    `  ${item.status}  ${item.title}`,
    `      ${item.detail}`,
  ];
}

function buildStatusRows(snapshot: ZavorthCliRuntimeTuiSnapshot): ZavorthPremiumCliStatusRow[] {
  return [
    { label: 'Runtime', value: snapshot.status, status: toPremiumStatus(snapshot.status) },
    { label: 'Kernel', value: snapshot.agentKernel.status, status: toPremiumStatus(toRuntimeStatus(snapshot.agentKernel.status)) },
    { label: 'Daily', value: snapshot.dailyProduct.status, status: toPremiumStatus(toRuntimeStatus(snapshot.dailyProduct.status)) },
    { label: 'Gateway', value: snapshot.connection.gateway.value, status: toPremiumStatus(snapshot.connection.gateway.status) },
    { label: 'Home', value: snapshot.home.isolated ? 'isolated' : 'compat', status: snapshot.home.isolated ? 'ready' : 'warning' },
    { label: 'Voice', value: snapshot.voice.mode, status: snapshot.voice.mode === 'off' ? 'warning' : 'ready' },
    { label: 'Goal Loop', value: snapshot.goalLoop.status, status: snapshot.goalLoop.status === 'active' ? 'ready' : snapshot.goalLoop.queued > 0 ? 'waiting' : 'warning' },
    { label: 'Tasks', value: `${snapshot.tasks.total}`, status: snapshot.tasks.waitingApproval > 0 ? 'waiting' : 'ready' },
    { label: 'Approvals', value: `${snapshot.approvals.pending}`, status: snapshot.approvals.pending > 0 ? 'waiting' : 'ready' },
    { label: 'Chat', value: `${snapshot.chat.total}`, status: snapshot.chat.total > 0 ? 'ready' : 'warning' },
    { label: 'Tools', value: `${snapshot.tools.mcpTools + snapshot.tools.skills + snapshot.tools.plugins}`, status: snapshot.tools.items.length ? 'ready' : 'warning' },
    { label: 'Capabilities', value: `${snapshot.capabilityActions.exposed}`, status: snapshot.capabilityActions.status === 'attention' ? 'warning' : 'ready' },
  ];
}

function buildActions(snapshot: ZavorthCliRuntimeTuiSnapshot): ZavorthPremiumCliAction[] {
  return snapshot.shortcuts.map((shortcut) => ({
    label: `[${shortcut.key}] ${shortcut.label}`,
    command: shortcut.command,
    detail: shortcut.detail,
    accent: shortcut.key === 'a' || shortcut.key === 'd' || shortcut.key === 'g' ? 'amber' : shortcut.key === 'o' || shortcut.key === 'p' ? 'emerald' : 'cyan',
  }));
}

function renderItems(items: ZavorthCliRuntimeTuiItem[]): string[] {
  return items.flatMap((item) => [
    `${item.status.padEnd(14)} ${item.title}`,
    `  ${item.detail}`,
  ]);
}

function row(key: string, value: string, status: ZavorthCliRuntimeTuiStatus, detail?: string) {
  return {
    key: detail ? `${key} (${detail})` : key,
    value,
    accent: status === 'ready' ? 'emerald' : status === 'blocked' ? 'rose' : 'amber',
  } as const;
}

function toPremiumStatus(status: ZavorthCliRuntimeTuiStatus): 'ready' | 'warning' | 'blocked' {
  if (status === 'ready') return 'ready';
  if (status === 'blocked') return 'blocked';
  return 'warning';
}

function toRuntimeStatus(status: string): ZavorthCliRuntimeTuiStatus {
  if (status === 'ready' || status === 'blocked') return status;
  return 'warning';
}
