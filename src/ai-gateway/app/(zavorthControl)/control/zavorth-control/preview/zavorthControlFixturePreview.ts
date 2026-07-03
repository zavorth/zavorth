import {
  ZAVORTH_CONTROL_FIXTURE_IDS,
  buildZavorthControlZavorthControlFixture,
  getZavorthControlZavorthControlFixture,
  listZavorthControlZavorthControlFixtures,
  type ZavorthControlZavorthControlFixtureId,
} from '../fixtures/ZavorthControlFixtures';

export const ZAVORTH_CONTROL_FIXTURE_PREVIEW_QUERY_PARAM = 'fixture' as const;

export function resolveZavorthControlZavorthControlFixturePreviewId(value: unknown): ZavorthControlZavorthControlFixtureId | null {
  const normalized = String(value ?? '').trim();
  return (ZAVORTH_CONTROL_FIXTURE_IDS as readonly string[]).includes(normalized)
    ? normalized as ZavorthControlZavorthControlFixtureId
    : null;
}

export function listZavorthControlZavorthControlFixturePreviewOptions() {
  return listZavorthControlZavorthControlFixtures().map((fixture) => ({
    id: fixture.id,
    label: fixture.label,
    description: fixture.description,
  }));
}

export function buildZavorthControlZavorthControlFixturePreviewViewModel(id: ZavorthControlZavorthControlFixtureId): Record<string, any> {
  const fixture = getZavorthControlZavorthControlFixture(id);
  const viewModel = buildZavorthControlZavorthControlFixture(id);
  const logs = [
    {
      id: `preview:${id}`,
      source: 'zavorthControl-preview',
      level: 'info',
      message: `Fixture oficial: ${fixture.label}`,
    },
    ...(Array.isArray(viewModel.logs) ? viewModel.logs : []),
  ];
  return {
    ...viewModel,
    adapterSource: {
      ...viewModel.adapterSource,
      kind: 'contract-preview',
      label: 'ZavorthControl Contract Preview',
      notes: `Fixture oficial: ${fixture.description}`,
    },
    logs,
    counts: {
      ...viewModel.counts,
      logs: logs.length,
    },
  };
}
