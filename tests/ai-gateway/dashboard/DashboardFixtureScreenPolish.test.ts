import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildDashboardDashboardFixturePreviewViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/preview/dashboardFixturePreview.js';

const dashboardDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/dashboard/dashboard',
);

describe('DashboardFixtureScreenPolish', () => {
  it('adds fixture-driven cockpit sections to the real shell', () => {
    const shell = readFileSync(
      join(dashboardDir, 'components/DashboardControlShell.tsx'),
      'utf8',
    );
    const operations = readFileSync(
      join(dashboardDir, 'components/DashboardOperationsPanel.tsx'),
      'utf8',
    );

    expect(shell).toContain('DashboardMissionBrief');
    expect(shell).toContain('DashboardOverviewSector');
    expect(shell).toContain('DashboardStateCard');
    expect(shell).toContain('Run Observatory');
    expect(shell).toContain('formatDashboardRunObservatoryQuery');
    expect(shell).toContain('bcc-release-strip');
    expect(operations).toContain('DashboardRunPanel');
    expect(operations).toContain('formatDashboardRunObservatoryQuery');
    expect(operations).toContain('viewModel.health.checks');
  });

  it('keeps safe-run, approval, artifact and doctor fixtures visually representable', () => {
    const safeRun = buildDashboardDashboardFixturePreviewViewModel('safe-run');
    const approval = buildDashboardDashboardFixturePreviewViewModel('awaiting-approval');
    const artifact = buildDashboardDashboardFixturePreviewViewModel('artifact-ready');
    const doctor = buildDashboardDashboardFixturePreviewViewModel('doctor-degraded');

    expect(safeRun.agentRun?.status).toBe('completed');
    expect(safeRun.agentRun?.events.length).toBeGreaterThan(0);

    expect(approval.approvals.length).toBeGreaterThan(0);
    expect(approval.toolExposure.tools.some((tool) => tool.requiresApproval)).toBe(true);

    expect(artifact.artifacts.length).toBeGreaterThan(0);
    expect(artifact.counts.artifacts).toBe(artifact.artifacts.length);

    expect(doctor.health.status).toBe('degraded');
    expect(doctor.health.checks.length).toBeGreaterThan(1);
  });

  it('ships the Dashboard controls visual classes without importing fake dashboard metrics', () => {
    const css = readFileSync(
      join(dashboardDir, 'styles/dashboard.css'),
      'utf8',
    );

    for (const className of [
      '.bcc-mission-brief',
      '.bcc-metric-card',
      '.bcc-overview-hero',
      '.bcc-state-card',
      '.bcc-run-timeline',
      '.bcc-run-observatory-item',
      '.bcc-health-row',
      '.bcc-tool-chip',
      '.bcc-release-strip',
      '.bcc-run-card',
    ]) {
      expect(css).toContain(className);
    }

    expect(css).not.toContain('RTX 4090');
    expect(css).not.toContain('3.2M');
    expect(css).not.toContain('$4.82');
  });

  it('documents fixture-by-fixture polish over the official runtime contract', () => {
    const fixtures = readFileSync(
      join(dashboardDir, 'fixtures/dashboardDashboardFixtures.ts'),
      'utf8',
    );
    const preview = readFileSync(
      join(dashboardDir, 'preview/dashboardFixturePreview.ts'),
      'utf8',
    );

    expect(fixtures).toContain('safe-run');
    expect(fixtures).toContain('awaiting-approval');
    expect(fixtures).toContain('artifact-ready');
    expect(fixtures).toContain('doctor-degraded');
    expect(preview).toContain('buildDashboardDashboardFixturePreviewViewModel');
  });
});
