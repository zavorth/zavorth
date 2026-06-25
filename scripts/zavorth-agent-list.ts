#!/usr/bin/env node

import { ZavorthExternalAgentGatewayService } from '../src/services/ZavorthExternalAgentGatewayService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  const service = new ZavorthExternalAgentGatewayService();
  const snapshot = service.buildRegistrySnapshot();

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  if (snapshot.profiles.length === 0) {
    process.stdout.write('No agents registered.\n');
    process.stdout.write('\nAdd one:\n');
    process.stdout.write('  zavorth agent add claude\n');
    process.stdout.write('  zavorth agent add codex\n');
    process.stdout.write('  zavorth agent add ./my-agent\n');
    return;
  }

  process.stdout.write(`\nRegistered Agents (${snapshot.profiles.length})\n`);
  process.stdout.write(`${'─'.repeat(60)}\n`);

  for (const profile of snapshot.profiles) {
    const status = profile.liveExecutionEnabled ? '●' : '○';
    const adapter = profile.adapter.padEnd(6);
    const id = profile.id.padEnd(20);
    process.stdout.write(`  ${status} ${id} ${adapter} ${profile.label}\n`);
  }

  process.stdout.write(`\n${'─'.repeat(60)}\n`);
  process.stdout.write(`● = live enabled  ○ = registered only\n`);
  process.stdout.write(`\nUsage:\n`);
  process.stdout.write(`  zavorth agent run <id> --prompt "task"\n`);
  process.stdout.write(`  zavorth agent chain --steps '[{"id":"s1","kind":"agent","agent":"<id>","prompt":"task"}]'\n`);
}

main().catch((error) => {
  console.error(`[agent-list] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
