#!/usr/bin/env node

import { ZavorthBridgeRemoteNativeService } from '../src/services/ZavorthBridgeRemoteNativeService.js';

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new ZavorthBridgeRemoteNativeService();

  service.getStatus().then((status) => {
    if (asJson) {
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      return;
    }

    console.log('[zavorth-bridge-remote] status nactive');
    console.log(`[zavorth-bridge-remote] summary: ${status.summary}`);
    console.log(
      `[zavorth-bridge-remote] sidecar: ${status.sidecar?.ready ? 'ready' : 'unavailable'} | base=${status.access.baseUrl} | local=${status.access.localUrl || 'n/d'}`,
    );
    console.log(
      `[zavorth-bridge-remote] bridge: ${status.bridge.online ? 'online' : 'offline'} | instance=${status.bridge.instanceId || 'n/d'} | pending=${status.bridge.pendingHandoffs ?? 'n/d'}`,
    );
    console.log(
      `[zavorth-bridge-remote] remote mode: ${status.remoteMode.active === false ? 'inactive' : 'ok'} | session: ${status.session.accessible === false ? 'blocked' : 'ok'}`,
    );
    console.log(
      `[zavorth-bridge-remote] access: ${status.access.readyForRemoteUse ? 'ready for remote use' : 'needs attention'} | protected=${status.access.protectedByPassword ? 'yes' : 'no'}`,
    );
    if (status.access.recommendations.length > 0) {
      console.log('[zavorth-bridge-remote] recommendations:');
      for (const recommendation of status.access.recommendations) {
        console.log(`- ${recommendation}`);
      }
    }
  }).catch((error) => {
    console.error(`[zavorth-bridge-remote] failure: ${error.message || error}`);
    process.exitCode = 1;
  });
}

main();
