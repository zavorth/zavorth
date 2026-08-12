import { ZavorthAutomationIntentService } from '../../src/services/ZavorthAutomationIntentService.js';

describe('ZavorthAutomationIntentService', () => {
  it('parses a daily natural-first automation request', () => {
    const service = new ZavorthAutomationIntentService();

    const plan = service.buildPlan({
      intentText: 'todo dia as 9h verifique meus canais no app',
      defaultDelivery: 'telegram',
    });

    expect(plan.posture).toBe('ready');
    expect(plan.schedule).toBe('daily 09:00');
    expect(plan.delivery).toBe('app');
    expect(plan.prompt).toContain('verifique meus canais');
  });

  it('keeps webhook delivery target when present', () => {
    const service = new ZavorthAutomationIntentService();

    const plan = service.buildPlan({
      intentText: 'a cada 2h revisar transports via webhook https://example.com/hook',
      defaultDelivery: 'app',
    });

    expect(plan.posture).toBe('ready');
    expect(plan.schedule).toBe('every 2h');
    expect(plan.delivery).toBe('webhook');
    expect(plan.deliveryTarget).toBe('https://example.com/hook');
  });
});
