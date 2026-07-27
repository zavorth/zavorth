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
    'Node Mesh smoke: revalidated automatically by autorepair.',
    'Node Mesh smoke: failed na revalidation automatica',
    'Node Mesh smoke: revalidation automatica planejada em dry-run.',
  );
}

export function describeChannelProviderBootstrapStatus(report: AutoRepairReport): string | null {
  return describeBootstrapAction(
    report,
    'validate-channel-providers',
    'Native channels: automatically revalidated by autorepair.',
    'Native channels: automatic revalidation failed.',
    'Native channels: automatic revalidation planned in dry-run.',
  );
}

export function describeRemoteTransportBootstrapStatus(report: AutoRepairReport): string | null {
  return describeBootstrapAction(
    report,
    'validate-remote-transports',
    'Remote transports: revalidated automatically by autorepair.',
    'Transportes remotos: falharam na revalidation automatica',
    'Transportes remotos: revalidation automatica planejada em dry-run.',
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
  return `Validation final: ${passed} ok | ${failed} failure(s) | ${skipped} pulada(s).`;
}
