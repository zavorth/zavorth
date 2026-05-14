#!/usr/bin/env node

import { ZavorthPublicTunnelService } from '../src/services/ZavorthPublicTunnelService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const stop = argv.includes('--stop');
  const targetUrl = readFlag(argv, '--target-url');
  const service = new ZavorthPublicTunnelService();
  const status = stop
    ? await service.stop()
    : await service.ensureStarted({ targetUrl });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-public-tunnel] tunel publico do /app');
  console.log(`[zavorth-public-tunnel] status: ${status.ready ? 'pronto' : (status.running ? 'iniciando' : 'parado')}`);
  console.log(`[zavorth-public-tunnel] target: ${status.targetUrl || 'nao definido'}`);
  console.log(`[zavorth-public-tunnel] public: ${status.publicUrl || 'nao publicado'}`);
  console.log(`[zavorth-public-tunnel] detalhe: ${status.message}`);
  console.log(`[zavorth-public-tunnel] estado: ${status.stateFile}`);
  console.log(`[zavorth-public-tunnel] log: ${status.logFile}`);

  if (status.publicUrl) {
    try {
      // Dynamic import to prevent crashing if not installed yet during architecture drafting
      const qrcode = await import('qrcode-terminal');
      console.log('\n[zavorth-public-tunnel] Scan the QR Code below to access via Mobile/Companion:\n');
      qrcode.default.generate(status.publicUrl, { small: true });
    } catch {
      console.log('\n[zavorth-public-tunnel] Dica: instale `qrcode-terminal` para gerar um QR Code no console.');
    }
  }
}

function readFlag(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  if (index === -1 || index === argv.length - 1) {
    return '';
  }
  return String(argv[index + 1] || '').trim();
}

main().catch((error) => {
  console.error('[zavorth-public-tunnel] falha ao preparar o tunel publico do Zavorth.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
