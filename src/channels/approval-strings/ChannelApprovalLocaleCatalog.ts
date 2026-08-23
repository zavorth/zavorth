import { interpolate } from '../../i18n/interpolation.js';
import type { InterpolationVars } from '../../i18n/types.js';

export type ChannelApprovalLocaleKey =
  | 'prompt.entry'
  | 'prompt.hint'
  | 'receipt.approved'
  | 'receipt.denied'
  | 'receipt.notFound'
  | 'receipt.resolvedApprovedElsewhere'
  | 'receipt.resolvedDeniedElsewhere'
  | 'bulk.approvedAll'
  | 'bulk.deniedAll'
  | 'bulk.approvedPartial'
  | 'bulk.deniedPartial'
  | 'bulk.notFound'
  | 'other.armed'
  | 'other.deniedWithReason'
  | 'other.referencedNotFound';

export const CHANNEL_APPROVAL_LOCALES = ['en-US', 'pt-BR'] as const;

export type ChannelApprovalResolvedLocale = (typeof CHANNEL_APPROVAL_LOCALES)[number];

const EN_US: Record<ChannelApprovalLocaleKey, string> = {
  'prompt.entry': '{ordinal}[{risk}] {label} — ref {ref}',
  'prompt.hint':
    'Reply 1 (or the ref) to allow once, approve / approve session / approve always, reject (or deny) to refuse, or reply other to type your answer.',
  'receipt.approved': 'Approved {ref} ({choice}).',
  'receipt.denied': 'Denied approval {ref}.',
  'receipt.notFound': 'No pending approval found for {ref}.',
  'receipt.resolvedApprovedElsewhere':
    'Resolved elsewhere: approval {ref} was approved on another surface. No action is needed here.',
  'receipt.resolvedDeniedElsewhere':
    'Resolved elsewhere: approval {ref} was denied on another surface. No action is needed here.',
  'bulk.approvedAll': 'Approved all {count} approval(s) ({choice}).',
  'bulk.deniedAll': 'Denied {count} approval(s).',
  'bulk.approvedPartial': 'Approved {resolved} of {total} approval(s) ({choice}).',
  'bulk.deniedPartial': 'Denied {resolved} of {total} approval(s).',
  'bulk.notFound': 'No pending approval found for all.',
  'other.armed':
    'Describe your answer for {count} pending approval(s); your next message is captured as the decision context.',
  'other.deniedWithReason': 'Denied {count} approval(s). Your answer was relayed to the agent.',
  'other.referencedNotFound': 'No pending approval found for the referenced approvals.',
};

const PT_BR: Record<ChannelApprovalLocaleKey, string> = {
  'prompt.entry': '{ordinal}[{risk}] {label} — ref {ref}',
  'prompt.hint':
    'Responda 1 (ou a referência) para permitir uma vez; use /approve <referência> com once/session/always, /reject <referência> (ou /deny) para negar, ou responda other para digitar sua resposta.',
  'receipt.approved': 'Aprovado {ref} ({choice}).',
  'receipt.denied': 'Aprovação {ref} negada.',
  'receipt.notFound': 'Nenhuma aprovação pendente encontrada para {ref}.',
  'receipt.resolvedApprovedElsewhere':
    'Resolvida em outra superfície: a aprovação {ref} foi aprovada em outra superfície. Nenhuma ação é necessária aqui.',
  'receipt.resolvedDeniedElsewhere':
    'Resolvida em outra superfície: a aprovação {ref} foi negada em outra superfície. Nenhuma ação é necessária aqui.',
  'bulk.approvedAll': 'Todas as {count} aprovações foram aprovadas ({choice}).',
  'bulk.deniedAll': '{count} aprovações foram negadas.',
  'bulk.approvedPartial': '{resolved} de {total} aprovações aprovadas ({choice}).',
  'bulk.deniedPartial': '{resolved} de {total} aprovações negadas.',
  'bulk.notFound': 'Nenhuma aprovação pendente encontrada para all.',
  'other.armed':
    'Descreva sua resposta para {count} aprovação(ões) pendente(s); sua próxima mensagem será capturada como o contexto da decisão.',
  'other.deniedWithReason': '{count} aprovações negadas. Sua resposta foi repassada ao agente.',
  'other.referencedNotFound': 'Nenhuma aprovação pendente encontrada para as referências informadas.',
};

const CATALOGS: Record<ChannelApprovalResolvedLocale, Record<ChannelApprovalLocaleKey, string>> = {
  'en-US': EN_US,
  'pt-BR': PT_BR,
};

/**
 * Resolves the approval-string locale with a fail-safe cascade: exact match,
 * then primary-language prefix match (for example "pt" resolves pt-BR),
 * then en-US. Ordinals stay universal; only words localize.
 */
export function resolveChannelApprovalLocale(preferredLanguageCode?: string | null): ChannelApprovalResolvedLocale {
  const requested = String(preferredLanguageCode || '').trim();
  if (!requested) {
    return 'en-US';
  }
  const lowered = requested.toLowerCase();
  for (const locale of CHANNEL_APPROVAL_LOCALES) {
    if (locale.toLowerCase() === lowered) {
      return locale;
    }
  }
  const primary = lowered.split(/[-_]/)[0];
  for (const locale of CHANNEL_APPROVAL_LOCALES) {
    if (locale.toLowerCase().startsWith(`${primary}-`) || locale.toLowerCase() === primary) {
      return locale;
    }
  }
  return 'en-US';
}

export function formatChannelApprovalString(
  locale: ChannelApprovalResolvedLocale,
  key: ChannelApprovalLocaleKey,
  vars: InterpolationVars = {},
): string {
  const template = CATALOGS[locale][key] ?? CATALOGS['en-US'][key];
  return interpolate(template, vars);
}
