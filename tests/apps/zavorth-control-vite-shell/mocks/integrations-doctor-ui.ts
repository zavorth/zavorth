export function resolveIntegrationUiState(data: {
  manifest: { id: string; label: string };
  readiness: string;
  doctor: { status: string; configured: boolean };
}): string {
  if (data.doctor.status === 'error') return 'error';
  if (data.readiness === 'ready' && data.doctor.status === 'ok') return 'ready';
  if (data.readiness === 'needs_configuration' || !data.doctor.configured)
    return 'configure';
  if (data.readiness === 'ready') return 'ready';
  return 'configure';
}
