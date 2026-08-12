import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('Zavorth Control daily capability flow cards', () => {
  it('projects the complete daily improvement loop from the empty chat state', () => {
    const source = read('src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector.tsx');
    const mirrorSource = read('src/ai-gateway/app/(zavorthControl)/control/TerminalInboxSector.tsx');
    const viteShell = read('apps/zavorth-control-vite-shell/index.html');
    const gatewayShell = read('src/ai-gateway/public/zavorth-control-vite-shell/index.html');
    const appCss = read('apps/zavorth-control-vite-shell/public/styles/chat.css');
    const gatewayCss = read('src/ai-gateway/public/zavorth-control-vite-shell/styles/chat.css');

    for (const id of [
      'improve-behavior',
      'memory-learning',
      'mcp-catalog',
      'skill-lifecycle',
      'runtime-wizard',
      'channel-wizard',
      'backend-wizard',
      'continuous-evals',
    ]) {
      expect(source).toContain(id);
    }

    for (const nativeAutonomyMarker of [
      'data-autonomy-command-center',
      'deep-missions',
      'mission-plan-board',
      'memory-dreams',
      'learning-center',
      'data-mission-depth-mode',
      'Normal',
      'Deep',
      'Mission',
      'Adversarial',
      'Review plan',
      'Start mission',
      'Review evidence',
      'View receipt',
      'Keep reviewing',
      'Rollback',
    ]) {
      expect(source).toContain(nativeAutonomyMarker);
      expect(mirrorSource).toContain(nativeAutonomyMarker);
      expect(viteShell).toContain(nativeAutonomyMarker);
      expect(gatewayShell).toContain(nativeAutonomyMarker);
    }

    expect(source).toContain('data-daily-capability-card');
    expect(source).toContain('DailyFlowCard');
    expect(source).toContain('Improve behavior');
    expect(source).toContain('Tools catalog');
    expect(source).toContain('Run evals');
    expect(source).toContain('data-daily-product-experience');
    expect(source).toContain('dailyProductExperienceCards');
    expect(source).toContain('Start guided');
    expect(source).toContain('Daily loop');
    expect(source).toContain('Review center');
    expect(source).not.toMatch(/transaction plane|policy broker|quarantine/i);

    expect(appCss).toContain('.daily-product-experience-strip');
    expect(appCss).toContain('.daily-product-experience-card');
    expect(appCss).toContain('.daily-capability-grid');
    expect(appCss).toContain('.daily-capability-card');
    expect(appCss).toContain('.autonomy-command-center');
    expect(appCss).toContain('.autonomy-card');
    expect(appCss).toContain('.mission-depth-mode');
    expect(appCss).toContain('.mission-plan-step');
    expect(appCss).toContain('.memory-dream-card');
    expect(appCss).toContain('.learning-center-metric');
    expect(gatewayCss).toContain('.daily-product-experience-strip');
    expect(gatewayCss).toContain('.daily-product-experience-card');
    expect(gatewayCss).toContain('.daily-capability-grid');
    expect(gatewayCss).toContain('.daily-capability-card');
    expect(gatewayCss).toContain('.autonomy-command-center');
    expect(gatewayCss).toContain('.autonomy-card');
    expect(gatewayCss).toContain('.mission-depth-mode');
    expect(gatewayCss).toContain('.mission-plan-step');
    expect(gatewayCss).toContain('.memory-dream-card');
    expect(gatewayCss).toContain('.learning-center-metric');
  });
});
