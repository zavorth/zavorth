/**
 * Power Fabric CLI
 *
 *   zavorth power
 *   zavorth power backends
 *   zavorth power plan --backend modal --command "npm test"
 *   zavorth power trusted on|off
 *   zavorth power learn observe "..."
 *   zavorth power learn list
 *   zavorth power learn promote <id> --consent
 *   zavorth power harness list|register
 *   zavorth power context
 */

import { UniversalPowerFabricService } from '../services/UniversalPowerFabricService.js';
import type { PowerBackendId } from '../contracts/UniversalPowerFabricContract.js';

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
    '=== Zavorth Power Fabric ===',
    '',
    'Elastic execution · Trusted Operator · Learning promote · Harnesses · Context budget',
    '',
    'Usage:',
    '  zavorth power',
    '  zavorth power backends',
    '  zavorth power plan --backend local|docker|modal|daytona --command "..."',
    '  zavorth power trusted on|off [--note "..."]',
    '  zavorth power decide --description "..." [--mutation] [--risk low|medium|high]',
    '  zavorth power learn observe "preference or workflow text"',
    '  zavorth power learn list',
    '  zavorth power learn promote <id> --consent',
    '  zavorth power harness list',
    '  zavorth power harness register --label name [--command "..."]',
    '  zavorth power context [--tools N] [--skill-bytes N]',
    '  zavorth power --json',
    '',
  ].join('\n'));
}

