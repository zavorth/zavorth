import { ZavorthAutomationIntentService } from '../../src/services/ZavorthAutomationIntentService.js';

describe('ZavorthAutomationIntentService', () => {
  it('builds a ready automation plan from structured canonical input', () => {
    const service = new ZavorthAutomationIntentService();

    const plan = service.buildPlan({
      intentText: 'check important channels',
      promptText: 'check important channels',
      scheduleText: '{"kind":"daily","targetHour":9,"targetMinute":0}',
      delivery: 'app',
      defaultDelivery: 'telegram',
    });

    expect(plan.posture).toBe('ready');
    expect(plan.schedule).toBe('{"kind":"daily","targetHour":9,"targetMinute":0}');
    expect(plan.delivery).toBe('app');
    expect(plan.prompt).toContain('check important channels');
  });

  it('keeps explicit webhook delivery target from structured input', () => {
    const service = new ZavorthAutomationIntentService();

    const plan = service.buildPlan({
      intentText: 'review transports',
      promptText: 'review transports',
      scheduleText: '{"kind":"interval","intervalMs":7200000}',
      delivery: 'webhook',
      deliveryTarget: 'https://example.com/hook',
      defaultDelivery: 'app',
    });

    expect(plan.posture).toBe('ready');
    expect(plan.schedule).toBe('{"kind":"interval","intervalMs":7200000}');
    expect(plan.delivery).toBe('webhook');
    expect(plan.deliveryTarget).toBe('https://example.com/hook');
  });

  it('does not infer schedule from language-specific free text', () => {
    const service = new ZavorthAutomationIntentService();

    const plan = service.buildPlan({
      intentText: 'please do this tomorrow morning',
      defaultDelivery: 'app',
    });

    expect(plan.posture).toBe('needs_schedule');
    expect(plan.schedule).toBeNull();
  });
});
