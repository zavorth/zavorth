import { ZavorthCommandlessModeService } from '../../src/services/ZavorthCommandlessModeService';
import {
  detectDeviceLocale,
  getLanguagePack,
  mergeLanguagePacks,
  listAvailableLocales,
} from '../../src/services/ZavorthIntentI18n';

describe('IntentI18n — Language system', () => {
  it('should have multiple language packs', () => {
    const locales = listAvailableLocales();
    expect(locales.length).toBeGreaterThanOrEqual(3);
  });

  it('should detect device locale', () => {
    const locale = detectDeviceLocale();
    expect(typeof locale).toBe('string');
    expect(locale.length).toBeGreaterThanOrEqual(2);
  });

  it('should get English pack by default', () => {
    const pack = getLanguagePack('en');
    expect(pack.code).toBe('en-US');
    expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
  });

  it('should fallback to English for unknown locale', () => {
    const pack = getLanguagePack('xx');
    // Should return English pack (with code 'en') or the requested code with empty intents
    expect(pack.intents).toBeDefined();
    expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
  });

  it('should get Portuguese pack', () => {
    const pack = getLanguagePack('pt');
    // Code should be 'pt-BR' (the directory name)
    expect(pack.code).toBe('pt-BR');
    expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
  });

  it('should merge primary + English fallback', () => {
    const merged = mergeLanguagePacks('pt', 'en');
    expect(merged.code).toBe('pt-BR');
    // Should have keywords from both languages
    expect(merged.intents.read_file.verbs).toContain('ler');   // PT
    expect(merged.intents.read_file.verbs).toContain('read');  // EN
  });

  it('should include all intent categories', () => {
    const pack = getLanguagePack('en');
    const expectedIntents = [
      'read_file', 'create_file', 'list_directory', 'web_search',
      'email', 'run_code', 'code_review', 'calendar', 'greeting',
      'help', 'acknowledgment',
    ];
    for (const intent of expectedIntents) {
      expect(pack.intents[intent]).toBeDefined();
    }
  });
});

