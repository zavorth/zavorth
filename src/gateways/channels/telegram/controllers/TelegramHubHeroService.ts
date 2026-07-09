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
    } catch (error: any) { const err = error; const e = error;
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to send hub hero: ${msg}`);
    }
  }

  private getHubHeroAssetPath(): string {
    return path.resolve(process.cwd(), 'assets', 'telegram', 'zavorth-hub.png');
  }

  private buildHubHeroCaption(): string {
    return [
      '*Zavorth Control*',
      '',
      'Your assistant for code, automation, WSL, research, and governed permissions.',
      '',
      '- Codex local',
      '- ExternalExecutor in WSL',
      '- Assisted ZavorthBridge',
      '- Policies, modes, and approvals',
    ].join('\n');
  }
}
