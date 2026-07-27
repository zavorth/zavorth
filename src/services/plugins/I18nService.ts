import fs from 'fs';
import path from 'path';

export type SupportedLocale = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'ru' | 'ar';

export interface I18nMessages {
  [key: string]: string;
}

export interface I18nLocale {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  messages: I18nMessages;
}

export class I18nService {
  private readonly storageDir: string;
  private readonly locales: Map<SupportedLocale, I18nLocale> = new Map();
  private currentLocale: SupportedLocale = 'en';

  constructor(options?: { storageDir?: string; defaultLocale?: SupportedLocale }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'i18n');
    if (options?.defaultLocale) this.currentLocale = options.defaultLocale;
    this.initDefaultLocales();
  }

  private initDefaultLocales(): void {
    const fallbackMessages: I18nMessages = {
      'welcome': 'Welcome to Zavorth!',
      'setup.title': 'Setup wizard',
      'setup.provider': 'Choose your AI provider',
      'setup.model': 'Select a model',
      'setup.workspace': 'Configure workspace',
      'setup.channels': 'Configure channels',
      'setup.complete': 'Setup complete!',
      'onboarding.start': 'Let us begin',
      'onboarding.name': 'What should I call you...',
      'onboarding.language': 'What language do you prefer...',
      'onboarding.tone': 'How should I communicate...',
      'onboarding.domain': 'What is your main use case...',
      'migrate.title': 'Migration',
      'migrate.source': 'Where is your agent...',
      'migrate.detecting': 'Detecting agent...',
      'migrate.found': 'Found: {name} ({type})',
      'migrate.items': '{count} items to migrate',
      'migrate.start': 'Starting migration...',
      'migrate.complete': 'Migration complete!',
      'migrate.error': 'Migration failed: {error}',
      'error.not_found': 'Not found',
      'error.invalid_input': 'Invalid input',
      'error.permission_denied': 'Permission denied',
      'yes': 'Yes',
      'no': 'No',
      'cancel': 'Cancel',
      'confirm': 'Confirm',
      'back': 'Back',
      'next': 'Next',
      'finish': 'Finish',
      'skip': 'Skip',
    };
    const defaults: I18nLocale[] = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        messages: {
          'welcome': 'Welcome to Zavorth!',
          'setup.title': 'Setup Wizard',
          'setup.provider': 'Choose your AI provider',
          'setup.model': 'Select a model',
          'setup.workspace': 'Configure workspace',
          'setup.channels': 'Setup channels',
          'setup.complete': 'Setup complete!',
          'onboarding.start': 'Let\'s get started',
          'onboarding.name': 'What should I call you...',
          'onboarding.language': 'What language do you prefer...',
          'onboarding.tone': 'How should I communicate...',
          'onboarding.domain': 'What\'s your main use case...',
          'migrate.title': 'Migration',
          'migrate.source': 'Where is your agent located...',
          'migrate.detecting': 'Detecting agent...',
          'migrate.found': 'Found: {name} ({type})',
          'migrate.items': '{count} items to migrate',
          'migrate.start': 'Starting migration...',
          'migrate.complete': 'Migration complete!',
          'migrate.error': 'Migration failed: {error}',
          'error.not_found': 'Not found',
          'error.invalid_input': 'Invalid input',
          'error.permission_denied': 'Permission denied',
          'yes': 'Yes',
          'no': 'No',
          'cancel': 'Cancel',
          'confirm': 'Confirm',
          'back': 'Back',
          'next': 'Next',
          'finish': 'Finish',
          'skip': 'Skip',
        },
      },
      {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        messages: {
          'welcome': 'Bem-vindo ao Zavorth!',
          'setup.title': 'Assistente de configuração',
          'setup.provider': 'Escolha seu provedor de IA',
          'setup.model': 'Selecione um modelo',
          'setup.workspace': 'Configure o workspace',
          'setup.channels': 'Configure os canais',
          'setup.complete': 'Configuração concluída!',
          'onboarding.start': 'Vamos começar',
          'onboarding.name': 'Como devo te chamar...',
          'onboarding.language': 'Qual idioma você prefere...',
          'onboarding.tone': 'Como devo me comunicar...',
          'onboarding.domain': 'Qual é seu uso principal...',
          'migrate.title': 'Migração',
          'migrate.source': 'Onde está seu agente...',
          'migrate.detecting': 'Detectando agente...',
          'migrate.found': 'Encontrado: {name} ({type})',
          'migrate.items': '{count} itens para migrar',
          'migrate.start': 'Iniciando migração...',
          'migrate.complete': 'Migração concluída!',
          'migrate.error': 'Falha na migração: {error}',
          'error.not_found': 'Não encontrado',
          'error.invalid_input': 'Entrada inválida',
          'error.permission_denied': 'Permissão negada',
          'yes': 'Sim',
          'no': 'Não',
          'cancel': 'Cancelar',
          'confirm': 'Confirmar',
          'back': 'Voltar',
          'next': 'Próximo',
          'finish': 'Finalizar',
          'skip': 'Pular',
        },
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        messages: {
          'welcome': '¡Bienvenido a Zavorth!',
          'setup.title': 'Asistente de configuración',
          'setup.provider': 'Elige tu proveedor de IA',
          'setup.model': 'Selecciona un modelo',
          'setup.workspace': 'Configura el workspace',
          'setup.channels': 'Configura los canales',
          'setup.complete': '¡Configuración completada!',
          'onboarding.start': 'Empecemos',
          'onboarding.name': '¿Cómo debo llamarte...',
          'onboarding.language': '¿Qué idioma prefieres...',
          'onboarding.tone': '¿Cómo debo comunicarme...',
          'onboarding.domain': '¿Cuál es tu uso principal...',
          'migrate.title': 'Migración',
          'migrate.source': '¿Dónde está tu agente...',
          'migrate.detecting': 'Detectando agente...',
          'migrate.found': 'Encontrado: {name} ({type})',
          'migrate.items': '{count} elementos para migrar',
          'migrate.start': 'Iniciando migración...',
          'migrate.complete': '¡Migración completada!',
          'migrate.error': 'Migración fallida: {error}',
          'error.not_found': 'No encontrado',
          'error.invalid_input': 'Entrada inválida',
          'error.permission_denied': 'Permiso denegado',
          'yes': 'Sí',
          'no': 'No',
          'cancel': 'Cancelar',
          'confirm': 'Confirmar',
          'back': 'Atrás',
          'next': 'Siguiente',
          'finish': 'Finalizar',
          'skip': 'Omitir',
        },
      },
      { code: 'fr', name: 'French', nativeName: 'Français', messages: fallbackMessages },
      { code: 'de', name: 'German', nativeName: 'Deutsch', messages: fallbackMessages },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', messages: fallbackMessages },
      { code: 'zh', name: 'Chinese', nativeName: '中文', messages: fallbackMessages },
      { code: 'ko', name: 'Korean', nativeName: '한국어', messages: fallbackMessages },
      { code: 'ru', name: 'Russian', nativeName: 'Русский', messages: fallbackMessages },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', messages: fallbackMessages },
    ];

    for (const locale of defaults) {
      this.locales.set(locale.code, locale);
    }
  }

  public setLocale(locale: SupportedLocale): void {
    if (this.locales.has(locale)) {
      this.currentLocale = locale;
    }
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public t(key: string, params?: Record<string, string | number>): string {
    const locale = this.locales.get(this.currentLocale);
    if (!locale) return key;

    let message = locale.messages[key] || key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        message = message.replace(`{${paramKey}}`, String(paramValue));
      }
    }

    return message;
  }

  public listLocales(): Array<{ code: SupportedLocale; name: string; nativeName: string }> {
    return Array.from(this.locales.values()).map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
    }));
  }

  public addLocale(locale: I18nLocale): void {
    this.locales.set(locale.code, locale);
  }

  public getMessageCount(locale: SupportedLocale): number {
    const l = this.locales.get(locale);
    return l ? Object.keys(l.messages).length : 0;
  }
}
