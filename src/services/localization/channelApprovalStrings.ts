/**
 * Channel approval prompt/receipt resolution backed by the unified
 * localization system.
 *
 * The copy lives under the `approval` namespace of the locale catalogs with
 * English canonical and Portuguese coverage; lookups cascade from the chat's
 * preferred language tag to English exactly like every other catalog section.
 */

import type { SupportedLocale } from './localeContracts.js';
import { createLegacyAwareLocalizationService } from './legacySupport.js';

export type ChannelApprovalMessageKey =
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

const APPROVAL_NAMESPACE = 'approval';
const DEFAULT_APPROVAL_LOCALE: SupportedLocale = 'en';

const localizationService = createLegacyAwareLocalizationService();

/**
 * Resolves the approval-string locale with a fail-safe cascade: exact tag,
 * then primary-language prefix match (for example "pt-BR" resolves "pt"),
 * then English. Ordinals stay universal; only words localize.
 */
export function resolveChannelApprovalLocale(preferredLanguageCode?: string | null): SupportedLocale {
  const requested = String(preferredLanguageCode || '').trim();
  if (!requested) {
    return DEFAULT_APPROVAL_LOCALE;
  }
  return localizationService.normalizeLocaleTag(requested) || DEFAULT_APPROVAL_LOCALE;
}

export function formatChannelApprovalString(
  key: ChannelApprovalMessageKey,
  vars: Record<string, string | number> = {},
  preferredLanguageCode?: string | null,
): string {
  const locale = resolveChannelApprovalLocale(preferredLanguageCode);
  const keyPath = `${APPROVAL_NAMESPACE}.${key}`;
  const localized = localizationService.t(keyPath, vars, locale);
  if (localized !== keyPath) {
    return localized;
  }
  const english = localizationService.t(keyPath, vars, DEFAULT_APPROVAL_LOCALE);
  return english !== keyPath ? english : keyPath;
}
