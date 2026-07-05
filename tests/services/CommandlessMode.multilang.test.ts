import { ZavorthCommandlessModeService } from '../../src/services/ZavorthCommandlessModeService';
import { getLanguagePack, mergeLanguagePacks, INTENT_I18N } from '../../src/services/ZavorthIntentI18n';

describe('CommandlessMode — Cross-language intent detection', () => {
  let service: ZavorthCommandlessModeService;

  beforeEach(() => {
    service = new ZavorthCommandlessModeService();
  });

  // =========================================================================
  // Same intent, different languages
  // =========================================================================
  describe('Read file — "read_file" across 8 languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'read the report file'],
      ['pt', 'ler o arquivo relatório'],
      ['es', 'leer el archivo'],
      ['fr', 'lire le fichier'],
      ['de', 'die datei lesen'],
      ['ja', 'ファイルを読む'],
      ['zh', '读取文件'],
      ['ko', '파일 읽기'],
    ];

    test.each(testCases)('%s — "%s" → read_file', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('read_file');
    });
  });

  // =========================================================================
  // Create file across languages
  // =========================================================================
  describe('Create file — "create_file" across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'create a new document'],
      ['pt', 'criar um documento novo'],
      ['es', 'crear un documento nuevo'],
      ['fr', 'créer un document'],
      ['de', 'ein dokument erstellen'],
      ['ja', '新しいドキュメントを作成'],
      ['zh', '创建新文档'],
      ['ko', '새 문서 만들기'],
    ];

    test.each(testCases)('%s — "%s" → create_file', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('create_file');
    });
  });

  // =========================================================================
  // Web search across languages
  // =========================================================================
  describe('Web search — "web_search" across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'search for information'],
      ['pt', 'buscar informações'],
      ['es', 'buscar información'],
      ['fr', 'chercher information'],
      ['de', 'information suchen'],
      ['ja', '情報を検索'],
      ['zh', '搜索信息'],
      ['ko', '정보 검색'],
    ];

    test.each(testCases)('%s — "%s" → web_search', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('web_search');
    });
  });

  // =========================================================================
  // Send email across languages
  // =========================================================================
  describe('Send email — "email" across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'send an email'],
      ['pt', 'enviar um email'],
      ['es', 'enviar un correo'],
      ['fr', 'envoyer un email'],
      ['de', 'eine e-mail senden'],
      ['ja', 'メールを送信'],
      ['zh', '发送邮件'],
      ['ko', '이메일 보내기'],
    ];

    test.each(testCases)('%s — "%s" → email', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('email');
    });
  });

  // =========================================================================
  // Schedule/Calendar across languages
  // =========================================================================
  describe('Schedule meeting — "calendar" across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'schedule a meeting'],
      ['pt', 'agendar uma reunião'],
      ['es', 'programar una reunión'],
      ['fr', 'planifier une réunion'],
      ['de', 'ein meeting planen'],
      ['ja', '会議をスケジュール'],
      ['zh', '安排会议'],
      ['ko', '회의 예약'],
    ];

    test.each(testCases)('%s — "%s" → calendar', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('calendar');
    });
  });

  // =========================================================================
  // Greetings across languages
  // =========================================================================
  describe('Greeting across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'hello!'],
      ['pt', 'oi!'],
      ['es', 'hola!'],
      ['fr', 'bonjour!'],
      ['de', 'hallo!'],
      ['ja', 'こんにちは'],
      ['zh', '你好'],
      ['ko', '안녕하세요'],
    ];

    test.each(testCases)('%s — "%s" → greeting', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('greeting');
    });
  });

  // =========================================================================
  // Thanks across languages
  // =========================================================================
  describe('Acknowledgment across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'thanks'],
      ['pt', 'obrigado'],
      ['es', 'gracias'],
      ['fr', 'merci'],
      ['de', 'danke'],
      ['ja', 'ありがとう'],
      ['zh', '谢谢'],
      ['ko', '감사합니다'],
    ];

    test.each(testCases)('%s — "%s" → acknowledgment', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('acknowledgment');
    });
  });

  // =========================================================================
  // Run code across languages
  // =========================================================================
  describe('Run code — "run_code" across languages', () => {
    const testCases: Array<[string, string]> = [
      ['en', 'run this script'],
      ['pt', 'rodar esse script'],
      ['es', 'ejecutar este script'],
      ['fr', 'exécuter ce script'],
      ['de', 'dieses skript ausführen'],
      ['ja', 'このスクリプトを実行'],
      ['zh', '运行这个脚本'],
      ['ko', '이 스크립트 실행'],
    ];

    test.each(testCases)('%s — "%s" → run_code', (locale, input) => {
      const pack = getLanguagePack(locale);
      const result = service.detectIntent(input, pack);
      expect(result.action).toBe('run_code');
    });
  });

  // =========================================================================
  // Mixed language input (bilingual)
  // =========================================================================
  describe('Bilingual input — merged packs', () => {
    it('should handle PT + EN mixed input', () => {
      const merged = mergeLanguagePacks('pt', 'en');
      expect(service.detectIntent('search informação', merged).action).toBe('web_search');
      expect(service.detectIntent('ler file', merged).action).toBe('read_file');
      expect(service.detectIntent('criar document', merged).action).toBe('create_file');
    });

    it('should handle ES + EN mixed input', () => {
      const merged = mergeLanguagePacks('es', 'en');
      expect(service.detectIntent('buscar information', merged).action).toBe('web_search');
      expect(service.detectIntent('enviar email', merged).action).toBe('email');
    });

    it('should handle JA + EN mixed input', () => {
      const merged = mergeLanguagePacks('ja', 'en');
      expect(service.detectIntent('ファイル read', merged).action).toBe('read_file');
      expect(service.detectIntent('メール send', merged).action).toBe('email');
    });
  });

  // =========================================================================
  // Auto-locale detection fallback
  // =========================================================================
  describe('Auto-locale detection', () => {
    it('should fallback to English for unknown locale', () => {
      const result = service.detectIntent('read file');
      expect(['read_file', 'conversation']).toContain(result.action);
    });
  });

  // =========================================================================
  // Summary: all languages have required intents
  // =========================================================================
  describe('Language pack completeness', () => {
    const requiredIntents = [
      'read_file', 'create_file', 'web_search', 'email',
      'calendar', 'greeting', 'acknowledgment',
    ];

    for (const pack of INTENT_I18N) {
      test(`${pack.name} (${pack.code}) has all required intents`, () => {
        for (const intent of requiredIntents) {
          expect(pack.intents[intent]).toBeDefined();
        }
      });
    }
  });
});
