import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildZavorthControlZavorthControlFixturePreviewViewModel,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/preview/zavorthControlFixturePreview.js';

const zavorthControlDir = join(
  process.cwd(),
  'src/ai-gateway/app/(zavorthControl)/control/zavorth-control',
);

describe('ZavorthControlFixtureScreenPolish', () => {
  it('adds fixture-driven cockpit sections to the real shell', () => {
    const shell = readFileSync(
      join(zavorthControlDir, 'components/ZavorthControlControlShell.tsx'),
      'utf8',
    );
    const contextRail = readFileSync(
      join(zavorthControlDir, 'components/ZavorthControlContextRail.tsx'),
      'utf8',
    );
    const operations = readFileSync(
      join(zavorthControlDir, 'components/ZavorthControlOperationsPanel.tsx'),
      'utf8',
    );

    expect(shell).toContain('ZavorthControlChatSurface');
    expect(shell).toContain('ZavorthControlContextRail');
    expect(shell).not.toContain('<ZavorthControlMissionBrief');
    expect(shell).not.toContain('<ZavorthControlStateCard');
    expect(shell).toContain('Run Observatory');
    expect(shell).toContain('formatZavorthControlRunObservatoryQuery');
    expect(contextRail).toContain('ZavorthControlTaskTimeline');
    expect(contextRail).toContain('ZavorthControlMemoryCenter');
    expect(contextRail).toContain('ZavorthControlSkillCatalog');
    expect(contextRail).toContain('ZavorthControlSetupGuides');
    expect(operations).toContain('ZavorthControlRunPanel');
    expect(operations).toContain('formatZavorthControlRunObservatoryQuery');
    expect(operations).toContain('viewModel.health.checks');
  });

  it('keeps safe-run, approval, artifact and doctor fixtures visually representable', () => {
    const safeRun = buildZavorthControlZavorthControlFixturePreviewViewModel('safe-run');
    const approval = buildZavorthControlZavorthControlFixturePreviewViewModel('awaiting-approval');
    const artifact = buildZavorthControlZavorthControlFixturePreviewViewModel('artifact-ready');
    const doctor = buildZavorthControlZavorthControlFixturePreviewViewModel('doctor-degraded');

    expect(safeRun.agentRun?.status).toBe('completed');
    expect(safeRun.agentRun?.events.length).toBeGreaterThan(0);

    expect(approval.approvals.length).toBeGreaterThan(0);
    expect(approval.toolExposure.tools.some((tool) => tool.requiresApproval)).toBe(true);

    expect(artifact.artifacts.length).toBeGreaterThan(0);
    expect(artifact.counts.artifacts).toBe(artifact.artifacts.length);

    expect(doctor.health.status).toBe('degraded');
    expect(doctor.health.checks.length).toBeGreaterThan(1);
  });

  it('ships the ZavorthControl controls visual classes without importing fake zavorthControl metrics', () => {
    const css = readFileSync(
      join(zavorthControlDir, 'styles/zavorthControl.css'),
      'utf8',
    );

    for (const className of [
      '.bcc-metric-card',
      '.bcc-context-rail',
      '.bcc-context-rail__section',
      '.bcc-empty-chat-greeting',
      '.bcc-run-controls',
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
      join(zavorthControlDir, 'fixtures/ZavorthControlFixtures.ts'),
      'utf8',
    );
    const preview = readFileSync(
      join(zavorthControlDir, 'preview/zavorthControlFixturePreview.ts'),
      'utf8',
    );

    expect(fixtures).toContain('safe-run');
    expect(fixtures).toContain('awaiting-approval');
    expect(fixtures).toContain('artifact-ready');
    expect(fixtures).toContain('doctor-degraded');
    expect(preview).toContain('buildZavorthControlZavorthControlFixturePreviewViewModel');
  });
});
