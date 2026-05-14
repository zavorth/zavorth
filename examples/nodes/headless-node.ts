import { spawn } from 'child_process';

async function main() {
  const passcode = process.env.ZAVORTH_NODE_PASSCODE || '<nodeId:pairingCode>';
  const baseUrl = process.env.ZAVORTH_BASE_URL || 'http://127.0.0.1:33333';

  console.log('[example-node] iniciando companion/headless node pelo fluxo oficial...');
  console.log(`[example-node] baseUrl: ${baseUrl}`);

  const child = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'companion:start', '--', '--once', '--passcode', passcode, '--base-url', baseUrl],
    {
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error('[example-node] falhou:', error);
  process.exit(1);
});
