import { Context, InlineKeyboard } from 'grammy';
import {
  TelegramHubContentService,
  type TelegramHubContentServiceDeps,
} from '../../../../gateways/channels/telegram/controllers/TelegramHubContentService.js';
import { TelegramHubHeroService } from '../../../../gateways/channels/telegram/controllers/TelegramHubHeroService.js';

import { TelegramHubKeyboardService } from '../../../../gateways/channels/telegram/controllers/TelegramHubKeyboardService.js';
import { HubRecipeKind, HubSection } from '../../../../gateways/channels/telegram/controllers/TelegramHubTypes.js';

export type { HubRecipeKind, HubSection } from '../../../../gateways/channels/telegram/controllers/TelegramHubTypes.js';

export type TelegramHubRenderServiceDeps = TelegramHubContentServiceDeps;

export class TelegramHubRenderService {
  private readonly contentService: TelegramHubContentService;
  private readonly heroService: TelegramHubHeroService;
  private readonly keyboardService: TelegramHubKeyboardService;

  constructor(deps: TelegramHubRenderServiceDeps) {
    this.contentService = new TelegramHubContentService(deps);
    this.heroService = new TelegramHubHeroService();
    this.keyboardService = new TelegramHubKeyboardService();
  }

  public async buildHubPageText(section: HubSection): Promise<string> {
    return this.contentService.buildHubPageText(section);
  }

  public buildHubKeyboard(section: HubSection): InlineKeyboard {
    return this.keyboardService.buildHubKeyboard(section);
  }

  public formatRecipeMessage(kind: HubRecipeKind): string {
    return this.contentService.formatRecipeMessage(kind);
  }

  public async sendHubHero(ctx: Context): Promise<void> {
    return this.heroService.sendHubHero(ctx);
  }
}
