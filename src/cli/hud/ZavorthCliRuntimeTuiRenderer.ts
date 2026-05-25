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
  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: 'Today',
      accent: snapshot.status === 'ready' ? 'emerald' : snapshot.status === 'blocked' ? 'rose' : 'amber',
      dense: true,
      lines: [
        snapshot.chat.total > 0
          ? `${snapshot.chat.total} chat/event record(s) available.`
          : 'Start with: zavorth chat',
        snapshot.approvals.pending > 0
          ? `${snapshot.approvals.pending} governed action(s) need review.`
          : 'No governed action is waiting right now.',
        snapshot.status === 'ready'
          ? 'Runtime looks ready for daily work.'
          : snapshot.status === 'blocked'
            ? 'Runtime needs attention before normal work.'
            : 'Runtime is usable, with a few setup items to review.',
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
      title: 'Runtime',
      accent: 'violet',
      dense: true,
      lines: renderPremiumKeyValueTable([
        row(snapshot.connection.gateway.label, snapshot.connection.gateway.value, snapshot.connection.gateway.status, snapshot.connection.gateway.detail),
        row(snapshot.connection.daemon.label, snapshot.connection.daemon.value, snapshot.connection.daemon.status, snapshot.connection.daemon.detail),
        row(snapshot.connection.dashboard.label, snapshot.connection.dashboard.value, snapshot.connection.dashboard.status, snapshot.connection.dashboard.detail),
      ]).split('\n'),
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
      title: 'Sessions & Logs',
      accent: 'amber',
      lines: sessionLogItems.length ? renderItems(sessionLogItems) : ['No local sessions or logs recorded yet.'],
    },
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Daily TUI',
    subtitle: 'Chat, timeline, approvals, diff, runtime, channels and logs in one governed terminal view.',
    mode: 'compact',
    statusRows: buildStatusRows(snapshot),
    panels,
    actions: buildActions(snapshot),
    notice: {
      title: 'TUI safety',
      body: 'This daily TUI is a governed control surface. It shows live state and routes actions; sensitive work still goes through preview, approval and receipts.',
    },
  });
}

function buildStatusRows(snapshot: ZavorthCliRuntimeTuiSnapshot): ZavorthPremiumCliStatusRow[] {
  return [
    { label: 'Runtime', value: snapshot.status, status: toPremiumStatus(snapshot.status) },
    { label: 'Gateway', value: snapshot.connection.gateway.value, status: toPremiumStatus(snapshot.connection.gateway.status) },
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
