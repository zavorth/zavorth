/**
 *  E2 — hermetic AgentSmartnessService scoreboard importability.
 */

import { AgentSmartnessService } from '../../../src/services/agent-smartness/AgentSmartnessService.js';

describe(' AgentSmartnessService hermetic scoreboard', () => {
  it('runs hermetic unit missions without claiming live intelligence', async () => {
    const service = new AgentSmartnessService();
    const report = await service.run();

    expect(report.version).toBe('agent-smartness/v1');
    expect(report.mode).toBe('hermetic-unit');
    expect(report.claimsLiveIntelligence).toBe(false);
    expect(report.simulated).toBe(false);
    expect(report.total).toBeGreaterThan(0);
    expect(report.results.length).toBe(report.total);
    expect(typeof report.missionSuccessRate).toBe('number');
    expect(report.passed + report.failed).toBe(report.total);
  });

  it('renderText includes scoreboard headline', async () => {
    const service = new AgentSmartnessService();
    const report = await service.run();
    const text = service.renderText(report);
    expect(text).toMatch(/Agent Smartness|scoreboard|hermetic/i);
    expect(text).toContain(`${report.passed}/${report.total}`);
  });
});