describe('ZavorthCommandlessModeService — Multi-language intent detection', () => {
  let service: ZavorthCommandlessModeService;

  beforeEach(() => {
    service = new ZavorthCommandlessModeService();
  });

  // =========================================================================
  // English (base)
  // =========================================================================
  describe('English detection', () => {
    const enPack = getLanguagePack('en');

    it('should detect file operations', () => {
      expect(service.detectIntent('read the file report.md', enPack).action).toBe('read_file');
      expect(service.detectIntent('create a new document', enPack).action).toBe('create_file');
      expect(service.detectIntent('list all files in folder', enPack).action).toBe('list_directory');
    });

    it('should detect web operations', () => {
      expect(service.detectIntent('search for information about Node.js', enPack).action).toBe('web_search');
      expect(service.detectIntent('open the website', enPack).action).toBe('web_fetch');
    });

    it('should detect email operations', () => {
      expect(service.detectIntent('send an email to the team', enPack).action).toBe('email');
      expect(service.detectIntent('draft a reply', enPack).action).toBe('email');
    });

    it('should detect code operations', () => {
      expect(service.detectIntent('run this script', enPack).action).toBe('run_code');
      expect(service.detectIntent('review this pull request', enPack).action).toBe('code_review');
      expect(service.detectIntent('explain this function', enPack).action).toBe('explain_code');
    });

    it('should detect scheduling', () => {
      expect(service.detectIntent('schedule a meeting', enPack).action).toBe('calendar');
      expect(service.detectIntent('remind me to check deploy', enPack).action).toBe('calendar');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('hello!', enPack).action).toBe('greeting');
      expect(service.detectIntent('good morning', enPack).action).toBe('greeting');
    });

    it('should detect help', () => {
      expect(service.detectIntent('what can you do?', enPack).action).toBe('help');
    });

    it('should fallback for unknown input', () => {
      expect(service.detectIntent('xyzzy plugh 12345', enPack).action).toBe('conversation');
    });
  });

  // =========================================================================
  // Portuguese
  // =========================================================================
  describe('Portuguese detection', () => {
    const ptPack = getLanguagePack('pt');

    it('should detect file operations', () => {
      expect(service.detectIntent('ler o arquivo relatório', ptPack).action).toBe('read_file');
      expect(service.detectIntent('criar um documento novo', ptPack).action).toBe('create_file');
    });

    it('should detect web operations', () => {
      expect(service.detectIntent('buscar informações sobre React', ptPack).action).toBe('web_search');
    });

    it('should detect email operations', () => {
      expect(service.detectIntent('enviar um email para o time', ptPack).action).toBe('email');
    });

    it('should detect scheduling', () => {
      expect(service.detectIntent('agendar uma reunião', ptPack).action).toBe('calendar');
      expect(service.detectIntent('lembra de verificar o deploy', ptPack).action).toBe('calendar');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('oi!', ptPack).action).toBe('greeting');
      expect(service.detectIntent('bom dia', ptPack).action).toBe('greeting');
    });
  });

  // =========================================================================
  // Spanish
  // =========================================================================
  describe('Spanish detection', () => {
    const esPack = getLanguagePack('es');

    it('should detect file operations', () => {
      expect(service.detectIntent('leer el archivo', esPack).action).toBe('read_file');
      expect(service.detectIntent('crear un documento', esPack).action).toBe('create_file');
    });

    it('should detect web search', () => {
      expect(service.detectIntent('buscar información', esPack).action).toBe('web_search');
    });

    it('should detect email', () => {
      expect(service.detectIntent('enviar un correo', esPack).action).toBe('email');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('hola!', esPack).action).toBe('greeting');
      expect(service.detectIntent('buenos días', esPack).action).toBe('greeting');
    });
  });

  // =========================================================================
  // French
  // =========================================================================
  describe('French detection', () => {
    const frPack = getLanguagePack('fr');

    it('should detect file operations', () => {
      expect(service.detectIntent('lire le fichier', frPack).action).toBe('read_file');
      expect(service.detectIntent('créer un document', frPack).action).toBe('create_file');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('bonjour!', frPack).action).toBe('greeting');
    });

    it('should detect thanks', () => {
      expect(service.detectIntent('merci', frPack).action).toBe('acknowledgment');
    });
  });

  // =========================================================================
  // German
  // =========================================================================
  describe('German detection', () => {
    const dePack = getLanguagePack('de');

    it('should detect file operations', () => {
      expect(service.detectIntent('die Datei lesen', dePack).action).toBe('read_file');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('hallo!', dePack).action).toBe('greeting');
      expect(service.detectIntent('guten morgen', dePack).action).toBe('greeting');
    });
  });

  // =========================================================================
  // Japanese
  // =========================================================================
  describe('Japanese detection', () => {
    const jaPack = getLanguagePack('ja');

    it('should detect file operations', () => {
      expect(service.detectIntent('ファイルを読む', jaPack).action).toBe('read_file');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('こんにちは', jaPack).action).toBe('greeting');
    });
  });

  // =========================================================================
  // Chinese
  // =========================================================================
  describe('Chinese detection', () => {
    const zhPack = getLanguagePack('zh');

    it('should detect file operations', () => {
      expect(service.detectIntent('读取文件', zhPack).action).toBe('read_file');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('你好', zhPack).action).toBe('greeting');
    });
  });

  // =========================================================================
  // Korean
  // =========================================================================
  describe('Korean detection', () => {
    const koPack = getLanguagePack('ko');

    it('should detect file operations', () => {
      expect(service.detectIntent('파일 읽기', koPack).action).toBe('read_file');
    });

    it('should detect greetings', () => {
      expect(service.detectIntent('안녕하세요', koPack).action).toBe('greeting');
    });
  });

  // =========================================================================
  // Merged pack (bilingual)
  // =========================================================================
  describe('Merged pack — bilingual support', () => {
    it('should detect both EN and PT keywords', () => {
      const merged = mergeLanguagePacks('pt', 'en');
      expect(service.detectIntent('read file', merged).action).toBe('read_file');
      expect(service.detectIntent('ler arquivo', merged).action).toBe('read_file');
    });

    it('should handle mixed language input', () => {
      const merged = mergeLanguagePacks('pt', 'en');
      expect(service.detectIntent('search informação', merged).action).toBe('web_search');
    });
  });
});
