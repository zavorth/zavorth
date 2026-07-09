/**
 * Reach Fabric CLI
 *
 *   zavorth reach
 *   zavorth reach channels
 *   zavorth reach doctor <channel>
 *   zavorth reach synthesize <channel-id> [--notes "..."] [--apply --consent]
 *   zavorth reach nodes
 *   zavorth reach pair [--node-id x] [--profile desktop-companion]
 *   zavorth reach invoke-preview --node <id> --capability files.read
 */

import { UniversalReachFabricService } from '../services/UniversalReachFabricService.js';
import type { ReachChannelFamily } from '../contracts/UniversalReachFabricContract.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readOption(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  const pref = `${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function help(): void {
  console.log([
    '=== Zavorth Reach Fabric ===',
    '',
    'Honest channel tiers + expandable packs + node mesh product surface.',
    'Catalog is never live. Tier C is never live without proof.',
    '',
    'Usage:',
    '  zavorth reach                         # inventory snapshot',
    '  zavorth reach channels [--tier A|B|C]',
    '  zavorth reach doctor <channel-id>',
    '  zavorth reach synthesize <id> [--label name] [--notes "..."] [--family webhook]',
    '  zavorth reach synthesize <id> --apply --consent',
    '  zavorth reach nodes',
    '  zavorth reach capabilities',
    '  zavorth reach pair [--node-id id] [--profile desktop-companion]',
    '  zavorth reach invoke-preview --node <id> --capability <cap>',
    '  zavorth reach --json',
    '',
  ].join('\n'));
}

