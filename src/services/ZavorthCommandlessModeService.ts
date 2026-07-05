/**
 * CommandlessModeService — Natural language entry point.
 *
 * Wraps the existing NaturalInvocationRouter and PresentationAdapter
 * to provide a seamless conversational experience. Users simply type
 * what they want — no commands, no slash syntax, no special formatting.
 *
 * Supports any language via the IntentI18n system:
 * - Auto-detects device locale
 * - Loads matching language pack
 * - Falls back to English for unsupported languages
 * - Can merge multiple language packs for bilingual users
 */

import { ZavorthNaturalInvocationRouter, type ZavorthNaturalInvocationInput } from './ZavorthNaturalInvocationRouter.js';
import {
  ZavorthPresentationAdapterService,
  type UniversalResponse,
  type ResponseContentType,
} from './ZavorthPresentationAdapterService.js';
import { ZavorthChannelCapabilitiesService } from './ZavorthChannelCapabilitiesService.js';
import {
  type IntentKeywordSet,
  type IntentLanguagePack,
  detectDeviceLocale,
  getLanguagePack,
  mergeLanguagePacks,
} from './ZavorthIntentI18n.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandlessInput {
  /** Raw user message in natural language. */
  message: string;

  /** Channel the message came from (telegram, whatsapp, discord, etc.). */
  channelId: string;

  /** User/session identifier for memory tracking. */
  userId?: string;

  /** Whether this is the first interaction with this user. */
  isFirstInteraction?: boolean;

  /** Override locale (e.g., from user profile). If not set, auto-detects. */
  locale?: string;
}

export interface CommandlessResponse {
  /** Formatted message ready to send to the channel. */
  formatted: {
    text: string;
    buttons?: Array<{ label: string; value: string }>;
  };

  /** Internal action that was taken. */
  action: string;

  /** Confidence level of intent detection (0-1). */
  confidence: number;

  /** Whether the user needs to approve something. */
  requiresApproval: boolean;

