type TelegramTaskSurfaceSecurityInput = {
  source?: string | null;
  surfaceMetadata?: {
    platform?: string | null;
    publicServerMode?: boolean | null;
  } | null;
  composer_payload?: Record<string, any> | null;
};

export type TelegramTaskSurfaceSecurityPosture = {
  untrustedContent: boolean;
  requiresApproval: boolean;
  reason: string | null;
  externalLinkCount: number;
  attachmentCount: number;
};

export class TelegramTaskSurfaceSecurityService {
  private static readonly URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;

  public inspect(
    input: TelegramTaskSurfaceSecurityInput,
    text: string,
  ): TelegramTaskSurfaceSecurityPosture {
    const platform = String(input.surfaceMetadata?.platform || input.source || 'telegram').trim().toLowerCase();
    const publicServerMode = input.surfaceMetadata?.publicServerMode === true;
    const attachments = Array.isArray(input.composer_payload?.attachments)
      ? input.composer_payload?.attachments.filter(Boolean)
      : [];
    const externalLinkCount = (String(text || '').match(TelegramTaskSurfaceSecurityService.URL_PATTERN) || []).length;
    const attachmentCount = attachments.length;

    if (platform === 'discord' && publicServerMode && (externalLinkCount > 0 || attachmentCount > 0)) {
      const reasons: string[] = [];
      if (externalLinkCount > 0) {
        reasons.push(
          externalLinkCount === 1
            ? 'Link externo vindo do Discord publico exige aprovacao manual.'
            : `${externalLinkCount} links externos vindos do Discord publico exigem aprovacao manual.`,
        );
      }
      if (attachmentCount > 0) {
        reasons.push(
          attachmentCount === 1
            ? 'Anexo vindo do Discord publico exige aprovacao manual.'
            : `${attachmentCount} anexos vindos do Discord publico exigem aprovacao manual.`,
        );
      }

      return {
        untrustedContent: true,
        requiresApproval: true,
        reason: reasons.join(' '),
        externalLinkCount,
        attachmentCount,
      };
    }

    return {
      untrustedContent: false,
      requiresApproval: false,
      reason: null,
      externalLinkCount,
      attachmentCount,
    };
  }
}
