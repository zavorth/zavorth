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

    console.log('[zavorth-bridge-remote] status nativo');
    console.log(`[zavorth-bridge-remote] resumo: ${status.summary}`);
    console.log(
      `[zavorth-bridge-remote] sidecar: ${status.sidecar?.ready ? 'pronto' : 'indisponivel'} | base=${status.access.baseUrl} | local=${status.access.localUrl || 'n/d'}`,
    );
    console.log(
      `[zavorth-bridge-remote] bridge: ${status.bridge.online ? 'online' : 'offline'} | instance=${status.bridge.instanceId || 'n/d'} | pending=${status.bridge.pendingHandoffs ?? 'n/d'}`,
    );
    console.log(
      `[zavorth-bridge-remote] remote mode: ${status.remoteMode.active === false ? 'inativo' : 'ok'} | session: ${status.session.accessible === false ? 'bloqueada' : 'ok'}`,
    );
    console.log(
      `[zavorth-bridge-remote] acesso: ${status.access.readyForRemoteUse ? 'pronto para uso remoto' : 'precisa de atencao'} | protegido=${status.access.protectedByPassword ? 'sim' : 'nao'}`,
    );
    if (status.access.recommendations.length > 0) {
      console.log('[zavorth-bridge-remote] recomendacoes:');
      for (const recommendation of status.access.recommendations) {
        console.log(`- ${recommendation}`);
      }
    }
  }).catch((error) => {
    console.error(`[zavorth-bridge-remote] falha: ${error.message || error}`);
    process.exitCode = 1;
  });
}

main();
