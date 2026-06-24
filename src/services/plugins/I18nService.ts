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
          'onboarding.name': 'What should I call you?',
          'onboarding.language': 'What language do you prefer?',
          'onboarding.tone': 'How should I communicate?',
          'onboarding.domain': 'What\'s your main use case?',
          'migrate.title': 'Migration',
          'migrate.source': 'Where is your agent located?',
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
          'setup.title': 'Assistente de Configuração',
          'setup.provider': 'Escolha seu provedor de IA',
          'setup.model': 'Selecione um modelo',
          'setup.workspace': 'Configure o workspace',
          'setup.channels': 'Configure os canais',
          'setup.complete': 'Configuração concluída!',
          'onboarding.start': 'Vamos começar',
          'onboarding.name': 'Como devo te chamar?',
          'onboarding.language': 'Qual idioma você prefere?',
          'onboarding.tone': 'Como devo me comunicar?',
          'onboarding.domain': 'Qual seu principal uso?',
          'migrate.title': 'Migração',
          'migrate.source': 'Onde está seu agente?',
          'migrate.detecting': 'Detectando agente...',
          'migrate.found': 'Encontrado: {name} ({type})',
          'migrate.items': '{count} itens para migrar',
          'migrate.start': 'Iniciando migração...',
          'migrate.complete': 'Migração concluída!',
          'migrate.error': 'Migração falhou: {error}',
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
          'setup.title': 'Asistente de Configuración',
          'setup.provider': 'Elige tu proveedor de IA',
          'setup.model': 'Selecciona un modelo',
          'setup.workspace': 'Configura el workspace',
          'setup.channels': 'Configura los canales',
          'setup.complete': '¡Configuración completada!',
          'onboarding.start': 'Empecemos',
          'onboarding.name': '¿Cómo debo llamarte?',
          'onboarding.language': '¿Qué idioma prefieres?',
          'onboarding.tone': '¿Cómo debo comunicarme?',
          'onboarding.domain': '¿Cuál es tu principal uso?',
          'migrate.title': 'Migración',
          'migrate.source': '¿Dónde está tu agente?',
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
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        messages: {
          'welcome': 'Bienvenue sur Zavorth!',
          'setup.title': 'Assistant de Configuration',
          'setup.provider': 'Choisissez votre fournisseur IA',
          'setup.model': 'Sélectionnez un modèle',
          'setup.workspace': 'Configurez l\'espace de travail',
          'setup.channels': 'Configurez les canaux',
          'setup.complete': 'Configuration terminée!',
          'onboarding.start': 'Commençons',
          'onboarding.name': 'Comment dois-je vous appeler?',
          'onboarding.language': 'Quelle langue préférez-vous?',
          'onboarding.tone': 'Comment dois-je communiquer?',
          'onboarding.domain': 'Quel est votre usage principal?',
          'migrate.title': 'Migration',
          'migrate.source': 'Où est votre agent?',
          'migrate.detecting': 'Détection de l\'agent...',
          'migrate.found': 'Trouvé: {name} ({type})',
          'migrate.items': '{count} éléments à migrer',
          'migrate.start': 'Démarrage de la migration...',
          'migrate.complete': 'Migration terminée!',
          'migrate.error': 'Migration échouée: {error}',
          'error.not_found': 'Non trouvé',
          'error.invalid_input': 'Entrée invalide',
          'error.permission_denied': 'Permission refusée',
          'yes': 'Oui',
          'no': 'Non',
          'cancel': 'Annuler',
          'confirm': 'Confirmer',
          'back': 'Retour',
          'next': 'Suivant',
          'finish': 'Terminer',
          'skip': 'Passer',
        },
      },
      {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        messages: {
          'welcome': 'Willkommen bei Zavorth!',
          'setup.title': 'Einrichtungsassistent',
          'setup.provider': 'Wählen Sie Ihren KI-Anbieter',
          'setup.model': 'Modell auswählen',
          'setup.workspace': 'Workspace konfigurieren',
          'setup.channels': 'Kanäle einrichten',
          'setup.complete': 'Einrichtung abgeschlossen!',
          'onboarding.start': 'Lassen Sie uns beginnen',
          'onboarding.name': 'Wie soll ich Sie nennen?',
          'onboarding.language': 'Welche Sprache bevorzugen Sie?',
          'onboarding.tone': 'Wie soll ich kommunizieren?',
          'onboarding.domain': 'Was ist Ihr Hauptanwendungsfall?',
          'migrate.title': 'Migration',
          'migrate.source': 'Wo ist Ihr Agent?',
          'migrate.detecting': 'Agent wird erkannt...',
          'migrate.found': 'Gefunden: {name} ({type})',
          'migrate.items': '{count} Elemente zum Migrieren',
          'migrate.start': 'Migration wird gestartet...',
          'migrate.complete': 'Migration abgeschlossen!',
          'migrate.error': 'Migration fehlgeschlagen: {error}',
          'error.not_found': 'Nicht gefunden',
          'error.invalid_input': 'Ungültige Eingabe',
          'error.permission_denied': 'Zugriff verweigert',
          'yes': 'Ja',
          'no': 'Nein',
          'cancel': 'Abbrechen',
          'confirm': 'Bestätigen',
          'back': 'Zurück',
          'next': 'Weiter',
          'finish': 'Fertig',
          'skip': 'Überspringen',
        },
      },
      {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        messages: {
          'welcome': 'Zavorthへようこそ！',
          'setup.title': 'セットアップウィザード',
          'setup.provider': 'AIプロバイダーを選択',
          'setup.model': 'モデルを選択',
          'setup.workspace': 'ワークスペースを設定',
          'setup.channels': 'チャンネルを設定',
          'setup.complete': 'セットアップ完了！',
          'onboarding.start': '始めましょう',
          'onboarding.name': 'お名前は何ですか？',
          'onboarding.language': 'どの言語を好みますか？',
          'onboarding.tone': 'どう comunicate しますか？',
          'onboarding.domain': '主な用途は何ですか？',
          'migrate.title': '移行',
          'migrate.source': 'エージェントはどこにありますか？',
          'migrate.detecting': 'エージェントを検出中...',
          'migrate.found': '見つかりました：{name} ({type})',
          'migrate.items': '{count}件のアイテムを移行',
          'migrate.start': '移行を開始...',
          'migrate.complete': '移行完了！',
          'migrate.error': '移行失敗：{error}',
          'error.not_found': '見つかりません',
          'error.invalid_input': '無効な入力',
          'error.permission_denied': '権限がありません',
          'yes': 'はい',
          'no': 'いいえ',
          'cancel': 'キャンセル',
          'confirm': '確認',
          'back': '戻る',
          'next': '次へ',
          'finish': '完了',
          'skip': 'スキップ',
        },
      },
      {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文',
        messages: {
          'welcome': '欢迎使用 Zavorth！',
          'setup.title': '设置向导',
          'setup.provider': '选择 AI 提供商',
          'setup.model': '选择模型',
          'setup.workspace': '配置工作区',
          'setup.channels': '设置渠道',
          'setup.complete': '设置完成！',
          'onboarding.start': '开始吧',
          'onboarding.name': '我该怎么称呼您？',
          'onboarding.language': '您 prefer 哪种语言？',
          'onboarding.tone': '我应该如何沟通？',
          'onboarding.domain': '您的主要用途是什么？',
          'migrate.title': '迁移',
          'migrate.source': '您的代理在哪里？',
          'migrate.detecting': '正在检测代理...',
          'migrate.found': '找到：{name} ({type})',
          'migrate.items': '{count} 个项目待迁移',
          'migrate.start': '开始迁移...',
          'migrate.complete': '迁移完成！',
          'migrate.error': '迁移失败：{error}',
          'error.not_found': '未找到',
          'error.invalid_input': '输入无效',
          'error.permission_denied': '权限不足',
          'yes': '是',
          'no': '否',
          'cancel': '取消',
          'confirm': '确认',
          'back': '返回',
          'next': '下一步',
          'finish': '完成',
          'skip': '跳过',
        },
      },
      {
        code: 'ko',
        name: 'Korean',
        nativeName: '한국어',
        messages: {
          'welcome': 'Zavorth에 오신 것을 환영합니다!',
          'setup.title': '설정 마법사',
          'setup.provider': 'AI 제공업체 선택',
          'setup.model': '모델 선택',
          'setup.workspace': '워크스페이스 설정',
          'setup.channels': '채널 설정',
          'setup.complete': '설정 완료!',
          'onboarding.start': '시작합시다',
          'onboarding.name': '어떻게 불러드릴까요?',
          'onboarding.language': '어떤 언어를 선호하시나요?',
          'onboarding.tone': '어떻게 소통해야 할까요?',
          'onboarding.domain': '주요 용도는 무엇인가요?',
          'migrate.title': '마이그레이션',
          'migrate.source': '에이전트가 어디에 있나요?',
          'migrate.detecting': '에이전트 감지 중...',
          'migrate.found': '발견: {name} ({type})',
          'migrate.items': '{count}개 항목 마이그레이션',
          'migrate.start': '마이그레이션 시작...',
          'migrate.complete': '마이그레이션 완료!',
          'migrate.error': '마이그레이션 실패: {error}',
          'error.not_found': '찾을 수 없음',
          'error.invalid_input': '잘못된 입력',
          'error.permission_denied': '권한 거부',
          'yes': '예',
          'no': '아니오',
          'cancel': '취소',
          'confirm': '확인',
          'back': '뒤로',
          'next': '다음',
          'finish': '완료',
          'skip': '건너뛰기',
        },
      },
      {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский',
        messages: {
          'welcome': 'Добро пожаловать в Zavorth!',
          'setup.title': 'Мастер настройки',
          'setup.provider': 'Выберите провайдера ИИ',
          'setup.model': 'Выберите модель',
          'setup.workspace': 'Настройте рабочее пространство',
          'setup.channels': 'Настройте каналы',
          'setup.complete': 'Настройка завершена!',
          'onboarding.start': 'Начнем',
          'onboarding.name': 'Как мне вас называть?',
          'onboarding.language': 'Какой язык вы предпочитаете?',
          'onboarding.tone': 'Как мне общаться?',
          'onboarding.domain': 'Какое у вас основное использование?',
          'migrate.title': 'Миграция',
          'migrate.source': 'Где находится ваш агент?',
          'migrate.detecting': 'Обнаружение агента...',
          'migrate.found': 'Найдено: {name} ({type})',
          'migrate.items': '{count} элементов для миграции',
          'migrate.start': 'Начало миграции...',
          'migrate.complete': 'Миграция завершена!',
          'migrate.error': 'Ошибка миграции: {error}',
          'error.not_found': 'Не найдено',
          'error.invalid_input': 'Неверный ввод',
          'error.permission_denied': 'Доступ запрещен',
          'yes': 'Да',
          'no': 'Нет',
          'cancel': 'Отмена',
          'confirm': 'Подтвердить',
          'back': 'Назад',
          'next': 'Далее',
          'finish': 'Завершить',
          'skip': 'Пропустить',
        },
      },
      {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        messages: {
          'welcome': 'مرحباً بك في Zavorth!',
          'setup.title': 'معالج الإعداد',
          'setup.provider': 'اختر مزود الذكاء الاصطناعي',
          'setup.model': 'اختر نموذجاً',
          'setup.workspace': 'configure مساحة العمل',
          'setup.channels': 'إعداد القنوات',
          'setup.complete': 'اكتمل الإعداد!',
          'onboarding.start': 'لنبدأ',
          'onboarding.name': 'كيف أناديك؟',
          'onboarding.language': 'ما اللغة التي تفضلها؟',
          'onboarding.tone': 'كيف يجب أن أتواصل؟',
          'onboarding.domain': 'ما استخدامك الرئيسي؟',
          'migrate.title': 'الترحيل',
          'migrate.source': 'أين يوجد وكيلك؟',
          'migrate.detecting': 'detecting الوكيل...',
          'migrate.found': 'تم العثور: {name} ({type})',
          'migrate.items': '{count} عناصر للترحيل',
          'migrate.start': 'بدء الترحيل...',
          'migrate.complete': 'اكتمل الترحيل!',
          'migrate.error': 'فشل الترحيل: {error}',
          'error.not_found': 'غير موجود',
          'error.invalid_input': 'إدخال غير صالح',
          'error.permission_denied': '.permission مرفوض',
          'yes': 'نعم',
          'no': 'لا',
          'cancel': 'إلغاء',
          'confirm': 'تأكيد',
          'back': 'رجوع',
          'next': 'التالي',
          'finish': 'إنهاء',
          'skip': 'تخطي',
        },
      },
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
