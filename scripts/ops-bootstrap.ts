#!/usr/bin/env node

import { RuntimeBootstrapRepairService } from '../src/services/RuntimeBootstrapRepairService.js';
import { RuntimeBootstrapService } from '../src/services/RuntimeBootstrapService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const shouldRepair = argv.includes('--repair');
  const dryRun = argv.includes('--dry-run');

  if (shouldRepair) {
    const repairService = new RuntimeBootstrapRepairService();
    const repair = await repairService.repairLive({ dryRun });

    if (asJson) {
      process.stdout.write(`${JSON.stringify(repair, null, 2)}\n`);
      return;
    }

    console.log('[zavorth-bootstrap] reparo seguro');
    console.log(`[zavorth-bootstrap] resumo inicial: ${repair.initial.summary}`);
    if (repair.steps.length === 0) {
      console.log('[zavorth-bootstrap] nenhuma correcao segura disponivel.');
    } else {
      console.log('[zavorth-bootstrap] acoes seguras:');
      for (const step of repair.steps) {
        console.log(`- ${step.title} -> ${step.command}`);
        console.log(`  status=${step.status} | duracao=${step.durationMs}ms`);
        if (step.error) {
          console.log(`  erro: ${step.error}`);
        } else if (step.output) {
          console.log(`  saida: ${truncate(step.output)}`);
        }
      }
    }
    console.log(`[zavorth-bootstrap] resumo final: ${repair.summary}`);
    if (repair.final.actions.length > 0) {
      console.log('[zavorth-bootstrap] passos restantes:');
      for (const action of repair.final.actions) {
        console.log(`- ${action.title} -> ${action.command}`);
        console.log(`  ${action.reason}`);
      }
    }
    return;
  }

  const service = new RuntimeBootstrapService();
  const report = await service.inspectLive();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-bootstrap] estado do bootstrap');
  console.log(`[zavorth-bootstrap] resumo: ${report.summary}`);
  console.log(
    `[zavorth-bootstrap] .env: ${report.env.envFilePresent ? 'ok' : 'ausente'} | provider=${report.env.llmProvider} | credencial=${report.env.llmCredentialReady ? 'ok' : 'pendente'}`,
  );
  console.log(
    `[zavorth-bootstrap] dependencias: ${report.dependencies.installRequired ? 'npm install pendente' : 'ok'} | build=${report.dependencies.buildRequired ? 'pendente' : 'ok'}`,
  );
  console.log(
    `[zavorth-bootstrap] local: ${report.supervisedRuntime.accessReadiness.local.ready ? 'pronto' : 'pendente'} | remoto: ${report.supervisedRuntime.accessReadiness.remote.ready ? 'pronto' : 'pendente'}`,
  );
  console.log(
    `[zavorth-bootstrap] node mesh smoke: ${
      report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.status
    } | ${
      report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.summary
      || report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.file
      || report.supervisedRuntime.accessReadiness.runtime.nodeMeshSmoke.command
    }`,
  );

  if (report.env.issues.length > 0) {
    console.log('[zavorth-bootstrap] configuracao:');
    for (const issue of report.env.issues) {
      console.log(`- ${issue}`);
    }
  }

  if (report.actions.length > 0) {
    console.log('[zavorth-bootstrap] proximos passos:');
    for (const action of report.actions) {
      console.log(`- ${action.title} -> ${action.command}`);
      console.log(`  ${action.reason}`);
    }
  }
}

function truncate(input: string, max = 160): string {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}...`;
}

main().catch((error) => {
  console.error('[zavorth-bootstrap] falha ao inspecionar o bootstrap do runtime.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
