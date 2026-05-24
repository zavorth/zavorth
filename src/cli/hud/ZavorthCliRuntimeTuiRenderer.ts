import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliAction,
  type ZavorthPremiumCliPanel,
  type ZavorthPremiumCliStatusRow,
} from '../premium/index.js';
import type { ZavorthCliRuntimeTuiItem, ZavorthCliRuntimeTuiSnapshot, ZavorthCliRuntimeTuiStatus } from './ZavorthCliRuntimeTuiTypes.js';

export function renderZavorthCliRuntimeTui(snapshot: ZavorthCliRuntimeTuiSnapshot): string {
  const panels: ZavorthPremiumCliPanel[] = [
    {
      title: 'Runtime Connection',
      accent: snapshot.status === 'ready' ? 'emerald' : snapshot.status === 'blocked' ? 'rose' : 'amber',
      lines: renderPremiumKeyValueTable([
        row(snapshot.connection.gateway.label, snapshot.connection.gateway.value, snapshot.connection.gateway.status, snapshot.connection.gateway.detail),
        row(snapshot.connection.daemon.label, snapshot.connection.daemon.value, snapshot.connection.daemon.status, snapshot.connection.daemon.detail),
        row(snapshot.connection.dashboard.label, snapshot.connection.dashboard.value, snapshot.connection.dashboard.status, snapshot.connection.dashboard.detail),
      ]).split('\n'),
    },
    {
      title: 'Chat',
      accent: 'cyan',
      lines: snapshot.chat.recent.length ? renderItems(snapshot.chat.recent) : ['No chat/message records yet.'],
    },
    {
      title: 'Timeline',
      accent: 'violet',
      lines: snapshot.timeline.length ? renderItems(snapshot.timeline) : ['No runtime events yet.'],
    },
    {
      title: 'Tools',
      accent: 'emerald',
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'MCP servers', value: `${snapshot.tools.mcpServers}` },
          { key: 'MCP tools', value: `${snapshot.tools.mcpTools}` },
          { key: 'Skills', value: `${snapshot.tools.skills}` },
          { key: 'Plugins', value: `${snapshot.tools.plugins}` },
        ]).split('\n'),
        '',
        ...(snapshot.tools.items.length ? renderItems(snapshot.tools.items) : ['No enabled tools/skills/plugins recorded.']),
      ],
    },
    {
      title: 'Approvals',
      accent: snapshot.approvals.pending > 0 ? 'amber' : 'emerald',
      lines: snapshot.approvals.items.length ? renderItems(snapshot.approvals.items) : ['No pending approvals.'],
    },
    {
      title: 'Diff Preview',
      accent: snapshot.diffs.length ? 'amber' : 'cyan',
      lines: snapshot.diffs.length ? renderItems(snapshot.diffs) : ['No diff previews available.'],
    },
    {
      title: 'Channels',
      accent: 'cyan',
      lines: renderItems(snapshot.channels),
    },
    {
      title: 'Sessions',
      accent: 'violet',
      lines: snapshot.sessions.length ? renderItems(snapshot.sessions) : ['No local sessions recorded.'],
    },
    {
      title: 'Logs',
      accent: 'amber',
      lines: snapshot.logs.length ? renderItems(snapshot.logs) : ['No log files found.'],
    },
  ];

  return renderZavorthPremiumCliScreen({
    title: 'Runtime TUI',
    subtitle: 'Gateway, chat, timeline, tools, approvals, logs, channels, sessions, diff and status in one governed terminal view.',
    mode: 'hero',
    statusRows: buildStatusRows(snapshot),
    panels,
    actions: buildActions(snapshot),
    notice: {
      title: 'Runtime safety',
      body: 'This TUI is a read-only runtime control view. Sensitive actions still require explicit approve/diff commands and receipts.',
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
    accent: shortcut.key === 'a' || shortcut.key === 'd' ? 'amber' : shortcut.key === 'o' ? 'emerald' : 'cyan',
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
