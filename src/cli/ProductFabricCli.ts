/**
 * Product Fabric CLI
 *
 *   zavorth product
 *   zavorth product certify
 *   zavorth product doctor
 *   zavorth product first-run
 *   zavorth product commands [--group daily|capability|reach|power|ops]
 */

import { UniversalProductFabricService } from '../services/UniversalProductFabricService.js';
import type { ProductPublicCommand } from '../contracts/UniversalProductFabricContract.js';

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
    '=== Zavorth Product Fabric ===',
    '',
    'Daily product readiness, first-run path, public commands, hermetic certification.',
    '',
    'Usage:',
    '  zavorth product',
    '  zavorth product certify',
    '  zavorth product doctor',
    '  zavorth product first-run',
    '  zavorth product commands [--group daily|capability|reach|power|ops]',
    '  zavorth product --json',
    '',
    'Thesis: acquire capabilities on demand · expand reach honestly ·',
    'power elastic work under governance · prove every sensitive action.',
    '',
  ].join('\n'));
}

export async function runProductFabricCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    help();
    return 0;
  }

  const service = new UniversalProductFabricService({ projectRoot: process.cwd() });
  const json = hasFlag(rawArgs, '--json');
  const sub = String(rawArgs[0] || 'status').trim().toLowerCase();
  const rest = rawArgs.slice(1);

  if (!rawArgs.length || sub === 'status' || sub === 'inventory') {
    const snap = await service.buildSnapshot({ runCertification: false });
    if (json) {
      console.log(JSON.stringify(snap, null, 2));
      return 0;
    }
    console.log(snap.narrative.headline);
    console.log(snap.narrative.productThesis);
    console.log('');
    console.log(snap.narrative.operatorSummary);
    console.log(`Status: ${snap.status}`);
    console.log(`First-run: ${Math.round(snap.firstRun.progress * 100)}%`);
    console.log(`Next: ${snap.narrative.nextSafeAction}`);
    console.log('');
    console.log('Tip: zavorth product certify  # hermetic fabric matrix');
    return snap.status === 'blocked' ? 1 : 0;
  }

  if (sub === 'certify' || sub === 'certification' || sub === 'qa') {
    const snap = await service.certify();
    if (json) {
      console.log(JSON.stringify(snap, null, 2));
      return snap.certification.blocked > 0 ? 1 : 0;
    }
    console.log('Hermetic product certification');
    console.log(`Status: ${snap.certification.status}`);
    console.log(`Passed: ${snap.certification.passed} · Attention: ${snap.certification.attention} · Blocked: ${snap.certification.blocked}`);
    console.log('');
    for (const c of snap.certification.checks) {
      console.log(`  [${c.status}] ${c.fabric}/${c.id}`);
      console.log(`           ${c.summary}`);
    }
    console.log('');
    console.log(`Fabrics: capability=${snap.fabrics.capability} reach=${snap.fabrics.reach} power=${snap.fabrics.power} product=${snap.fabrics.product}`);
    console.log(`Next: ${snap.narrative.nextSafeAction}`);
    return snap.certification.blocked > 0 ? 1 : 0;
  }

  if (sub === 'doctor') {
    const out = await service.doctor();
    if (json) {
      console.log(JSON.stringify(out.snapshot, null, 2));
      return out.status === 'blocked' ? 1 : 0;
    }
    console.log(out.lines.join('\n'));
    return out.status === 'blocked' ? 1 : 0;
  }

  if (sub === 'first-run' || sub === 'onboarding' || sub === 'trail') {
    const snap = await service.buildSnapshot({ runCertification: false });
    if (json) {
      console.log(JSON.stringify(snap.firstRun, null, 2));
      return 0;
    }
    console.log(`First-run progress: ${Math.round(snap.firstRun.progress * 100)}%`);
    for (const step of snap.firstRun.steps) {
      console.log(`  [${step.status}] ${step.label}`);
      if (step.command) console.log(`           ${step.command}`);
      console.log(`           ${step.summary}`);
    }
    console.log('');
    console.log(`Next: ${snap.firstRun.nextCommand}`);
    return 0;
  }

  if (sub === 'commands' || sub === 'cmds') {
    const group = readOption(rest, '--group') as ProductPublicCommand['group'] | null;
    const cmds = service.listPublicCommands(group || undefined);
    if (json) {
      console.log(JSON.stringify(cmds, null, 2));
      return 0;
    }
    console.log(`Public commands (${cmds.length}) — prefer these over monorepo npm scripts:`);
    let lastGroup = '';
    for (const c of cmds) {
      if (c.group !== lastGroup) {
        lastGroup = c.group;
        console.log('');
        console.log(`## ${c.group}`);
      }
      console.log(`  ${c.command}`);
      console.log(`    ${c.summary}${c.mutation ? ' (mutation)' : ''}`);
    }
    return 0;
  }

  help();
  return 1;
}
