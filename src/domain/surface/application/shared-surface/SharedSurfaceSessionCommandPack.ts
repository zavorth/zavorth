import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { SharedSurfaceSessionNodeCommandPack } from './SharedSurfaceSessionNodeCommandPack.js';

type NaturalSessionIntent = {
  command: 'sessions' | 'sessionhistory' | 'sessionsend' | 'sessionspawn';
  args: string;
  intro: string;
};

export type SharedSurfaceSessionCommandPackDeps = {
  sessionNodeCommandPack: Pick<SharedSurfaceSessionNodeCommandPack, 'maybeHandle'>;
};

export class SharedSurfaceSessionCommandPack {
  public constructor(private readonly deps: SharedSurfaceSessionCommandPackDeps) {}

  public async maybeHandleNaturalSession(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const intent =
      !String(rawText || '').trim().startsWith('/')
        ? this.parseNaturalSessionIntent(rawText)
        : null;
    if (!intent) {
      return false;
    }

    await this.handleNaturalSessionIntent(ctx, intent);
    return true;
  }

  private parseNaturalSessionIntent(rawText: string): NaturalSessionIntent | null {
    const original = String(rawText || '').trim();
    const normalized = this.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    const mentionsSessionPlane =
      /\b(sessao|sessoes|session|sessions|historico|history|replay|handoff)\b/.test(normalized);
    if (!mentionsSessionPlane || /\bcodex\b/.test(normalized)) {
      return null;
    }

    const sendPayload = this.extractNaturalSessionSendPayload(original, normalized);
    if (sendPayload) {
      return {
        command: 'sessionsend',
        args: `${sendPayload.targetRef} -- ${sendPayload.message}`,
        intro: `Entendi que voce quer enviar uma mensagem para a sessao ${sendPayload.targetRef}.`,
      };
    }

    const targetRef = this.extractNaturalSessionTargetRef(normalized);

    if (/\b(historico|history|replay|handoff|timeline|transcricao|transcript)\b/.test(normalized)) {
      return {
        command: 'sessionhistory',
        args: targetRef || '',
        intro: targetRef
          ? `Entendi que voce quer abrir o replay da sessao ${targetRef}.`
          : 'Entendi que voce quer abrir o replay da sessao atual.',
      };
    }

    if (/\b(abrir|abra|criar|crie|nova|novo|spawn|derivar|derivada)\b/.test(normalized)) {
      const requestedPlatform = this.extractNaturalSessionPlatform(normalized) || 'web';
      return {
        command: 'sessionspawn',
        args: requestedPlatform,
        intro: `Entendi que voce quer abrir uma sessao derivada em ${requestedPlatform}.`,
      };
    }

    if (/\b(listar|lista|mostrar|mostre|ver|quais|minhas|overview|painel|status)\b/.test(normalized)) {
      return {
        command: 'sessions',
        args: targetRef || '',
        intro: targetRef
          ? `Entendi que voce quer inspecionar a sessao ${targetRef}.`
          : 'Entendi que voce quer ver o session plane do Zavorth.',
      };
    }

    return null;
  }

  private async handleNaturalSessionIntent(
    ctx: IMessageContext,
    intent: NaturalSessionIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    switch (intent.command) {
      case 'sessionhistory':
        await this.deps.sessionNodeCommandPack.maybeHandle(ctx, '/sessionhistory', intent.args);
        return;
      case 'sessionsend':
        await this.deps.sessionNodeCommandPack.maybeHandle(ctx, '/sessionsend', intent.args);
        return;
      case 'sessionspawn':
        await this.deps.sessionNodeCommandPack.maybeHandle(ctx, '/sessionspawn', intent.args);
        return;
      case 'sessions':
      default:
        await this.deps.sessionNodeCommandPack.maybeHandle(ctx, '/sessions', intent.args);
    }
  }

  private extractNaturalSessionTargetRef(normalized: string): string | null {
    const explicitRefMatch = normalized.match(/\b(web|telegram|discord|slack|whatsapp|instagram|signal|imessage|teams|email):([a-z0-9._:-]+)\b/);
    if (explicitRefMatch) {
      return `${explicitRefMatch[1]}:${explicitRefMatch[2]}`;
    }

    const sessionRefMatch = normalized.match(/\b(?:sessao|session)\s+([a-z0-9][a-z0-9:_-]*)\b/);
    if (sessionRefMatch?.[1]) {
      return sessionRefMatch[1];
    }

    return null;
  }

  private extractNaturalSessionPlatform(normalized: string): string | null {
    const platforms = ['web', 'telegram', 'discord', 'slack', 'whatsapp', 'instagram', 'signal', 'imessage', 'teams', 'email'];
    for (const platform of platforms) {
      const pattern = new RegExp(`\\b${this.escapeRegex(platform)}\\b`, 'i');
      if (pattern.test(normalized)) {
        return platform;
      }
    }

    return null;
  }

  private extractNaturalSessionSendPayload(
    originalText: string,
    normalizedText: string,
  ): {
    targetRef: string;
    message: string;
  } | null {
    if (!/\b(mande|mandar|envie|enviar|despache|despachar|responda|responder|fale com|falar com)\b/.test(normalizedText)) {
      return null;
    }

    const targetRef = this.extractNaturalSessionTargetRef(normalizedText);
    if (!targetRef) {
      return null;
    }

    const quoted = originalText.match(/["'â€œâ€â€˜â€™]([^"'â€œâ€â€˜â€™]+)["'â€œâ€â€˜â€™]/);
    if (quoted?.[1]?.trim()) {
      return {
        targetRef,
        message: quoted[1].trim(),
      };
    }

    const inlineMatch = originalText.match(
      /\b(?:mande|mandar|envie|enviar|despache|despachar|responda|responder)\b\s+(.+?)\s+\b(?:para|pra)\b/i,
    );
    const message = inlineMatch?.[1]
      ?.replace(/^(a\s+mensagem|mensagem)\s+/i, '')
      .trim();
    if (!message) {
      return null;
    }

    return {
      targetRef,
      message,
    };
  }

  private normalizeNaturalText(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private escapeRegex(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
