#!/usr/bin/env node

import { ZavorthExternalAgentGatewayService } from '../src/services/ZavorthExternalAgentGatewayService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    process.stdout.write([
      'Agent Run - Execute an external agent',
      '',
      'Usage:',
      '  zavorth agent run <id> --prompt "your task"',
      '  zavorth agent run claude --prompt "review this code"',
      '  zavorth agent run codex --prompt "fix the bug in auth.ts"',
      '',
      'Options:',
      '  --prompt, -p    The task to execute (required)',
      '  --timeout       Timeout in ms (default: 120000)',
      '  --json          Output as JSON',
      '  --help, -h      Show this help',
      '',
    ].join('\n'));
    return;
  }

  const jsonOutput = args.includes('--json');
  const agentId = args.find((a) => !a.startsWith('--')) || '';
  const promptIndex = args.findIndex((a) => a === '--prompt' || a === '-p');
  const prompt = promptIndex >= 0 && args[promptIndex + 1] ? args[promptIndex + 1] : '';
  const timeoutIndex = args.findIndex((a) => a === '--timeout');
  const timeout = timeoutIndex >= 0 && args[timeoutIndex + 1] ? parseInt(args[timeoutIndex + 1], 10) : 120000;

  if (!agentId) {
    process.stdout.write('Error: Agent ID is required.\n');
    process.stdout.write('Usage: zavorth agent run <id> --prompt "task"\n');
    process.exitCode = 1;
    return;
  }

  if (!prompt) {
    process.stdout.write('Error: Prompt is required.\n');
    process.stdout.write('Usage: zavorth agent run <id> --prompt "task"\n');
    process.exitCode = 1;
    return;
  }

  const service = new ZavorthExternalAgentGatewayService();
  const profiles = service.buildRegistrySnapshot().profiles;
  const profile = profiles.find((p) => p.id === agentId);

  if (!profile) {
    process.stdout.write(`Agent "${agentId}" not found.\n`);
    if (profiles.length > 0) {
      process.stdout.write(`Available agents: ${profiles.map((p) => p.id).join(', ')}\n`);
    } else {
      process.stdout.write('No agents registered. Run: zavorth agent add <name>\n');
    }
    process.exitCode = 1;
    return;
  }

  if (!profile.liveExecutionEnabled) {
    process.stdout.write(`Agent "${agentId}" is not enabled for live execution.\n`);
    process.stdout.write(`Re-register with: zavorth agent add ${agentId} --yes\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Running agent "${agentId}"...\n`);

  const receipt = await service.invoke({
    profileId: agentId,
    prompt,
    approvalGranted: true,
    timeoutMs: timeout,
    requestedBy: 'agent-run',
  });

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    process.stdout.write(`\n${'─'.repeat(60)}\n`);
    process.stdout.write(`Status: ${receipt.status}\n`);
    process.stdout.write(`Duration: ${receipt.execution.durationMs}ms\n`);
    process.stdout.write(`\nOutput:\n`);
    process.stdout.write(receipt.output.text);
    process.stdout.write(`\n${'─'.repeat(60)}\n`);
  }
}

main().catch((error) => {
  console.error(`[agent-run] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
