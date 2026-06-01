import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliAction,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatusRow,
} from '../premium/index.js';
import type { ZavorthCliRuntimeTuiItem, ZavorthCliRuntimeTuiSnapshot, ZavorthCliRuntimeTuiStatus } from './ZavorthCliRuntimeTuiTypes.js';

export function renderZavorthCliRuntimeTui(snapshot: ZavorthCliRuntimeTuiSnapshot): string {
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
        snapshot.status === 'ready'
          ? 'Zavorth looks ready for daily work.'
          : snapshot.status === 'blocked'
            ? 'Zavorth needs attention before normal work.'
            : 'Zavorth is usable, with a few setup items to review.',
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
      title: 'Connection',
      accent: 'violet',
      dense: true,
      lines: renderPremiumKeyValueTable([
        row(snapshot.connection.gateway.label, snapshot.connection.gateway.value, snapshot.connection.gateway.status, snapshot.connection.gateway.detail),
        row(snapshot.connection.daemon.label, snapshot.connection.daemon.value, snapshot.connection.daemon.status, snapshot.connection.daemon.detail),
        row(snapshot.connection.dashboard.label, snapshot.connection.dashboard.value, snapshot.connection.dashboard.status, snapshot.connection.dashboard.detail),
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

function buildStatusRows(snapshot: ZavorthCliRuntimeTuiSnapshot): ZavorthPremiumCliStatusRow[] {
  return [
    { label: 'Runtime', value: snapshot.status, status: toPremiumStatus(snapshot.status) },
    { label: 'Gateway', value: snapshot.connection.gateway.value, status: toPremiumStatus(snapshot.connection.gateway.status) },
    { label: 'Home', value: snapshot.home.isolated ? 'isolated' : 'compat', status: snapshot.home.isolated ? 'ready' : 'warning' },
    { label: 'Voice', value: snapshot.voice.mode, status: snapshot.voice.mode === 'off' ? 'warning' : 'ready' },
    { label: 'Tasks', value: `${snapshot.tasks.total}`, status: snapshot.tasks.waitingApproval > 0 ? 'waiting' : 'ready' },
    { label: 'Approvals', value: `${snapshot.approvals.pending}`, status: snapshot.approvals.pending > 0 ? 'waiting' : 'ready' },
    { label: 'Chat', value: `${snapshot.chat.total}`, status: snapshot.chat.total > 0 ? 'ready' : 'warning' },
    { label: 'Tools', value: `${snapshot.tools.mcpTools + snapshot.tools.skills + snapshot.tools.plugins}`, status: snapshot.tools.items.length ? 'ready' : 'warning' },
  ];
}

function buildActions(snapshot: ZavorthCliRuntimeTuiSnapshot): ZavorthPremiumCliAction[] {
  return snapshot.shortcuts.map((shortcut) => ({
    label: `[${shortcut.key}] ${shortcut.label}`,
    command: shortcut.command,
    detail: shortcut.detail,
    accent: shortcut.key === 'a' || shortcut.key === 'd' ? 'amber' : shortcut.key === 'o' || shortcut.key === 'p' ? 'emerald' : 'cyan',
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
