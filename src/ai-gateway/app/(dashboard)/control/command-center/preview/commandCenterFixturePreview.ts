import type { DashboardCommandCenterViewModel } from "../contracts";
import {
  DASHBOARD_COMMAND_CENTER_FIXTURE_IDS,
  buildDashboardCommandCenterFixture,
  getDashboardCommandCenterFixture,
  listDashboardCommandCenterFixtures,
  type DashboardCommandCenterFixture,
  type DashboardCommandCenterFixtureId,
} from "../fixtures";

export const COMMAND_CENTER_FIXTURE_PREVIEW_QUERY_PARAM = "fixture";

export type DashboardCommandCenterFixturePreviewOption = Pick<
  DashboardCommandCenterFixture,
  "id" | "label" | "description"
>;

export function isDashboardCommandCenterFixtureId(
  value: unknown,
): value is DashboardCommandCenterFixtureId {
  return DASHBOARD_COMMAND_CENTER_FIXTURE_IDS.includes(value as DashboardCommandCenterFixtureId);
}

export function resolveDashboardCommandCenterFixturePreviewId(
  value: unknown,
): DashboardCommandCenterFixtureId | null {
  const normalized = String(value ?? "").trim();
  return isDashboardCommandCenterFixtureId(normalized) ? normalized : null;
}

export function listDashboardCommandCenterFixturePreviewOptions(): DashboardCommandCenterFixturePreviewOption[] {
  return listDashboardCommandCenterFixtures().map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}

export function getDashboardCommandCenterFixturePreviewOption(
  id: DashboardCommandCenterFixtureId,
): DashboardCommandCenterFixturePreviewOption {
  const fixture = getDashboardCommandCenterFixture(id);
  return {
    id: fixture.id,
    label: fixture.label,
    description: fixture.description,
  };
}

export function buildDashboardCommandCenterFixturePreviewViewModel(
  id: DashboardCommandCenterFixtureId,
): DashboardCommandCenterViewModel {
  const viewModel = buildDashboardCommandCenterFixture(id);
  const fixture = getDashboardCommandCenterFixture(id);

  return {
    ...viewModel,
    adapterSource: {
      ...viewModel.adapterSource,
      label: "Command Center Contract Preview",
      notes: `Fixture oficial: ${fixture.label}. ${fixture.description}`,
    },
    logs: [
      {
        id: `fixture-preview-${id}`,
        level: "info",
        source: "command-center-preview",
        message: `Renderizando fixture oficial: ${fixture.label}.`,
        createdAt: viewModel.generatedAt,
      },
      ...viewModel.logs,
    ],
    counts: {
      ...viewModel.counts,
      logs: viewModel.counts.logs + 1,
    },
  };
}