export async function runReachFabricCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    help();
    return 0;
  }

  const service = new UniversalReachFabricService({ projectRoot: process.cwd() });
  const json = hasFlag(rawArgs, '--json');
  const sub = String(rawArgs[0] || 'status').trim().toLowerCase();
  const rest = rawArgs.slice(1);

  if (!rawArgs.length || sub === 'status' || sub === 'inventory') {
    const snap = service.buildSnapshot({ includeSynthesisDrafts: true });
    if (json) {
      console.log(JSON.stringify(snap, null, 2));
      return 0;
    }
    console.log(snap.narrative.headline);
    console.log(snap.narrative.operatorSummary);
    console.log(`Status: ${snap.status}`);
    console.log('');
    console.log('Channels by tier:');
    for (const tier of ['A', 'B', 'C'] as const) {
      const rows = snap.channels.filter((c) => c.tier === tier);
      console.log(`  Tier ${tier}: ${rows.length} (live-ready ${rows.filter((r) => r.liveReady).length})`);
    }
    console.log(`Nodes: ${snap.summary.nodesTotal} (ready ${snap.summary.nodesReady}, reapproval ${snap.summary.nodesNeedReapproval})`);
    console.log('');
    console.log(`Next: ${snap.narrative.nextSafeAction}`);
    return 0;
  }

  if (sub === 'channels' || sub === 'channel') {
    const tierFilter = (readOption(rest, '--tier') || '').toUpperCase();
    const snap = service.buildSnapshot({ includeSynthesisDrafts: true });
    let rows = snap.channels;
    if (tierFilter === 'A' || tierFilter === 'B' || tierFilter === 'C') {
      rows = rows.filter((c) => c.tier === tierFilter);
    }
    if (json) {
      console.log(JSON.stringify(rows, null, 2));
      return 0;
    }
    console.log(`Channels (${rows.length}):`);
    for (const c of rows) {
      const flag = c.liveReady ? 'LIVE' : c.configured ? 'CFG' : c.readiness.toUpperCase();
      console.log(`  [T${c.tier}/${flag}] ${c.id.padEnd(16)} ${c.label} — ${c.defaultBlockReason || 'routeable'}`);
    }
    return 0;
  }

  if (sub === 'doctor') {
    const channelId = rest.find((a) => !a.startsWith('--')) || '';
    if (!channelId) {
      console.log('Usage: zavorth reach doctor <channel-id>');
      return 1;
    }
    const result = service.doctorChannel(channelId);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return result.entry ? 0 : 1;
    }
    if (!result.entry) {
      console.log(result.receipt.summary);
      return 1;
    }
    console.log(`Doctor: ${result.entry.id} (Tier ${result.entry.tier})`);
    console.log(`Configured: ${result.entry.configured}`);
    console.log(`Live-ready: ${result.entry.liveReady} (proof=${result.entry.proof})`);
    console.log(`Missing env: ${result.entry.missingEnvKeys.join(', ') || 'none'}`);
    if (result.doctor) {
      for (const step of result.doctor.steps) {
        console.log(`  [${step.ok ? 'ok' : '--'}] ${step.detail}`);
      }
      console.log(`Next: ${result.doctor.nextSafeAction}`);
    }
    return 0;
  }

  if (sub === 'synthesize' || sub === 'synth' || sub === 'generate-channel') {
    const channelId = rest.find((a) => !a.startsWith('--')) || readOption(rest, '--id') || '';
    if (!channelId) {
      console.log('Usage: zavorth reach synthesize <channel-id> [--notes "..."] [--apply --consent]');
      return 1;
    }
    const apply = hasFlag(rest, '--apply') && (hasFlag(rest, '--consent') || hasFlag(rest, '--yes'));
    if (hasFlag(rest, '--apply') && !hasFlag(rest, '--consent') && !hasFlag(rest, '--yes')) {
      console.log('Apply requires --consent. Running preview.\n');
    }
    const family = (readOption(rest, '--family') || 'synthesized') as ReachChannelFamily;
    const result = service.synthesizeChannel({
      channelId,
      label: readOption(rest, '--label') || channelId,
      notes: readOption(rest, '--notes') || rest.filter((a) => !a.startsWith('--') && a !== channelId).join(' '),
      family,
      apply,
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    console.log(result.receipt.summary);
    console.log(`Channel: ${result.draft.channelId}`);
    console.log(`Family: ${result.draft.family}`);
    console.log(`Trust: ${result.draft.trustState}`);
    console.log(`Live-ready: false (always until proof)`);
    console.log(`Env: ${result.draft.requiredEnvKeys.join(', ') || 'none'}`);
    if (apply) {
      console.log(`Pack: ${result.draft.packDir}`);
      console.log(`Files: ${result.filesWritten.join(', ')}`);
    } else {
      console.log('Next: re-run with --apply --consent to quarantine the pack.');
    }
    return 0;
  }

  if (sub === 'nodes' || sub === 'node') {
    const snap = service.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snap.nodes, null, 2));
      return 0;
    }
    if (!snap.nodes.length) {
      console.log('No nodes registered yet.');
      console.log('Next: zavorth reach pair --node-id desktop-1');
      return 0;
    }
    console.log(`Nodes (${snap.nodes.length}):`);
    for (const n of snap.nodes) {
      console.log(`  [${n.status}] ${n.nodeId} · paired=${n.paired} · invoke=${n.canInvoke} · ${n.nextSafeAction}`);
    }
    return 0;
  }

  if (sub === 'capabilities' || sub === 'caps') {
    const caps = service.listNodeCapabilities();
    if (json) {
      console.log(JSON.stringify(caps, null, 2));
      return 0;
    }
    console.log('Node capability taxonomy:');
    for (const c of caps) {
      console.log(`  [${c.family}/${c.risk}] ${c.id} — ${c.label}${c.requiresApproval ? ' (approval)' : ''}`);
    }
    return 0;
  }

  if (sub === 'pair' || sub === 'pairing') {
    const result = service.createNodePairingDraft({
      nodeId: readOption(rest, '--node-id') || readOption(rest, '--node') || undefined,
      profileId: readOption(rest, '--profile') || undefined,
      label: readOption(rest, '--label') || undefined,
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    console.log(result.receipt.summary);
    console.log(`Node: ${result.draft.nodeId}`);
    console.log(`Profile: ${result.draft.profileId}`);
    console.log(`Pairing code: ${result.draft.pairingCode}`);
    console.log(`Capabilities: ${result.draft.capabilityIds.join(', ')}`);
    console.log('');
    console.log('Bootstrap:');
    console.log(`  ${result.draft.bootstrapCommand}`);
    console.log('Companion:');
    console.log(`  ${result.draft.companionCommand}`);
    return 0;
  }

  if (sub === 'invoke-preview' || sub === 'preview-invoke') {
    const nodeId = readOption(rest, '--node') || readOption(rest, '--node-id') || '';
    const capabilityId = readOption(rest, '--capability') || readOption(rest, '--cap') || '';
    if (!nodeId || !capabilityId) {
      console.log('Usage: zavorth reach invoke-preview --node <id> --capability <cap>');
      return 1;
    }
    const result = service.previewNodeInvoke({
      nodeId,
      capabilityId,
      action: readOption(rest, '--action') || 'invoke',
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return result.preview.allowed ? 0 : 1;
    }
    console.log(result.receipt.summary);
    console.log(`Allowed: ${result.preview.allowed}`);
    console.log(`Risk: ${result.preview.risk}`);
    console.log(`Approval required: ${result.preview.requiresApproval}`);
    console.log(`Reason: ${result.preview.reason}`);
    return result.preview.allowed ? 0 : 1;
  }

  help();
  return 1;
}
