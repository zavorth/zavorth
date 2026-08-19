/**
 * Universal Localization Contracts and Type Definitions.
 *
 * Defines strictly typed structures for all supported UI, channel,
 * engine, and administrative surfaces across the Zavorth runtime.
 */

export const SUPPORTED_LOCALES = [
  'en',
  'pt',
  'es',
  'zh',
  'zh-hant',
  'ja',
  'de',
  'fr',
  'ru',
  'ko',
  'it',
  'ar',
  'tr',
  'uk',
  'af',
  'ga',
  'hu',
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const RTL_LOCALES = new Set<SupportedLocale>(['ar']);

export const LOCALE_ENDONYMS: Record<SupportedLocale, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
  zh: '简体中文',
  'zh-hant': '繁體中文',
  ja: '日本語',
  de: 'Deutsch',
  fr: 'Français',
  ru: 'Русский',
  ko: '한국어',
  it: 'Italiano',
  ar: 'العربية',
  tr: 'Türkçe',
  uk: 'Українська',
  af: 'Afrikaans',
  ga: 'Gaeilge',
  hu: 'Magyar',
};

export interface CommonTranslations {
  save: string;
  saving: string;
  cancel: string;
  close: string;
  confirm: string;
  delete: string;
  refresh: string;
  retry: string;
  search: string;
  loading: string;
  create: string;
  creating: string;
  clear: string;
  enabled: string;
  disabled: string;
  active: string;
  inactive: string;
  status: string;
  actions: string;
  details: string;
  error: string;
  success: string;
  none: string;
}

export interface AppTranslations {
  title: string;
  tagline: string;
  chat: string;
  files: string;
  approvals: string;
  memory: string;
  plugins: string;
  channels: string;
  settings: string;
  workboard: string;
  automations: string;
  analytics: string;
}

export interface ChatTranslations {
  placeholder: string;
  send: string;
  stop: string;
  clearHistory: string;
  emptyState: string;
  tokens: string;
  thinking: string;
  errorOccurred: string;
}

export interface ChannelTranslations {
  title: string;
  description: string;
  primaryChannel: string;
  telegram: string;
  discord: string;
  slack: string;
  whatsapp: string;
  web: string;
  notConfigured: string;
  connected: string;
  disconnected: string;
}

export interface ProviderTranslations {
  title: string;
  description: string;
  primaryProvider: string;
  primaryModel: string;
  fallbackModel: string;
  apiKey: string;
  saveRoute: string;
  savedSuccessfully: string;
  saveFailed: string;
}

export interface MnemosTranslations {
  title: string;
  description: string;
  searchFacts: string;
  recall: string;
  forget: string;
  totalFacts: string;
  noFactsRecorded: string;
}

export interface KanbanTranslations {
  title: string;
  description: string;
  backlog: string;
  inProgress: string;
  review: string;
  autoRepairLane: string;
  done: string;
  createTask: string;
  taskTitle: string;
  priority: string;
}

export interface AutoRepairTranslations {
  title: string;
  description: string;
  resolvingFailure: string;
  patchApplied: string;
  testsPassing: string;
  rollbackRecovered: string;
  incidentHistory: string;
}

export interface CodeGraphTranslations {
  title: string;
  description: string;
  symbolsIndexed: string;
  callGraph: string;
  impactAnalysis: string;
  callerDependencies: string;
}

export interface DiffReviewTranslations {
  title: string;
  description: string;
  riskRating: string;
  securityAudit: string;
  secretCheck: string;
  breakingChanges: string;
  approved: string;
  rejected: string;
}

export interface ApprovalTranslations {
  title: string;
  description: string;
  pendingApprovals: string;
  approve: string;
  reject: string;
  riskLevel: string;
  commandPreview: string;
  noPendingApprovals: string;
}

export interface SettingsTranslations {
  title: string;
  language: string;
  theme: string;
  logLevel: string;
  resetDefaults: string;
}

export interface LocalizationCatalog {
  common: CommonTranslations;
  app: AppTranslations;
  chat: ChatTranslations;
  channels: ChannelTranslations;
  providers: ProviderTranslations;
  mnemos: MnemosTranslations;
  kanban: KanbanTranslations;
  autoRepair: AutoRepairTranslations;
  codeGraph: CodeGraphTranslations;
  diffReview: DiffReviewTranslations;
  approvals: ApprovalTranslations;
  settings: SettingsTranslations;
}
