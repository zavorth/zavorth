import { ProductionHardeningValidator } from '../ops/production/ProductionHardeningValidator.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const validator = new ProductionHardeningValidator();
  const report = validator.validate();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.ok ? 0 : 1);
    return;
  }

  console.log(`[ops-production-check] ${report.ok ? 'PASSOU' : 'FALHOU'}`);
  console.log(`[ops-production-check] compose: ${report.composePath}`);
  console.log(`[ops-production-check] dockerfile: ${report.dockerfilePath}`);
  console.log(`[ops-production-check] hardening: ${report.hardeningScriptPath}`);
  console.log(`[ops-production-check] disaster recovery: ${report.disasterRecoveryPlanPath}`);
  console.log(`[ops-production-check] sandbox doctor: ${report.sandboxPaths.sandboxDoctorPath}`);
  console.log(`[ops-production-check] gVisor bootstrap: ${report.sandboxPaths.gvisorBootstrapPath}`);
  console.log(`[ops-production-check] Firecracker bootstrap: ${report.sandboxPaths.firecrackerBootstrapPath}`);
  console.log(`[ops-production-check] Firecracker smoke: ${report.sandboxPaths.firecrackerSmokePath}`);

  for (const check of report.checks) {
    console.log(`[${check.ok ? 'ok' : 'fail'}] ${check.id}: ${check.detail}`);
  }

  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ops-production-check] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
