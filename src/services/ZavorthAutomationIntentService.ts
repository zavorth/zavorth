import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';

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
    defaultDelivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  }): ZavorthAutomationIntentPlan {
    const original = String(input.intentText || '').trim();
    const defaultDelivery = this.normalizeDelivery(input.defaultDelivery) || 'app';
    if (!original) {
      return {
        intentText: '',
        prompt: '',
        schedule: null,
        scheduleLabel: null,
        delivery: defaultDelivery,
        deliveryTarget: null,
        posture: 'needs_prompt',
        summary: 'Missing description of what the automation should do.',
        reasons: ['Tell me the frequency and task. Example: "every day at 9am check my channels".'],
      };
    }

    const delivery = this.extractDelivery(original, defaultDelivery);
    const schedule = this.extractSchedule(delivery.remainingText);
    const prompt = this.cleanupPrompt(schedule.remainingText);
    const reasons: string[] = [];

    if (!schedule.normalized) {
      reasons.push('I could not find the frequency. Use something like "every day at 9am" or "every 2h".');
    }
    if (!prompt) {
      reasons.push('It was not clear what should run in each round.');
    }

    const posture =
      !prompt ? 'needs_prompt' : (!schedule.normalized ? 'needs_schedule' : 'ready');
    const summary =
      posture === 'ready'
        ? `Automation ready: ${schedule.label} -> ${prompt}${delivery.delivery === 'app' ? ' in app' : ` via ${delivery.delivery}`}.`
        : reasons[0] || 'More details are still required to create the automation.';

    return {
      intentText: original,
      prompt,
      schedule: schedule.normalized,
      scheduleLabel: schedule.label,
      delivery: delivery.delivery,
      deliveryTarget: delivery.target,
      posture,
      summary,
      reasons,
    };
  }

  private extractDelivery(
    text: string,
    fallback: 'telegram' | 'app' | 'email' | 'webhook',
  ): {
    delivery: 'telegram' | 'app' | 'email' | 'webhook';
    target: string | null;
    remainingText: string;
  } {
    let remainingText = String(text || '').trim();
    let delivery = fallback;
    let target: string | null = null;

    const webhookTarget = remainingText.match(/(?:para|via)(?:\s+webhook)?\s+(https?:\/\/\S+)/iu);
    if (/webhook/iu.test(remainingText)) {
      delivery = 'webhook';
      target = webhookTarget ? webhookTarget[1].trim() : null;
      remainingText = remainingText.replace(/(?:por|via|no?)\s+webhook/giu, ' ');
      if (webhookTarget) {
        remainingText = remainingText.replace(webhookTarget[1], ' ');
      }
    } else if (/(?:por|via|no?)\s+email/iu.test(remainingText)) {
      delivery = 'email';
      const emailTarget = remainingText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu);
      target = emailTarget ? emailTarget[0].trim() : null;
      remainingText = remainingText.replace(/(?:por|via|no?)\s+email/giu, ' ');
      if (emailTarget) {
        remainingText = remainingText.replace(emailTarget[0], ' ');
      }
    } else if (/(?:por|via|no?)\s+telegram/iu.test(remainingText)) {
      delivery = 'telegram';
      remainingText = remainingText.replace(/(?:por|via|no?)\s+telegram/giu, ' ');
    } else if (/(?:por|via|no?)\s+(?:app|zavorthControl)/iu.test(remainingText)) {
      delivery = 'app';
      remainingText = remainingText.replace(/(?:por|via|no?)\s+(?:app|zavorthControl)/giu, ' ');
    }

    return {
      delivery,
      target,
      remainingText: remainingText.replace(/\s+/gu, ' ').trim(),
    };
  }

  private extractSchedule(text: string): {
    normalized: string | null;
    label: string | null;
    remainingText: string;
  } {
    let remainingText = String(text || '').trim();

    const dailyMatch = remainingText.match(
      /(?:todo\s+dia|todos\s+os\s+dias)\s*(?:as|às)?\s*(\d{1,2})(?::(\d{2}))?\s*h?/iu,
    );
    if (dailyMatch) {
      const hour = safeParseInt(dailyMatch[1], 0);
      const minute = safeParseInt(dailyMatch[2], 0);
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      remainingText = remainingText.replace(dailyMatch[0], ' ').replace(/\s+/gu, ' ').trim();
      return {
        normalized: `daily ${hh}:${mm}`,
        label: `todo dia as ${hh}:${mm}`,
        remainingText,
      };
    }

    const intervalPt = remainingText.match(/a\s+cada\s+(\d+)\s*([mh])/iu);
    if (intervalPt) {
      const amount = safeParseInt(intervalPt[1], 1);
      const unit = intervalPt[2].toLowerCase();
      remainingText = remainingText.replace(intervalPt[0], ' ').replace(/\s+/gu, ' ').trim();
      return {
        normalized: `every ${amount}${unit}`,
        label: unit === 'm' ? `a cada ${amount} minuto(s)` : `a cada ${amount} hora(s)`,
        remainingText,
      };
    }

    const intervalEn = remainingText.match(/every\s+(\d+)\s*([mh])/iu);
    if (intervalEn) {
      const amount = safeParseInt(intervalEn[1], 1);
      const unit = intervalEn[2].toLowerCase();
      remainingText = remainingText.replace(intervalEn[0], ' ').replace(/\s+/gu, ' ').trim();
      return {
        normalized: `every ${amount}${unit}`,
        label: unit === 'm' ? `a cada ${amount} minuto(s)` : `a cada ${amount} hora(s)`,
        remainingText,
      };
    }

    return {
      normalized: null,
      label: null,
      remainingText,
    };
  }

  private cleanupPrompt(text: string): string {
    return String(text || '')
      .replace(/^(agende|crie\s+uma?\s+automacao\s+para|automatize|schedule)\s+/iu, '')
      .replace(/\s+/gu, ' ')
      .trim();
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
