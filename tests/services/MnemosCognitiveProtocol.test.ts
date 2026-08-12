import {
  isMnemosAvailable,
  buildMnemosCognitiveInstruction,
  buildMnemosCognitiveInstructionCompact,
  MNEMOS_CANONICAL_CADENCE,
  MNEMOS_CONTEXT_REQUIRED_TOOLS,
  MNEMOS_INDEXING_APPROVAL_BOUNDARY,
} from '../../src/services/MnemosCognitiveProtocol';

describe('MnemosCognitiveProtocol', () => {
  it('declara a cadencia canonica sem transformar index_file em requisito de contexto', () => {
    expect(MNEMOS_CONTEXT_REQUIRED_TOOLS).toEqual(['search_memory', 'scan_local_metadata', 'understand_file']);
    expect(MNEMOS_CANONICAL_CADENCE).toEqual(['search_memory', 'scan_local_metadata', 'understand_file', 'index_file']);
    expect(MNEMOS_INDEXING_APPROVAL_BOUNDARY).toBe('human-in-the-loop');
  });

  describe('isMnemosAvailable', () => {
    it('retorna true quando ambas as tools estao presentes', () => {
      expect(isMnemosAvailable(['search_memory', 'scan_local_metadata', 'understand_file', 'other_tool'])).toBe(true);
    });

    it('retorna false quando search_memory esta ausente', () => {
      expect(isMnemosAvailable(['scan_local_metadata', 'other_tool'])).toBe(false);
    });

    it('retorna false quando scan_local_metadata esta ausente', () => {
      expect(isMnemosAvailable(['search_memory', 'other_tool'])).toBe(false);
    });

    it('retorna false com array vazio', () => {
      expect(isMnemosAvailable([])).toBe(false);
    });

    it('retorna true com exatamente as tools necessarias', () => {
      expect(isMnemosAvailable(['search_memory', 'scan_local_metadata', 'understand_file'])).toBe(true);
    });
  });

  describe('buildMnemosCognitiveInstruction', () => {
    it('retorna string nao vazia', () => {
      const instruction = buildMnemosCognitiveInstruction();
      expect(instruction).toBeTruthy();
      expect(typeof instruction).toBe('string');
    });

    it('menciona os tres estagios', () => {
      const instruction = buildMnemosCognitiveInstruction();
      expect(instruction).toContain('ESTÁGIO 1');
      expect(instruction).toContain('ESTÁGIO 2');
      expect(instruction).toContain('ESTÁGIO 3');
    });

    it('menciona as tools por nome', () => {
      const instruction = buildMnemosCognitiveInstruction();
      expect(instruction).toContain('search_memory');
      expect(instruction).toContain('scan_local_metadata');
      expect(instruction).toContain('understand_file');
      expect(instruction).toContain('index_file');
    });

    it('menciona a regra de privacidade', () => {
      const instruction = buildMnemosCognitiveInstruction();
      expect(instruction).toContain('NUNCA');
    });
  });

  describe('buildMnemosCognitiveInstructionCompact', () => {
    it('retorna versao compacta', () => {
      const compact = buildMnemosCognitiveInstructionCompact();
      expect(compact.length).toBeLessThan(buildMnemosCognitiveInstruction().length);
    });

    it('menciona Mnemos', () => {
      expect(buildMnemosCognitiveInstructionCompact()).toContain('MNEMOS');
    });
  });
});
