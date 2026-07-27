import {
  parseNaturalSchedule,
  parseNaturalScheduleAsync,
  type NaturalScheduleParseResult,
} from './scheduling/NaturalScheduleParser.js';

export type ZavorthAutomationIntentPlan = {
  intentText: string;
  prompt: string;
  schedule: string | null;
  scheduleLabel: string | null;
  delivery: 'telegram' | 'app' | 'email' | 'webhook';
  deliveryTarget: string | null;
  posture: 'ready' | 'needs_schedule' | 'needs_prompt';
  summary: string;
  reasons: string[];
};

export class ZavorthAutomationIntentService {
  public buildPlan(input: {
    intentText: string;
    promptText?: string | null;
    scheduleText?: string | null;
    delivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
    deliveryTarget?: string | null;
    defaultDelivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  }): ZavorthAutomationIntentPlan {
    const parsedSchedule = parseNaturalSchedule(String(input.scheduleText || '').trim());
    return this.buildPlanFromParsedSchedule(input, parsedSchedule);
  }

  public async buildPlanAsync(input: {
    intentText: string;
    promptText?: string | null;
    scheduleText?: string | null;
    delivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
    deliveryTarget?: string | null;
    defaultDelivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  }): Promise<ZavorthAutomationIntentPlan> {
    const parsedSchedule = await parseNaturalScheduleAsync(String(input.scheduleText || '').trim());
    return this.buildPlanFromParsedSchedule(input, parsedSchedule);
  }

  private buildPlanFromParsedSchedule(
    input: {
      intentText: string;
      promptText?: string | null;
      scheduleText?: string | null;
      delivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
      deliveryTarget?: string | null;
      defaultDelivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
    },
    parsedSchedule: NaturalScheduleParseResult | null,
  ): ZavorthAutomationIntentPlan {
    const original = String(input.intentText || '').trim();
    const prompt = String(input.promptText || '').trim() || original;
    const defaultDelivery = this.normalizeDelivery(input.defaultDelivery) || 'app';
    const delivery = this.normalizeDelivery(input.delivery) || defaultDelivery;
    const deliveryTarget = String(input.deliveryTarget || '').trim() || null;
    const reasons: string[] = [];

    if (!prompt) {
      reasons.push('Missing description of what the automation should do.');
    }
    if (!parsedSchedule) {
      reasons.push('Missing canonical schedule. Provide a stable JSON schedule or connect the schedule intent resolver so natural language can be converted before persistence.');
    }

    const posture =
      !prompt ? 'needs_prompt' : (!parsedSchedule ? 'needs_schedule' : 'ready');
    const summary =
      posture === 'ready' && parsedSchedule
        ? `Automation ready: ${parsedSchedule.label} -> ${prompt}${delivery === 'app' ? ' in app' : ` via ${delivery}`}.`
        : reasons[0] || 'More details are required to create the automation.';

    return {
      intentText: original,
      prompt,
      schedule: parsedSchedule?.normalized || null,
      scheduleLabel: parsedSchedule?.label || null,
      delivery,
      deliveryTarget,
      posture,
      summary,
      reasons,
    };
  }

  private normalizeDelivery(
    value: unknown,
  ): 'telegram' | 'app' | 'email' | 'webhook' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'telegram' || normalized === 'app' || normalized === 'email' || normalized === 'webhook') {
      return normalized;
    }
    return null;
  }
}
