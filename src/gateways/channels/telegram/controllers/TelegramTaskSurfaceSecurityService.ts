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
            ? 'External link from public Discord requires manual approval.'
            : `${externalLinkCount} external links from public Discord require manual approval.`,
        );
      }
      if (attachmentCount > 0) {
        reasons.push(
          attachmentCount === 1
            ? 'Attachment from public Discord requires manual approval.'
            : `${attachmentCount} attachments from public Discord require manual approval.`,
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
