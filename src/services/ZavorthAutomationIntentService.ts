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
        summary: 'Faltou descrever o que a automacao deve fazer.',
        reasons: ['Diga a frequencia e a tarefa. Ex.: "todo dia as 9h verifique meus canais".'],
      };
    }

    const delivery = this.extractDelivery(original, defaultDelivery);
    const schedule = this.extractSchedule(delivery.remainingText);
    const prompt = this.cleanupPrompt(schedule.remainingText);
    const reasons: string[] = [];

    if (!schedule.normalized) {
      reasons.push('Nao achei a frequencia. Use algo como "todo dia as 9h" ou "a cada 2h".');
    }
    if (!prompt) {
      reasons.push('Nao ficou claro o que deve ser executado em cada rodada.');
    }

    const posture =
      !prompt ? 'needs_prompt' : (!schedule.normalized ? 'needs_schedule' : 'ready');
    const summary =
      posture === 'ready'
        ? `Automacao pronta: ${schedule.label} -> ${prompt}${delivery.delivery === 'app' ? ' no app' : ` via ${delivery.delivery}`}.`
        : reasons[0] || 'Ainda faltam detalhes para criar a automacao.';

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
    } else if (/(?:por|via|no?)\s+(?:app|dashboard)/iu.test(remainingText)) {
      delivery = 'app';
      remainingText = remainingText.replace(/(?:por|via|no?)\s+(?:app|dashboard)/giu, ' ');
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
      const hour = Number.parseInt(dailyMatch[1], 10);
      const minute = Number.parseInt(dailyMatch[2] || '0', 10);
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
      const amount = Number.parseInt(intervalPt[1], 10);
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
      const amount = Number.parseInt(intervalEn[1], 10);
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
