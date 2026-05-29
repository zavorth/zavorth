#!/usr/bin/env node

import { RuntimeAccessReadinessService } from '../src/runtime/access/RuntimeAccessReadinessService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new RuntimeAccessReadinessService();
  const report = await service.inspectLive();
  const localConsoleUsable =
    report.local.ready
    || (
      report.runtime.telegramWorker.alive
      && (report.runtime.hostSupervisor.alive || report.runtime.zavorthControl?.active === true)
    );

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-access] prontidao do runtime');
  console.log(`[zavorth-access] resumo: ${report.summary}`);
  console.log(
    `[zavorth-access] local: ${report.local.ready ? 'pronto' : localConsoleUsable ? 'readonly' : 'pendente'} | ${report.local.appUrl}`,
  );
  console.log(
    `[zavorth-access] remoto: ${report.remote.ready ? 'pronto' : 'pendente'} | ${report.remote.baseUrl || 'nao configurado'}`,
  );
  console.log(
    `[zavorth-access] host: ${report.runtime.hostSupervisor.alive || report.runtime.zavorthControl?.active ? 'online' : 'offline'} | worker: ${report.runtime.telegramWorker.alive ? 'online' : 'offline'}`,
  );
  console.log(
    `[zavorth-access] ${
      report.runtime.discordBridge.mode === 'native' ? 'discord nativo' : 'discord bridge'
    }: ${
      !report.runtime.discordBridge.enabled
        ? 'desabilitado'
        : report.runtime.discordBridge.started
          ? 'pronto'
          : 'pendente'
    }`,
  );
  console.log(
    `[zavorth-access] auth web: ${report.auth.enabled ? report.auth.source : 'ausente'} | host autorizado: ${
      report.runtime.hostAuthorized === false ? 'nao' : 'sim'
    }`,
  );
  console.log(
    `[zavorth-access] node mesh smoke: ${report.runtime.nodeMeshSmoke.status} | ${
      report.runtime.nodeMeshSmoke.summary
      || report.runtime.nodeMeshSmoke.file
      || report.runtime.nodeMeshSmoke.command
    }`,
  );

  if (report.nextSteps.length > 0) {
    console.log('[zavorth-access] proximos passos:');
    for (const step of report.nextSteps) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (report.recommendations.length > 0) {
    console.log('[zavorth-access] recomendacoes:');
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-access] falha ao inspecionar a prontidao do runtime.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
