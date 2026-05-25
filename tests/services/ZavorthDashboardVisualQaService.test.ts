import { ZavorthDashboardVisualQaService } from '../../src/services/ZavorthDashboardVisualQaService';

const NOW = new Date('2026-05-10T12:00:00.000Z');

describe('ZavorthDashboardVisualQaService', () => {
  it('reports plan-ready when preview exists without screenshots', () => {
    const service = new ZavorthDashboardVisualQaService({
      now: () => NOW,
      projectRoot: 'C:/fixture/zavorth',
      existsSync: (targetPath: string) => targetPath.replace(/\\/g, '/').endsWith('.tmp/dashboard-browser-preview/index.html'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-dashboard-visual-qa.v1');
    expect(snapshot.status).toBe('plan-ready');
    expect(snapshot.summary.evidenceReady).toBe(false);
    expect(snapshot.commands.capture).toContain('--capture');
  });

  it('reports evidence-ready when screenshots and manifest exist', () => {
    const service = new ZavorthDashboardVisualQaService({
      now: () => NOW,
      projectRoot: 'C:/fixture/zavorth',
      existsSync: () => true,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('evidence-ready');
    expect(snapshot.summary.evidenceReady).toBe(true);
    expect(snapshot.artifacts.map((artifact) => artifact.id)).toEqual(expect.arrayContaining([
      'preview-html',
      'manifest',
      'desktop-screenshot',
      'mobile-screenshot',
      'auto-subagents-screenshot',
    ]));
  });

  it('reports blocked when no dashboard preview evidence exists', () => {
    const service = new ZavorthDashboardVisualQaService({
      now: () => NOW,
      projectRoot: 'C:/fixture/zavorth',
      existsSync: () => false,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.artifactsPresent).toBe(0);
  });
});