  /** Detected language used for matching. */
  detectedLanguage: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ZavorthCommandlessModeService {
  private readonly naturalRouter: ZavorthNaturalInvocationRouter;
  private readonly presentation: ZavorthPresentationAdapterService;
  private readonly caps: ZavorthChannelCapabilitiesService;

  constructor(deps?: {
    naturalRouter?: ZavorthNaturalInvocationRouter;
    presentation?: ZavorthPresentationAdapterService;
    caps?: ZavorthChannelCapabilitiesService;
  }) {
    this.caps = deps?.caps ?? new ZavorthChannelCapabilitiesService();
    this.presentation = deps?.presentation ?? new ZavorthPresentationAdapterService(this.caps);
    this.naturalRouter = deps?.naturalRouter ?? new ZavorthNaturalInvocationRouter();
  }

  /**
   * Main entry point: process a natural language message and return
   * a formatted response for the user's channel.
   */
  public async process(input: CommandlessInput): Promise<CommandlessResponse> {
    const locale = input.locale ?? detectDeviceLocale();
    const pack = mergeLanguagePacks(locale, 'en');

    const intent = this.detectIntent(input.message, pack);

    // First interaction greeting
    if (input.isFirstInteraction) {
      return this.buildGreeting(input, locale);
    }

    // Route through the natural invocation system
    const routerInput: ZavorthNaturalInvocationInput = {
      text: input.message,
      channel: input.channelId,
      actorId: input.userId ?? null,
    };

    const plan = await this.naturalRouter.plan(routerInput);

    // Build universal response
    const universalResponse: UniversalResponse = {
      type: this.mapActionToResponseType(intent.action),
      text: plan.narrative.summary ?? input.message,
      title: this.getActionTitle(intent.action, locale),
      metadata: {
        action: intent.action,
        confidence: intent.confidence,
        plan,
      },
    };

    // Format for the user's channel
    const formatted = this.presentation.format(universalResponse, input.channelId);

    return {
      formatted: {
        text: formatted.text,
        buttons: formatted.buttons,
      },
      action: intent.action,
      confidence: intent.confidence,
      requiresApproval: plan.approval.required,
      detectedLanguage: pack.code,
    };
  }

  /**
   * Detect intent from a natural language message using keyword matching
   * against the loaded language pack.
   */
  public detectIntent(
    message: string,
    pack?: IntentLanguagePack,
  ): { action: string; confidence: number } {
    const normalized = message.trim().toLowerCase();
    const languagePack = pack ?? mergeLanguagePacks(detectDeviceLocale(), 'en');

    // Check each intent category
    for (const [action, keywordSet] of Object.entries(languagePack.intents)) {
      const result = this.matchIntent(normalized, action, keywordSet);
      if (result) return result;
    }

    // Default: conversational fallback
    return { action: 'conversation', confidence: 0.5 };
  }

  /**
   * Match a message against a single intent's keywords.
   */
  private matchIntent(
    normalized: string,
    action: string,
    keywords: IntentKeywordSet,
  ): { action: string; confidence: number } | null {
    // Check multi-word phrases first (highest confidence)
    if (keywords.phrases) {
      for (const phrase of keywords.phrases) {
        if (normalized.includes(phrase.toLowerCase())) {
          return { action, confidence: 0.9 };
        }
      }
    }

    // Check verb + noun combination
    const hasVerb = keywords.verbs.some((v) => normalized.includes(v.toLowerCase()));
    const hasNoun = keywords.nouns.some((n) => normalized.includes(n.toLowerCase()));

    if (hasVerb && hasNoun) {
      return { action, confidence: 0.8 };
    }

    // Check verb only (lower confidence)
    if (hasVerb && keywords.nouns.length === 0) {
      return { action, confidence: 0.7 };
    }

    // Check noun only (lowest confidence)
    if (hasNoun && keywords.verbs.length === 0) {
      return { action, confidence: 0.6 };
    }

    return null;
  }

  /**
   * Build a greeting response for first-time users.
   */
  private buildGreeting(input: CommandlessInput, locale: string): CommandlessResponse {
    const greetingText = this.getLocalizedGreeting(locale);
    const greeting: UniversalResponse = {
      type: 'text',
      title: this.getLocalizedWelcomeTitle(locale),
      text: greetingText,
    };

    const formatted = this.presentation.format(greeting, input.channelId);

    return {
      formatted: {
        text: formatted.text,
        buttons: formatted.buttons,
      },
      action: 'greeting',
      confidence: 1.0,
      requiresApproval: false,
      detectedLanguage: locale,
    };
  }

  /**
   * Get a localized greeting text.
   */
  private getLocalizedGreeting(locale: string): string {
    const greetings: Record<string, string> = {
      en: "Hi! I'm Zavorth. I can help you with files, emails, code, research, scheduling, and more.\n\nJust tell me what you need — no commands required.",
      pt: 'Oi! Sou o Zavorth. Posso ajudar com arquivos, emails, código, pesquisas, agendamentos e muito mais.\n\nÉ só me dizer o que precisa — sem comandos.',
      es: '¡Hola! Soy Zavorth. Puedo ayudarte con archivos, correos, código, investigaciones, agenda y mucho más.\n\nSolo dime lo que necesitas — sin comandos.',
      fr: 'Bonjour ! Je suis Zavorth. Je peux vous aider avec les fichiers, emails, code, recherches, planification et plus encore.\n\nDites-moi simplement ce dont vous avez besoin — sans commandes.',
      de: 'Hallo! Ich bin Zavorth. Ich kann dir bei Dateien, E-Mails, Code, Recherche, Terminplanung und mehr helfen.\n\nSag mir einfach, was du brauchst — ohne Befehle.',
      ja: 'こんにちは！Zavorthです。ファイル、メール、コード、検索、スケジュールなどをお手伝いできます。\n\n必要なもの教えてください — コマンドは不要です。',
      zh: '你好！我是 Zavorth。我可以帮你处理文件、邮件、代码、搜索、日程安排等。\n\n告诉我你需要什么 — 不需要命令。',
      ko: '안녕하세요! Zavorth입니다. 파일, 이메일, 코드, 검색, 일정 등으로 도와드릴 수 있습니다.\n\n필요한 것을 말씀해주세요 — 명령어는 필요 없습니다.',
    };
    return greetings[locale] ?? greetings.en;
  }

  /**
   * Get localized welcome title.
   */
  private getLocalizedWelcomeTitle(locale: string): string {
    const titles: Record<string, string> = {
      en: 'Welcome to Zavorth',
      pt: 'Bem-vindo ao Zavorth',
      es: 'Bienvenido a Zavorth',
      fr: 'Bienvenue sur Zavorth',
      de: 'Willkommen bei Zavorth',
      ja: 'Zavorthへようこそ',
      zh: '欢迎使用 Zavorth',
      ko: 'Zavorth에 오신 것을 환영합니다',
    };
    return titles[locale] ?? titles.en;
  }

  /**
   * Map an action to the appropriate response type.
   */
  private mapActionToResponseType(action: string): ResponseContentType {
    if (['help', 'greeting', 'acknowledgment', 'explain_code'].includes(action)) return 'text';
    if (['read_file', 'list_directory', 'web_search', 'diagnostics'].includes(action)) return 'list';
    if (['email', 'channel_send', 'calendar'].includes(action)) return 'confirmation';
    if (['run_code', 'system_config'].includes(action)) return 'confirmation';
    if (['code_review', 'data_analysis'].includes(action)) return 'card';
    return 'text';
  }

  /**
   * Get a localized human-readable title for an action.
   */
  private getActionTitle(action: string, locale: string): string {
    const titles: Record<string, Record<string, string>> = {
      en: {
        read_file: 'Reading File',
        create_file: 'Creating File',
        list_directory: 'Listing Files',
        web_search: 'Searching the Web',
        web_fetch: 'Fetching Page',
        email: 'Composing Email',
        channel_send: 'Sending Message',
        run_code: 'Running Code',
        code_review: 'Code Review',
        explain_code: 'Code Explanation',
        calendar: 'Scheduling',
        data_analysis: 'Data Analysis',
        chart: 'Generating Chart',
        system_config: 'System Configuration',
        diagnostics: 'Diagnostics',
        help: 'Help',
        greeting: 'Welcome',
        acknowledgment: 'Noted',
        skill_invoke: 'Running Skill',
        conversation: 'Zavorth',
      },
      pt: {
        read_file: 'Lendo Arquivo',
        create_file: 'Criando Arquivo',
        list_directory: 'Listando Arquivos',
        web_search: 'Buscando na Web',
        web_fetch: 'Carregando Página',
        email: 'Redigindo Email',
        channel_send: 'Enviando Mensagem',
        run_code: 'Executando Código',
        code_review: 'Revisão de Código',
        explain_code: 'Explicação de Código',
        calendar: 'Agendamento',
        data_analysis: 'Análise de Dados',
        chart: 'Gerando Gráfico',
        system_config: 'Configuração do Sistema',
        diagnostics: 'Diagnósticos',
        help: 'Ajuda',
        greeting: 'Bem-vindo',
        acknowledgment: 'Anotado',
        skill_invoke: 'Executando Skill',
        conversation: 'Zavorth',
      },
      es: {
        read_file: 'Leyendo Archivo',
        create_file: 'Creando Archivo',
        list_directory: 'Listando Archivos',
        web_search: 'Buscando en la Web',
        email: 'Redactando Email',
        calendar: 'Programando',
        help: 'Ayuda',
        greeting: 'Bienvenido',
        conversation: 'Zavorth',
      },
      fr: {
        read_file: 'Lecture du fichier',
        create_file: 'Création du fichier',
        list_directory: 'Liste des fichiers',
        web_search: 'Recherche sur le Web',
        email: 'Rédaction d\'email',
        calendar: 'Planification',
        help: 'Aide',
        greeting: 'Bienvenue',
        conversation: 'Zavorth',
      },
      de: {
        read_file: 'Datei lesen',
        create_file: 'Datei erstellen',
        list_directory: 'Dateien auflisten',
        web_search: 'Im Web suchen',
        email: 'E-Mail verfassen',
        calendar: 'Terminplanung',
        help: 'Hilfe',
        greeting: 'Willkommen',
        conversation: 'Zavorth',
      },
      ja: {
        read_file: 'ファイルを読み込み',
        create_file: 'ファイルを作成',
        list_directory: 'ファイル一覧',
        web_search: 'Webで検索',
        email: 'メール作成',
        calendar: 'スケジュール',
        help: 'ヘルプ',
        greeting: 'ようこそ',
        conversation: 'Zavorth',
      },
      zh: {
        read_file: '读取文件',
        create_file: '创建文件',
        list_directory: '列出文件',
        web_search: '网络搜索',
        email: '撰写邮件',
        calendar: '日程安排',
        help: '帮助',
        greeting: '欢迎',
        conversation: 'Zavorth',
      },
      ko: {
        read_file: '파일 읽기',
        create_file: '파일 생성',
        list_directory: '파일 목록',
        web_search: '웹 검색',
        email: '이메일 작성',
        calendar: '일정 관리',
        help: '도움말',
        greeting: '환영합니다',
        conversation: 'Zavorth',
      },
    };

    const langTitles = titles[locale] ?? titles.en;
    return langTitles[action] ?? titles.en[action] ?? 'Zavorth';
  }
}
