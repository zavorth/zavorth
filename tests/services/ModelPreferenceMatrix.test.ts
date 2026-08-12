import { MultiModalPreferencesService } from '../../src/services/MultiModalPreferencesService';
import type { ZavorthModality } from '../../src/contracts/MultiModalPreferencesContract';

describe('MultiModalPreferencesService - Combinatorial Matrix Tests', () => {
  let mockFs: any;
  let service: MultiModalPreferencesService;
  let fileContent: string;

  beforeEach(() => {
    fileContent = '';
    mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      readFileSync: jest.fn().mockImplementation(() => fileContent),
      writeFileSync: jest.fn().mockImplementation((p, c) => {
        fileContent = c;
      }),
      unlinkSync: jest.fn(),
    };

    service = new MultiModalPreferencesService({
      projectRoot: '/test-project',
      fs: mockFs,
    });
  });

  const modalities: ZavorthModality[] = ['text', 'code', 'diagram', 'table', 'voice'];
  const enabledStates = [true, false];
  const whenToUsePhrases = [
    'Always use this modality',
    'Use when requested by user',
    'Use for complex tasks',
    'Only use as a fallback',
    'Use for quick answers'
  ];

  // Test setPreference and getPreference combinations
  for (const modality of modalities) {
    for (const enabled of enabledStates) {
      for (const phrase of whenToUsePhrases) {
        it(`should set and get preference: modality=${modality}, enabled=${enabled}, phrase="${phrase}"`, () => {
          service.setPreference(modality, { enabled, whenToUse: phrase });
          const pref = service.getPreference(modality);
          
          expect(pref).not.toBeNull();
          expect(pref?.modality).toBe(modality);
          expect(pref?.enabled).toBe(enabled);
          expect(pref?.whenToUse).toBe(phrase);
        });
      }
    }
  }

  // Context keywords matrix for getModalityHint
  const contextScenarios = [
    { modality: 'code', keywords: ['write a python script', 'debug this class', 'optimize function', 'api endpoint', 'typescript component'] },
    { modality: 'diagram', keywords: ['show a diagram', 'draw a chart', 'visual representation', 'graph of nodes', 'architecture illustration'] },
    { modality: 'table', keywords: ['format as a table', 'data comparison', 'matrix of features', 'spreadsheet values', 'structured data'] },
    { modality: 'voice', keywords: ['audio recording', 'voice command', 'speak the response', 'listen to audio', 'voice podcast'] },
    { modality: 'text', keywords: ['explain in plain text', 'write a paragraph', 'summarize this article', 'simple answer', 'general explanation'] }
  ];

  // Generate all 32 subsets of modalities to maximize test coverage and density
  const preferenceConfigurations: { enabled: ZavorthModality[] }[] = [];
  const totalSubsets = 1 << modalities.length; // 32
  for (let i = 0; i < totalSubsets; i++) {
    const enabled: ZavorthModality[] = [];
    for (let j = 0; j < modalities.length; j++) {
      if ((i & (1 << j)) !== 0) {
        enabled.push(modalities[j]);
      }
    }
    preferenceConfigurations.push({ enabled });
  }

  for (const config of preferenceConfigurations) {
    for (const scenario of contextScenarios) {
      for (const keyword of scenario.keywords) {
        it(`should resolve modality hint: configEnabled=[${config.enabled.join(',')}], targetModality=${scenario.modality}, keyword="${keyword}"`, () => {
          // Setup preferences
          for (const m of modalities) {
            const isEnabled = config.enabled.includes(m);
            service.setPreference(m, { enabled: isEnabled, whenToUse: `Use for ${m} tasks` });
          }

          const hint = service.getModalityHint(keyword);
          const expectedModality = getExpectedFallback(keyword, config.enabled);

          if (expectedModality) {
            expect(hint).toBe(`${expectedModality}: Use for ${expectedModality} tasks`);
          } else {
            expect(hint).toBe('');
          }
        });
      }
    }
  }

  function getExpectedFallback(keyword: string, enabledModalities: string[]): string | null {
    const lower = keyword.toLowerCase();
    const codeKeywords = ['code', 'function', 'class', 'api', 'component', 'script'];
    const imageKeywords = ['image', 'diagram', 'chart', 'visual', 'graph', 'illustration'];
    const tableKeywords = ['table', 'data', 'comparison', 'matrix', 'spreadsheet'];
    const voiceKeywords = ['audio', 'voice', 'speak', 'listen', 'podcast'];

    let modality = 'text';
    if (codeKeywords.some((k) => lower.includes(k))) modality = 'code';
    else if (imageKeywords.some((k) => lower.includes(k))) modality = 'diagram';
    else if (tableKeywords.some((k) => lower.includes(k))) modality = 'table';
    else if (voiceKeywords.some((k) => lower.includes(k))) modality = 'voice';

    return enabledModalities.includes(modality) ? modality : null;
  }
});
