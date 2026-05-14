import type { AutoRepairReport } from './AutoRepairTypes.js';

export function collectAutoRepairSmokeValidationStats(report: AutoRepairReport): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
} {
  const smokeSteps = report.attempts
    .flatMap((attempt) => attempt.validation || [])
    .filter((step) => step.label.endsWith('-smoke'));

  return {
    total: smokeSteps.length,
    passed: smokeSteps.filter((step) => step.status === 'passed').length,
    failed: smokeSteps.filter((step) => step.status === 'failed').length,
    skipped: smokeSteps.filter((step) => step.status === 'skipped').length,
  };
}

function describeBootstrapAction(
  report: AutoRepairReport,
  actionId: string,
  successLabel: string,
  failureLabel: string,
  skippedLabel: string,
): string | null {
  const step = [...report.bootstrapRepair.steps].reverse().find((entry) => entry.actionId === actionId);
  if (!step) {
    return null;
  }

  if (step.status === 'executed') {
    return successLabel;
  }

  if (step.status === 'failed') {
    return step.error ? `${failureLabel} (${step.error}).` : `${failureLabel}.`;
  }

  if (step.status === 'skipped') {
    return skippedLabel;
  }

  return null;
}

export function describeNodeMeshBootstrapStatus(report: AutoRepairReport): string | null {
  return describeBootstrapAction(
    report,
    'validate-node-mesh-smoke',
    'Node Mesh smoke: revalidado automaticamente pelo autorepair.',
    'Node Mesh smoke: falhou na revalidacao automatica',
    'Node Mesh smoke: revalidacao automatica planejada em dry-run.',
  );
}

export function describeChannelProviderBootstrapStatus(report: AutoRepairReport): string | null {
  return describeBootstrapAction(
    report,
    'validate-channel-providers',
    'Canais nativos: revalidados automaticamente pelo autorepair.',
    'Canais nativos: falharam na revalidacao automatica',
    'Canais nativos: revalidacao automatica planejada em dry-run.',
  );
}

export function describeRemoteTransportBootstrapStatus(report: AutoRepairReport): string | null {
  return describeBootstrapAction(
    report,
    'validate-remote-transports',
    'Transportes remotos: revalidados automaticamente pelo autorepair.',
    'Transportes remotos: falharam na revalidacao automatica',
    'Transportes remotos: revalidacao automatica planejada em dry-run.',
  );
}

export function describeAutoRepairValidationStatus(report: AutoRepairReport): string | null {
  const lastAttempt = report.attempts[report.attempts.length - 1];
  if (!lastAttempt || lastAttempt.validation.length === 0) {
    return null;
  }

  const passed = lastAttempt.validation.filter((step) => step.status === 'passed').length;
  const failed = lastAttempt.validation.filter((step) => step.status === 'failed').length;
  const skipped = lastAttempt.validation.filter((step) => step.status === 'skipped').length;
  return `Validacao final: ${passed} ok | ${failed} falha(s) | ${skipped} pulada(s).`;
}
