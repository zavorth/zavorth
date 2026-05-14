import { Context } from 'grammy';
import { NaturalLanguageRouter } from '../cognitive-firewall/NaturalLanguageRouter.js';
import { SurfaceOperationalIntentService } from '../services/SurfaceOperationalIntentService.js';

type NaturalFileDeliveryController = {
  shouldHandleFreeForm: (text: string, userId: string) => boolean;
  handleFreeForm: (ctx: Context, text: string, userId: string) => Promise<void>;
};

type NaturalInspectionController = {
  shouldHandleNaturalInspection: (text: string) => boolean;
  handleTaskFiles: (ctx: Context, args: string, userId: string) => Promise<void>;
};

type NaturalResearchController = {
  handleResearch: (ctx: Context, args: string) => Promise<void>;
};

type NaturalSchedulerController = {
  handleAutomations: (ctx: Context, args: string, userId: string) => Promise<void>;
};

export type TelegramNaturalCapabilityRoutingServiceDeps = {
  fileDeliveryController: NaturalFileDeliveryController;
  inspectionController?: NaturalInspectionController | null;
  researchController?: NaturalResearchController | null;
  schedulerController?: NaturalSchedulerController | null;
  surfaceOperationalIntentService?: Pick<SurfaceOperationalIntentService, 'classify' | 'toResponseDecision'> | null;
};

export class TelegramNaturalCapabilityRoutingService {
  private readonly naturalRouter = new NaturalLanguageRouter();
  private readonly surfaceOperationalIntentService: Pick<SurfaceOperationalIntentService, 'classify' | 'toResponseDecision'>;

  constructor(private readonly deps: TelegramNaturalCapabilityRoutingServiceDeps) {
    this.surfaceOperationalIntentService = deps.surfaceOperationalIntentService || new SurfaceOperationalIntentService();
  }

  public async dispatch(
    ctx: Context,
    effectiveText: string,
    userId: string,
  ): Promise<boolean> {
    const trimmed = String(effectiveText || '').trim();
    if (!trimmed || trimmed.startsWith('/')) {
      return false;
    }

    if (ctx.chat?.type && ctx.chat.type !== 'private') {
      return false;
    }

    if (ctx.chat?.type === 'private' && this.deps.fileDeliveryController.shouldHandleFreeForm(trimmed, userId)) {
      await this.deps.fileDeliveryController.handleFreeForm(ctx, trimmed, userId);
      return true;
    }

    if (this.deps.inspectionController?.shouldHandleNaturalInspection(trimmed)) {
      await this.deps.inspectionController.handleTaskFiles(ctx, trimmed, userId);
      return true;
    }

    if (this.looksLikeAutomationIntent(trimmed) && this.deps.schedulerController) {
      await this.deps.schedulerController.handleAutomations(ctx, trimmed, userId);
      return true;
    }

    const structuralIntent = this.surfaceOperationalIntentService.classify({
      surface: 'telegram',
      text: trimmed,
    });
    const responseDecision = this.surfaceOperationalIntentService.toResponseDecision(
      { surface: 'telegram', text: trimmed },
      structuralIntent,
    );
    if (responseDecision.responsePath === 'fast-chat') {
      return false;
    }

    const route = this.naturalRouter.route(trimmed);
    if (route.intentCategory === 'research' && this.deps.researchController) {
      await this.deps.researchController.handleResearch(ctx, trimmed);
      return true;
    }

    return false;
  }

  private looksLikeAutomationIntent(text: string): boolean {
    const normalized = this.normalizeText(text);
    if (!normalized) {
      return false;
    }

    const hasAutomationNoun =
      /\b(automacao|automation|agenda|agendar|agende|agend[a-z]*|scheduled|schedule)\b/.test(normalized);
    const hasReminderVerb =
      /\b(me lembre|me lembra|lembra de|lembrar de|remind me)\b/.test(normalized);
    const hasTimeOrRecurrence =
      /\b(hoje|amanha|depois de amanha|todo dia|todos os dias|diariamente|toda semana|todas as semanas|semanalmente|todo mes|mensalmente|a cada|cada \d+\s*(min|mins|minuto|minutos|h|hora|horas|dia|dias|semana|semanas)|daqui a \d+|em \d+\s*(min|mins|minuto|minutos|h|hora|horas|dia|dias|semana|semanas)|as \d{1,2}(?::\d{2})?)\b/.test(normalized);

    return hasAutomationNoun || (hasReminderVerb && hasTimeOrRecurrence);
  }

  private normalizeText(text: string): string {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
