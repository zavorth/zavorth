#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import { ZavorthExternalAgentGatewayService } from '../src/services/ZavorthExternalAgentGatewayService.js';
import { AgentChainBuilder } from '../src/agents/AgentChainBuilder.js';
import { logger } from '../src/logger.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    process.stdout.write([
      'Agent Chain - Execute a chain of agents',
      '',
      'Usage:',
      '  zavorth agent chain --steps \'[{"id":"s1","kind":"agent","agent":"claude","prompt":"review"}]\'',
      '  zavorth agent chain --steps \'[{"id":"s1","kind":"agent","agent":"claude","prompt":"review"},{"id":"s2","kind":"agent","agent":"codex","prompt":"fix ${s1.output}"}]\'',
      '  zavorth agent chain --parallel --steps \'[{"id":"s1","kind":"agent","agent":"claude","prompt":"security","parallelGroup":"review"},{"id":"s2","kind":"agent","agent":"codex","prompt":"performance","parallelGroup":"review"}]\'',
      '',
      'Options:',
      '  --steps           JSON array of step configs (required)',
      '  --parallel        Execute steps in parallel when possible',
      '  --max-concurrency Max concurrent steps (default: 5)',
      '  --stop-on-error   Stop on first error (default: true)',
      '  --name            Chain name',
      '  --json            Output as JSON',
      '  --help, -h        Show this help',
      '',
      'Step config:',
      '  id              Unique step identifier',
      '  kind            "agent", "local", or "transform"',
      '  agent           Agent profile ID (for agent kind)',
      '  prompt          Prompt or template. Use ${stepId.output} for chaining',
      '  command         Shell command (for local kind)',
      '  fallback        Fallback agent ID if primary fails',
      '  timeoutMs       Step timeout in ms',
      '  retries         Number of retries before fallback',
      '  parallelGroup   Group name for parallel execution',
      '  dependsOn       Array of step IDs that must complete first',
      '',
      'Examples:',
      '  # Sequential: review then fix',
      '  zavorth agent chain --steps \'[{"id":"review","kind":"agent","agent":"claude","prompt":"review code"},{"id":"fix","kind":"agent","agent":"codex","prompt":"fix: ${review.output}"}]\'',
      '',
      '  # Parallel: multiple reviews at once',
      '  zavorth agent chain --parallel --steps \'[{"id":"sec","kind":"agent","agent":"claude","prompt":"security review","parallelGroup":"reviews"},{"id":"perf","kind":"agent","agent":"codex","prompt":"performance review","parallelGroup":"reviews"}]\'',
      '',
      '  # With fallback',
      '  zavorth agent chain --steps \'[{"id":"task","kind":"agent","agent":"unreliable","prompt":"do task","fallback":"reliable"}]\'',
      '',
    ].join('\n'));
    return;
  }

  const jsonOutput = args.includes('--json');
  const parallel = args.includes('--parallel');
  const stopOnError = !args.includes('--no-stop-on-error');
  const stepsIndex = args.findIndex((a) => a === '--steps');
  const stepsRaw = stepsIndex >= 0 && args[stepsIndex + 1] ? args[stepsIndex + 1] : '';
  const maxConcurrencyIndex = args.findIndex((a) => a === '--max-concurrency');
  const maxConcurrency = maxConcurrencyIndex >= 0 && args[maxConcurrencyIndex + 1] ? parseInt(args[maxConcurrencyIndex + 1], 10) : 5;
  const nameIndex = args.findIndex((a) => a === '--name');
  const name = nameIndex >= 0 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;

  if (!stepsRaw) {
    process.stdout.write('Error: --steps is required.\n');
    process.stdout.write('Usage: zavorth agent chain --steps \'[{"id":"s1","kind":"agent","agent":"claude","prompt":"task"}]\'\n');
    process.exitCode = 1;
    return;
  }

  let steps: Array<Record<string, unknown>>;
  try {
    steps = JSON.parse(stepsRaw);
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Steps must be a non-empty array');
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    process.stdout.write(`Error parsing --steps: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }

  const service = new ZavorthExternalAgentGatewayService();
  const chainBuilder = new AgentChainBuilder({ externalAgentGateway: service, logger });

  const available = chainBuilder.listAvailableAgents();
  process.stdout.write(`\nChain: ${name || 'unnamed'}\n`);
  process.stdout.write(`Steps: ${steps.length}\n`);
  process.stdout.write(`Parallel: ${parallel}\n`);
  process.stdout.write(`Available agents: ${available.length > 0 ? available.map((a) => a.id).join(', ') : '(none)'}\n`);
  process.stdout.write(`\nExecuting...\n\n`);

  try {
    const execution = await chainBuilder.executeChain({
      name,
      steps: steps.map((s, i) => ({
        id: typeof s.id === 'string' ? s.id : `step-${i}`,
        kind: (typeof s.kind === 'string' ? s.kind : 'agent') as 'agent' | 'local' | 'transform',
        agent: typeof s.agent === 'string' ? s.agent : undefined,
        prompt: typeof s.prompt === 'string' ? s.prompt : '',
        command: typeof s.command === 'string' ? s.command : undefined,
        fallback: typeof s.fallback === 'string' ? s.fallback : undefined,
        timeoutMs: typeof s.timeoutMs === 'number' ? s.timeoutMs : undefined,
        retries: typeof s.retries === 'number' ? s.retries : undefined,
        parallelGroup: typeof s.parallelGroup === 'string' ? s.parallelGroup : undefined,
        dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : undefined,
      })),
      parallel,
      maxConcurrency,
      stopOnError,
    });

    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`);
    } else {
      process.stdout.write(chainBuilder.formatExecutionSummary(execution));
      process.stdout.write('\n');
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    process.stdout.write(`Chain execution failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[agent-chain] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
