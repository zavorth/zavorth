import { TerminalPanel } from '../presentation/TerminalPanel.js';
import { TerminalTheme } from '../presentation/TerminalTheme.js';
import { ZavorthInspectService, type ZavorthInspectRuntimeOverlay, type ZavorthInspectSnapshot } from '../../services/ZavorthInspectService.js';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags, ZavorthCliRuntime } from '../ZavorthCliContract.js';

export async function handleZavorthInspectCommand(input: {
  commandName: string | null;
  args: string;
  flags: ZavorthCliFlags;
  writer: CliWriter;
  resolveRuntime?: () => Promise<ZavorthCliRuntime>;
}): Promise<CliExecutionResult | null> {
  if (input.commandName !== 'inspect') {
    return null;
  }

  const parsed = parseInspectArgs(input.args);
  const runtimeOverlay = parsed.live || input.flags.live
    ? await buildRuntimeOverlay(input.resolveRuntime)
    : null;
  const snapshot = new ZavorthInspectService().buildSnapshot({ runtime: runtimeOverlay });
  const body = input.flags.json
    ? JSON.stringify(snapshot, null, 2)
    : renderInspectSnapshot(snapshot, { live: Boolean(runtimeOverlay) });

  input.writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function parseInspectArgs(args: string): { live: boolean } {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  return {
    live: tokens.includes('--live'),
  };
}

async function buildRuntimeOverlay(resolveRuntime?: () => Promise<ZavorthCliRuntime>): Promise<ZavorthInspectRuntimeOverlay | null> {
  if (!resolveRuntime) {
    return null;
  }
  try {
    const runtime = await resolveRuntime();
    const gatewaySnapshot = runtime.agentGateway?.buildSnapshot?.({ runLimit: 20 } as any) as any;
    const runs = Array.isArray(gatewaySnapshot?.runs) ? gatewaySnapshot.runs : [];
    const pendingApprovals = runs
      .flatMap((run: any) => Array.isArray(run?.approvals) ? run.approvals : [])
      .filter((approval: any) => String(approval?.status || 'pending') === 'pending')
      .map((approval: any) => ({ id: String(approval?.id || ''), status: String(approval?.status || 'pending') }));
    const receiptIds = runs
      .flatMap((run: any) => Array.isArray(run?.receipts) ? run.receipts : [])
      .map((receipt: any) => String(receipt?.id || receipt || ''))
      .filter(Boolean);
    return { pendingApprovals, receiptIds };
  } catch {
    return null;
  }
}

function renderInspectSnapshot(snapshot: ZavorthInspectSnapshot, options: { live: boolean }): string {
  const lines = [
    TerminalTheme.colors.primary(TerminalTheme.format.bold('Zavorth Inspect')),
    TerminalTheme.colors.muted(`generated: ${snapshot.generatedAt}`),
    TerminalTheme.colors.muted(`mode: ${options.live ? 'live runtime enriched' : 'static workspace scan'}`),
    '',
    section('Provider', [
      row('Provider', snapshot.provider.id),
      row('Model', snapshot.provider.model),
      row('Configured', snapshot.provider.configured ? 'yes' : 'no'),
      row('Route', snapshot.provider.routeId || 'default'),
      row('Family', snapshot.provider.familyId || 'default'),
      ...snapshot.provider.credentialRefs.map((entry) => statusRow(entry.label, entry.status, entry.detail)),
    ]),
    section('Workspace', [
      row('Root', snapshot.workspace.root),
      row('Package', `${snapshot.workspace.packageName}@${snapshot.workspace.packageVersion}`),
      statusRow(snapshot.workspace.git.label, snapshot.workspace.git.status, snapshot.workspace.git.detail),
      row('Package scripts', String(snapshot.skills.packageScripts)),
      row('Skill dirs', snapshot.skills.localSkillDirectories.join(', ') || 'none found'),
    ]),
    section('Instructions', snapshot.instructions.length
      ? snapshot.instructions.map((entry) => statusRow(entry.label, entry.status, entry.detail))
      : [statusRow('Instructions', 'attention', 'No README/AGENTS-style instruction file detected.')]),
    section('Surfaces', [
      ...snapshot.channels.map((entry) => statusRow(entry.label, entry.status, entry.detail)),
    ]),
    section('Plugins / MCP / Hooks', [
      ...snapshot.plugins.map((entry) => statusRow(entry.label, entry.status, entry.detail)),
      ...snapshot.mcp.map((entry) => statusRow(entry.label, entry.status, entry.detail)),
      ...snapshot.hooks.map((entry) => statusRow(entry.label, entry.status, entry.detail)),
    ]),
    section('Mnemos / Trust / Receipts', [
      statusRow(snapshot.mnemos.label, snapshot.mnemos.status, snapshot.mnemos.detail),
      ...snapshot.trust.map((entry) => statusRow(entry.label, entry.status, entry.detail)),
      row('Pending approvals', `${snapshot.pendingApprovals.count}${snapshot.pendingApprovals.ids.length ? ` (${snapshot.pendingApprovals.ids.join(', ')})` : ''}`),
      row('Recent receipts', `${snapshot.receipts.known}${snapshot.receipts.recentIds.length ? ` (${snapshot.receipts.recentIds.join(', ')})` : ''}`),
    ]),
    section('Next Actions', snapshot.nextActions.map((action) => `${TerminalTheme.colors.primary('>')} ${action}`)),
  ];

  return TerminalPanel.render(lines.join('\n'), { title: 'Zavorth Inspect', type: snapshot.provider.configured ? 'info' : 'warning' });
}

function section(title: string, rows: string[]): string {
  return [
    TerminalTheme.colors.primary(TerminalTheme.format.bold(title)),
    ...rows,
    '',
  ].join('\n');
}

function row(label: string, value: string): string {
  return `${TerminalTheme.colors.muted(label.padEnd(18))} ${value}`;
}

function statusRow(label: string, status: 'ready' | 'attention' | 'offline', detail: string): string {
  const color = status === 'ready'
    ? TerminalTheme.colors.success
    : status === 'offline'
      ? TerminalTheme.colors.error
      : TerminalTheme.colors.warning;
  return `${TerminalTheme.colors.muted(label.padEnd(18))} ${color(status.padEnd(9))}  ${detail}`;
}
