import { startGatewayHost } from '../../src/gateway/index.js';
import { BenchmarkHarness } from './Harness.js';
import { extractJsonPayloadFromText, runCliProbe } from '../QaSupport.js';

function parseCliProbeResult(result: {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}): { warning: string | null } {
  const stdout = String(result.stdout || '').trim();
  if (!stdout) {
    throw new Error(result.stderr || `exit ${String(result.exitCode)}`);
  }

  let payloadMode: 'json' | 'text' = 'json';
  try {
    extractJsonPayloadFromText(stdout);
  } catch {
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || `exit ${String(result.exitCode)}`);
    }
    payloadMode = 'text';
  }

  const warnings: string[] = [];
  if (payloadMode === 'text') {
    warnings.push('CLI retornou payload textual apesar do probe pedir --json');
  }
  if (result.exitCode !== 0) {
    warnings.push(`CLI retornou exit ${String(result.exitCode)} com payload legivel`);
  }

  return {
    warning: warnings.length > 0 ? warnings.join('; ') : null,
  };
}

async function runBootBenchmarks() {
  const harness = new BenchmarkHarness('Core Boot Operations');

  await harness.measure('Gateway host boot', async () => {
    const boot = await startGatewayHost({
      ...process.env,
      TELEGRAM_BOT_TOKEN: '',
    }, {
      host: '127.0.0.1',
      port: 0,
    });
    await boot.host.stop();
    await boot.runtime.stop();
    return boot.url;
  }, {
    detail: (url) => ({ url }),
  });

  await harness.measure('CLI status fast', async () => {
    const result = await runCliProbe(['domains', '--json']);
    return {
      result,
      parsed: parseCliProbeResult(result),
    };
  }, {
    detail: ({ result }) => ({
      command: 'domains --json',
      exitCode: result.exitCode,
      stdoutBytes: result.stdout.length,
    }),
    warning: ({ parsed }) => parsed.warning,
  });

  await harness.measure('CLI doctor fast', async () => {
    const result = await runCliProbe(['doctor', '--json']);
    return {
      result,
      parsed: parseCliProbeResult(result),
    };
  }, {
    detail: ({ result }) => ({
      command: 'doctor --json',
      exitCode: result.exitCode,
      stdoutBytes: result.stdout.length,
    }),
    warning: ({ parsed }) => parsed.warning,
  });

  await harness.measure('CLI ops access fast', async () => {
    const result = await runCliProbe(['memory', 'status', '--json']);
    return {
      result,
      parsed: parseCliProbeResult(result),
    };
  }, {
    detail: ({ result }) => ({
      command: 'memory status --json',
      exitCode: result.exitCode,
      stdoutBytes: result.stdout.length,
    }),
    warning: ({ parsed }) => parsed.warning,
  });

  const reportPath = harness.writeReport('benchmark-boot.json');
  harness.printReport();
  console.log(`[qa] boot benchmark salvo em ${reportPath}`);
}

runBootBenchmarks().catch((error) => {
  console.error('[qa] boot benchmark falhou:', error);
  process.exit(1);
});
