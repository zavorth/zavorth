import { logger } from '../../../../logger.js';
import { Context, InputFile } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';

export class TelegramHubHeroService {
  public async sendHubHero(ctx: Context): Promise<void> {
    const heroPath = this.getHubHeroAssetPath();
    if (!fs.existsSync(heroPath)) {
      return;
    }

    try {
      await (ctx as any).replyWithPhoto(new InputFile(heroPath, 'zavorth-hub.png'), {
        caption: this.buildHubHeroCaption(),
        parse_mode: 'Markdown',
        show_caption_above_media: true,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Falha ao enviar hero do hub: ${msg}`);
    }
  }

  private getHubHeroAssetPath(): string {
    return path.resolve(process.cwd(), 'assets', 'telegram', 'zavorth-hub.png');
  }

  private buildHubHeroCaption(): string {
    return [
      '*Zavorth Control*',
      '',
      'Seu assistente para codigo, automacao, WSL, pesquisa e permissoes com controle.',
      '',
      '- Codex local',
      '- ExternalExecutor no WSL',
      '- ZavorthBridge assistido',
      '- Politicas, modos e aprovacoes',
    ].join('\n');
  }
}
