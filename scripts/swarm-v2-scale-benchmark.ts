#!/usr/bin/env tsx
import { SwarmV2Service } from '../src/services/SwarmV2Service.js';

type Args = {
  roles: number;
  concurrency: number;
  json: boolean;
  requirePass: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    roles: 100,
    concurrency: 30,
    json: false,
    requirePass: false,
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    if (arg === '--require-pass') args.requirePass = true;
    if (arg.startsWith('--roles=')) args.roles = clamp(Number(arg.slice('--roles='.length)), 1, 300, 100);
    if (arg.startsWith('--concurrency=')) args.concurrency = clamp(Number(arg.slice('--concurrency='.length)), 1, 30, 30);
  }
  return args;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function commandFor(index: number): { command: string; args: string[] } {
  const text = `zavorth-swarm-v2-scale-worker-${index}-ok`;
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/c', 'echo', text] };
  }
  return { command: 'sh', args: ['-lc', `echo ${JSON.stringify(text)}`] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const roles = Array.from({ length: args.roles }, (_, index) => {
    const roleIndex = index + 1;
    const command = commandFor(roleIndex);
    return {
      id: `scale-worker-${roleIndex}`,
      label: `Scale Worker ${roleIndex}`,
      systemPrompt: 'Emit a small deterministic benchmark marker.',
      command: command.command,
      args: command.args,
      stdinMode: 'none' as const,
    };
  });

  const service = new SwarmV2Service();
  const initial = service.launchOfficialSwarm({
    objective: `Run Swarm v2 scale benchmark with ${args.roles} workers.`,
    roles,
    official: true,
    maxRoles: args.roles,
    maxConcurrency: args.concurrency,
    batchSize: args.concurrency,
    isolationMode: 'temp-worktree',
    benchmark: true,
    subagentBudget: {
      maxWallClockMs: 30000,
      maxOutputBytes: 1024 * 1024,
    },
  });
  const completed = await service.waitForSwarm(initial.swarmId, 120000);
  const result = {
    ok: completed.status === 'completed' && (completed.metrics?.completedRoles || 0) === args.roles,
    status: completed.status,
    swarmId: completed.swarmId,
    requestedRoles: args.roles,
    completedRoles: completed.metrics?.completedRoles || 0,
    failedRoles: completed.metrics?.failedRoles || 0,
    timedOutRoles: completed.metrics?.timedOutRoles || 0,
    maxConcurrency: completed.metrics?.maxConcurrency || args.concurrency,
    batchCount: completed.metrics?.batchCount || 0,
    benchmark: completed.benchmark || null,
    scaleTargets: {
      supports100Workers: args.roles >= 100,
      supports300Workers: args.roles >= 300,
      configuredMaximum: 300,
    },
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log('[swarm-v2-scale-benchmark]');
    console.log(`status: ${result.status}`);
    console.log(`roles: ${result.completedRoles}/${result.requestedRoles}`);
    console.log(`concurrency: ${result.maxConcurrency}`);
    console.log(`speedup: ${result.benchmark?.speedup ?? 0}x`);
    console.log(`quality: ${result.benchmark?.qualityScore ?? 0}/100`);
  }

  if (args.requirePass && !result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
