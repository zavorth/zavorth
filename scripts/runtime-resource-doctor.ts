#!/usr/bin/env node

import { RuntimeResourceBudgetService } from '../src/services/RuntimeResourceBudgetService.js';

function formatReport(report: ReturnType<RuntimeResourceBudgetService['buildBudgetReport']>): string {
  const lines = [
    '[zavorth-ops] runtime resource doctor',
    `[zavorth-ops] perfil: ${report.profile} | budget: ${report.ok ? 'ok' : 'violado'}`,
    `[zavorth-ops] processo: pid ${report.snapshot.process.pid} | node ${report.snapshot.process.nodeVersion} | uptime ${report.snapshot.process.uptimeSeconds}s`,
    `[zavorth-ops] memoria: rss ${report.snapshot.runtime.rssMb}/${report.thresholds.rssMb} MB | heap ${report.snapshot.runtime.heapUsedMb}/${report.thresholds.heapUsedMb} MB`,
    `[zavorth-ops] runtime: handles ${report.snapshot.runtime.activeHandles}/${report.thresholds.activeHandles} | requests ${report.snapshot.runtime.activeRequests}/${report.thresholds.activeRequests} | cjs modules ${report.snapshot.runtime.loadedCommonJsModules}/${report.thresholds.loadedCommonJsModules}`,
    `[zavorth-ops] host: memoria ${report.snapshot.host.memoryLoadPercent}% | livre ${report.snapshot.host.freeMemoryMb}/${report.snapshot.host.totalMemoryMb} MB | cpus ${report.snapshot.host.cpuCount}`,
  ];

  const failedChecks = report.checks.filter((check) => !check.ok);
  if (failedChecks.length > 0) {
    lines.push('[zavorth-ops] checks violados:');
    for (const check of failedChecks) {
      lines.push(`- ${check.id}: ${check.actual}/${check.limit} ${check.unit}`);
    }
  }

  const handleTypes = Object.entries(report.snapshot.runtime.handleTypes);
  if (handleTypes.length > 0) {
    lines.push(`[zavorth-ops] handles: ${handleTypes.map(([type, count]) => `${type}=${count}`).join(', ')}`);
  }

  if (report.recommendations.length > 0) {
    lines.push('[zavorth-ops] recomendacoes:');
    for (const recommendation of report.recommendations) {
      lines.push(`- ${recommendation}`);
    }
  }

  return lines.join('\n');
}

function readNumberFlag(argv: string[], name: string): number | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const raw = inline ? inline.slice(prefix.length) : null;
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict') || argv.includes('--budget');
  const profileArg = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
  const service = new RuntimeResourceBudgetService();
  const profile = service.resolveProfile(profileArg || process.env.ZAVORTH_RESOURCE_BUDGET_PROFILE || process.env.ZAVORTH_PROFILE);
  const report = service.buildBudgetReport(profile, undefined, {
    ...(readNumberFlag(argv, 'rss-mb') !== null ? { rssMb: readNumberFlag(argv, 'rss-mb') as number } : {}),
    ...(readNumberFlag(argv, 'heap-used-mb') !== null ? { heapUsedMb: readNumberFlag(argv, 'heap-used-mb') as number } : {}),
    ...(readNumberFlag(argv, 'active-handles') !== null ? { activeHandles: readNumberFlag(argv, 'active-handles') as number } : {}),
    ...(readNumberFlag(argv, 'active-requests') !== null ? { activeRequests: readNumberFlag(argv, 'active-requests') as number } : {}),
    ...(readNumberFlag(argv, 'loaded-cjs-modules') !== null ? { loadedCommonJsModules: readNumberFlag(argv, 'loaded-cjs-modules') as number } : {}),
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report)}\n`);
  }

  if (strict && !report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-ops] runtime resource doctor falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
