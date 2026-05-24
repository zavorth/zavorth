import { TerminalPanel } from '../presentation/TerminalPanel.js';
import { TerminalTimeline } from '../presentation/TerminalTimeline.js';
import { ZavorthReleaseChannelService, type ZavorthUpdatePlan, type ZavorthVersionSnapshot } from './ZavorthReleaseChannelService.js';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags } from '../ZavorthCliContract.js';

export async function handleZavorthUpdateCommand(input: {
  commandName: string | null;
  args: string;
  flags: ZavorthCliFlags;
  writer: CliWriter;
}): Promise<CliExecutionResult | null> {
  if (input.commandName !== 'update' && input.commandName !== 'version') {
    return null;
  }

  const parsed = parseUpdateArgs(input.args);
  const service = new ZavorthReleaseChannelService();

  if (input.commandName === 'version') {
    const snapshot = service.buildVersionSnapshot(parsed.channel);
    const body = input.flags.json
      ? JSON.stringify(snapshot, null, 2)
      : renderVersion(snapshot);
    input.writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const plan = service.buildUpdatePlan(parsed);
  if (parsed.artifact && plan.artifact && parsed.yes) {
    const artifact = service.verifyArtifact({ url: plan.artifact.url, sha256: plan.artifact.sha256 });
    plan.artifact = { ...plan.artifact, verified: artifact.ok, downloadedPath: artifact.path };
    if (!artifact.ok) {
      plan.ok = false;
      plan.applied = false;
      plan.message = artifact.message;
    }
  }
  const body = input.flags.json
    ? JSON.stringify(plan, null, 2)
    : renderUpdatePlan(plan);
  input.writer.line(body);
  return { ok: plan.ok, handled: true, output: [body], error: plan.ok ? null : plan.message };
}

function parseUpdateArgs(args: string): { channel?: string | null; yes?: boolean; manifest?: string | null; artifact?: boolean } {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  return {
    channel: readFlag(tokens, 'channel') || tokens.find((token) => ['stable', 'beta', 'nightly', 'dev'].includes(token)) || null,
    yes: tokens.includes('--yes') || tokens.includes('-y'),
    manifest: readFlag(tokens, 'manifest'),
    artifact: tokens.includes('--artifact'),
  };
}

function readFlag(tokens: string[], name: string): string | null {
  const inlinePrefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(inlinePrefix));
  if (inline) {
    return inline.slice(inlinePrefix.length).trim() || null;
  }
  const index = tokens.indexOf(`--${name}`);
  return index >= 0 ? String(tokens[index + 1] || '').trim() || null : null;
}

function renderVersion(snapshot: ZavorthVersionSnapshot): string {
  const rows = snapshot.channels
    .map((channel) => `${channel.id.padEnd(7)} ${channel.npmTag.padEnd(8)} ${channel.risk.padEnd(6)} ${channel.checksum.slice(0, 12)}`)
    .join('\n');
  return TerminalPanel.render([
    `${snapshot.packageName}@${snapshot.currentVersion}`,
    `current channel: ${snapshot.channel}`,
    `manifest checksum: ${snapshot.manifestChecksum.slice(0, 16)}`,
    '',
    'channels',
    'channel tag      risk   checksum',
    rows,
  ].join('\n'), { title: 'Zavorth Version', type: 'info' });
}

function renderUpdatePlan(plan: ZavorthUpdatePlan): string {
  const timeline = TerminalTimeline.render([
    { title: `Resolve channel ${plan.channel.id}`, detail: `${plan.channel.label} / npm tag ${plan.channel.npmTag}`, status: 'success' },
    { title: 'Verify release checksum marker', detail: plan.checksum, status: 'success' },
    {
      title: plan.applied ? 'Apply update' : 'Preview update command',
      detail: plan.command,
      status: plan.applied ? 'success' : 'pending',
    },
  ]);
  return TerminalPanel.render([
    plan.message,
    '',
    `package: ${plan.packageSpec}`,
    `risk: ${plan.channel.risk}`,
    `checksum: ${plan.checksum}`,
    `manifest: ${plan.manifestSource}`,
    `manifest checksum: ${plan.manifestChecksum}`,
    plan.artifact ? `artifact: ${plan.artifact.url}` : 'artifact: npm package',
    plan.artifact?.verified !== undefined ? `artifact verified: ${String(plan.artifact.verified)}` : '',
    '',
    timeline,
    '',
    plan.applied ? 'Update was applied.' : `To apply: zavorth update --channel ${plan.channel.id} --yes`,
  ].join('\n'), {
    title: plan.applied ? 'Zavorth Update Applied' : 'Zavorth Update Preview',
    type: plan.ok ? 'info' : 'error',
  });
}
