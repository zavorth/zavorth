import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildDashboardCommandCenterFixturePreviewViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/preview/commandCenterFixturePreview.js';

const commandCenterDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/control/command-center',
);

describe('CommandCenterFixtureScreenPolish', () => {
  it('adds fixture-driven cockpit sections to the real shell', () => {
    const shell = readFileSync(
      join(commandCenterDir, 'components/CommandCenterControlShell.tsx'),
      'utf8',
    );
    const operations = readFileSync(
      join(commandCenterDir, 'components/CommandCenterOperationsPanel.tsx'),
      'utf8',
    );

    expect(shell).toContain('CommandCenterMissionBrief');
    expect(shell).toContain('CommandCenterOverviewSector');
    expect(shell).toContain('CommandCenterStateCard');
    expect(shell).toContain('Run Observatory');
    expect(shell).toContain('formatCommandCenterRunObservatoryQuery');
    expect(shell).toContain('bcc-release-strip');
    expect(operations).toContain('CommandCenterRunPanel');
    expect(operations).toContain('formatCommandCenterRunObservatoryQuery');
    expect(operations).toContain('viewModel.health.checks');
  });

  it('keeps safe-run, approval, artifact and doctor fixtures visually representable', () => {
    const safeRun = buildDashboardCommandCenterFixturePreviewViewModel('safe-run');
    const approval = buildDashboardCommandCenterFixturePreviewViewModel('awaiting-approval');
    const artifact = buildDashboardCommandCenterFixturePreviewViewModel('artifact-ready');
    const doctor = buildDashboardCommandCenterFixturePreviewViewModel('doctor-degraded');

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
      join(commandCenterDir, 'styles/commandCenter.css'),
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
    const docs = readFileSync(
      join(process.cwd(), 'docs/product-direction.md'),
      'utf8',
    );

    expect(docs).toContain('/control/review?fixture=safe-run');
    expect(docs).toContain('/control/review?fixture=awaiting-approval');
    expect(docs).toContain('/control/review?fixture=artifact-ready');
    expect(docs).toContain('/control/review?fixture=doctor-degraded');
    expect(docs).toContain('DashboardCommandCenterViewModel');
  });
});
