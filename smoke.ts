import { FirecrackerSandboxRuntime } from './src/services/sandbox/FirecrackerSandboxRuntime.js';

async function run() {
  console.log('Instanciando FirecrackerSandboxRuntime...');
  const fc = new FirecrackerSandboxRuntime();

  const status = fc.getStatus();
  if (!status.canRun) {
    console.error('Status indicates FC cannot run:', status.detail);
    process.exit(1);
  }

  const code = `
    const os = require('os');
    console.log('--- Hello from MicroVM! ---');
    console.log('Arch:', os.arch());
    console.log('CPUs:', os.cpus().length);
    console.log('Memory:', Math.round(os.totalmem() / 1024 / 1024) + 'MB');
    console.log('---------------------------');
  `;

  console.log('\nStarting execution...');
  const start = Date.now();

  try {
    const result = await fc.execute({
      language: 'javascript',
      code: code,
      timeoutMs: 15000,
    });

    console.log('\n✅ Execution completed in ' + (Date.now() - start) + 'ms');
    console.log('Exit Code:', result.exitCode);
    console.log('STDOUT:\n', result.stdout);
    if (result.stderr) {
      console.log('STDERR:\n', result.stderr);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Execution failed:', message);
    process.exit(1);
  }
}

run();
