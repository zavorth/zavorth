#!/usr/bin/env node

import { ZavorthCapabilityCertificationPackService } from '../src/services/ZavorthCapabilityCertificationPackService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const snapshot = await new ZavorthCapabilityCertificationPackService().buildSnapshot();
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot.gatewayMatrix, null, 2)}\n`);
    return;
  }
  process.stdout.write([
    'Zavorth Gateway Matrix',
    `Channels: ${snapshot.gatewayMatrix.channels.length}`,
    ...snapshot.gatewayMatrix.channels.map((channel) =>
      `- ${channel.status.toUpperCase()} ${channel.label}: natural=${channel.naturalFirst}, approvals=${channel.approvalIntentResolver}, rich=${channel.richActions}`),
    '',
  ].join('\n'));
}

main().catch((error) => {
  console.error('[zavorth-gateway-matrix] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