export async function runPowerFabricCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    help();
    return 0;
  }

  const service = new UniversalPowerFabricService({ projectRoot: process.cwd() });
  const json = hasFlag(rawArgs, '--json');
  const sub = String(rawArgs[0] || 'status').trim().toLowerCase();
  const rest = rawArgs.slice(1);

  if (!rawArgs.length || sub === 'status' || sub === 'inventory') {
    const snap = service.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snap, null, 2));
      return 0;
    }
    console.log(snap.narrative.headline);
    console.log(snap.narrative.operatorSummary);
    console.log(`Status: ${snap.status}`);
    console.log(`Elastic profile: ${snap.elasticProfile}`);
    console.log(`Trusted Operator: ${snap.trustedOperator.enabled ? 'ON' : 'OFF'}`);
    console.log('');
    console.log('Backends:');
    for (const b of snap.backends) {
      console.log(`  [${b.posture}] ${b.id.padEnd(16)} elastic=${b.elastic} liveReady=${b.liveReady}`);
    }
    console.log('');
    console.log(`Yellow candidates: ${snap.summary.yellowCandidates}`);
    console.log(`Next: ${snap.narrative.nextSafeAction}`);
    return 0;
  }

  if (sub === 'backends' || sub === 'backend') {
    const snap = service.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snap.backends, null, 2));
      return 0;
    }
    for (const b of snap.backends) {
      console.log(`[${b.posture}] ${b.id} — ${b.label}`);
      console.log(`  next: ${b.nextSafeAction}`);
      if (b.requiresConfiguration.length) {
        console.log(`  needs: ${b.requiresConfiguration.join('; ')}`);
      }
    }
    return 0;
  }

  if (sub === 'plan') {
    const backend = (readOption(rest, '--backend') || 'local') as PowerBackendId;
    const command = readOption(rest, '--command') || rest.filter((a) => !a.startsWith('--')).join(' ') || null;
    const out = service.planBackend({ backend, command: command || undefined });
    if (json) {
      console.log(JSON.stringify(out, null, 2));
      return 0;
    }
    console.log(out.receipt.summary);
    console.log(`Backend: ${out.snapshot.selectedBackend}`);
    console.log(`Plan mode: ${out.snapshot.plan.mode}`);
    console.log(`Display: ${out.snapshot.plan.displayCommand || 'n/a'}`);
    console.log(`Reason: ${out.snapshot.plan.reason}`);
    console.log('Live mutation remains off until --live + approval + env gate.');
    return 0;
  }

  if (sub === 'trusted' || sub === 'trust') {
    const mode = String(rest[0] || '').toLowerCase();
    if (mode === 'on' || mode === 'enable' || mode === 'off' || mode === 'disable') {
      const out = service.setTrustedOperator({
        enabled: mode === 'on' || mode === 'enable',
        note: readOption(rest, '--note'),
        updatedBy: 'cli',
      });
      if (json) {
        console.log(JSON.stringify(out, null, 2));
        return 0;
      }
      console.log(out.receipt.summary);
      console.log(`Red lane intact: ${out.state.redLaneIntact}`);
      console.log(`Receipts always: ${out.state.receiptsAlways}`);
      return 0;
    }
    const state = service.buildSnapshot().trustedOperator;
    if (json) {
      console.log(JSON.stringify(state, null, 2));
      return 0;
    }
    console.log(`Trusted Operator: ${state.enabled ? 'ON' : 'OFF'}`);
    console.log(`Updated: ${state.updatedAt || 'never'}`);
    console.log(state.note || '');
    return 0;
  }

  if (sub === 'decide') {
    const description = readOption(rest, '--description') || rest.filter((a) => !a.startsWith('--')).join(' ');
    const risk = (readOption(rest, '--risk') || 'medium') as 'low' | 'medium' | 'high' | 'critical';
    const decision = service.decideTrusted({
      description,
      risk,
      mutation: hasFlag(rest, '--mutation'),
      trustedFolder: !hasFlag(rest, '--untrusted-folder'),
    });
    if (json) {
      console.log(JSON.stringify(decision, null, 2));
      return decision.autoApprove ? 0 : 1;
    }
    console.log(`Lane: ${decision.lane}`);
    console.log(`Auto-approve: ${decision.autoApprove}`);
    console.log(`Reason: ${decision.reason}`);
    return decision.autoApprove ? 0 : 1;
  }

  if (sub === 'learn' || sub === 'learning') {
    const action = String(rest[0] || 'list').toLowerCase();
    const args = rest.slice(1);
    if (action === 'observe') {
      const observation = readOption(args, '--text') || args.filter((a) => !a.startsWith('--')).join(' ');
      if (!observation) {
        console.log('Usage: zavorth power learn observe "text"');
        return 1;
      }
      const out = await service.observeLearning({ observation });
      if (json) {
        console.log(JSON.stringify({ staged: out.staged, receipt: out.receipt }, null, 2));
        return 0;
      }
      console.log(out.receipt.summary);
      for (const c of out.staged) {
        console.log(`  staged [${c.kind}] ${c.id} — ${c.title}`);
      }
      return 0;
    }
    if (action === 'list') {
      const snap = service.buildSnapshot();
      if (json) {
        console.log(JSON.stringify(snap.learning.yellowCandidates, null, 2));
        return 0;
      }
      if (!snap.learning.yellowCandidates.length) {
        console.log('No staged Yellow candidates.');
        return 0;
      }
      for (const c of snap.learning.yellowCandidates) {
        console.log(`[${c.status}/${c.kind}] ${c.id} — ${c.title}`);
      }
      return 0;
    }
    if (action === 'promote') {
      const id = args.find((a) => !a.startsWith('--')) || '';
      if (!id) {
        console.log('Usage: zavorth power learn promote <id> --consent');
        return 1;
      }
      const consent = hasFlag(args, '--consent') || hasFlag(args, '--yes');
      const out = service.promoteLearning({
        candidateId: id,
        consent,
        previewOnly: !consent,
      });
      if (json) {
        console.log(JSON.stringify(out, null, 2));
        return out.receipt.status === 'deny' ? 1 : 0;
      }
      console.log(out.receipt.summary);
      if (out.materialPath) console.log(`Material: ${out.materialPath}`);
      if (!consent) console.log('Next: re-run with --consent to promote.');
      return out.receipt.status === 'deny' ? 1 : 0;
    }
    console.log('Usage: zavorth power learn observe|list|promote');
    return 1;
  }

  if (sub === 'harness' || sub === 'harnesses') {
    const action = String(rest[0] || 'list').toLowerCase();
    const args = rest.slice(1);
    if (action === 'register') {
      const label = readOption(args, '--label') || args.find((a) => !a.startsWith('--')) || '';
      if (!label) {
        console.log('Usage: zavorth power harness register --label name [--command "..."]');
        return 1;
      }
      const out = service.registerHarness({
        label,
        id: readOption(args, '--id') || undefined,
        commandOrEndpoint: readOption(args, '--command') || readOption(args, '--endpoint'),
        notes: readOption(args, '--notes') ? [readOption(args, '--notes')!] : undefined,
      });
      if (json) {
        console.log(JSON.stringify(out, null, 2));
        return 0;
      }
      console.log(out.receipt.summary);
      console.log(`Status: ${out.adapter.status}`);
      return 0;
    }
    const snap = service.buildSnapshot();
    if (json) {
      console.log(JSON.stringify(snap.harnesses, null, 2));
      return 0;
    }
    for (const h of snap.harnesses) {
      console.log(`[${h.status}/${h.kind}] ${h.id} — ${h.label}`);
    }
    return 0;
  }

  if (sub === 'context' || sub === 'budget') {
    const out = service.contextSnapshot({
      visibleToolCount: Number(readOption(rest, '--tools') || 0) || undefined,
      skillBytesInPrompt: Number(readOption(rest, '--skill-bytes') || 0) || undefined,
    });
    if (json) {
      console.log(JSON.stringify(out.snapshot, null, 2));
      return 0;
    }
    console.log(`Max tools: ${out.snapshot.maxVisibleTools}`);
    console.log(`Max skill bytes: ${out.snapshot.maxSkillBytesInPrompt}`);
    console.log(`Est. tool tokens: ${out.snapshot.estimatedToolSchemaBudgetTokens}`);
    console.log(`Est. skill tokens: ${out.snapshot.estimatedSkillBudgetTokens}`);
    for (const r of out.snapshot.recommendations) console.log(`- ${r}`);
    return 0;
  }

  help();
  return 1;
}
