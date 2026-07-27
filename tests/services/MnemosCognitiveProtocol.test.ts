import {
  isMnemosAvailable,
  buildMnemosCognitiveInstruction,
  buildMnemosCognitiveInstructionCompact,
  MNEMOS_CANONICAL_CADENCE,
  MNEMOS_CONTEXT_REQUIRED_TOOLS,
  MNEMOS_INDEXING_APPROVAL_BOUNDARY,
} from '../../src/services/MnemosCognitiveProtocol';

describe('MnemosCognitiveProtocol', () => {
  it('declares the canonical cadence without transforming index_file into a context requirement', () => {
    expect(MNEMOS_CONTEXT_REQUIRED_TOOLS).toEqual(['search_memory', 'scan_local_metadata', 'understand_file']);
    expect(MNEMOS_CANONICAL_CADENCE).toEqual(['search_memory', 'scan_local_metadata', 'understand_file', 'index_file']);
    expect(MNEMOS_INDEXING_APPROVAL_BOUNDARY).toBe('human-in-the-loop');
  });

  describe('isMnemosAvailable', () => {
    it('returns true when both tools are present', () => {
      expect(isMnemosAvailable(['search_memory', 'scan_local_metadata', 'understand_file', 'other_tool'])).toBe(true);
    });

    it('returns false when search_memory is missing', () => {
      expect(isMnemosAvailable(['scan_local_metadata', 'other_tool'])).toBe(false);
    });

    it('returns false when scan_local_metadata is missing', () => {
      expect(isMnemosAvailable(['search_memory', 'other_tool'])).toBe(false);
    });

    it('returns false with empty array', () => {
      expect(isMnemosAvailable([])).toBe(false);
    });

    it('returns true with exactly the required tools', () => {
      expect(isMnemosAvailable(['search_memory', 'scan_local_metadata', 'understand_file'])).toBe(true);
    });
  });

  describe('buildMnemosCognitiveInstruction', () => {
    it('returns a non-empty string', () => {
      const instruction = buildMnemosCognitiveInstruction();
      expect(instruction).toBeTruthy();
      expect(typeof instruction).toBe('string');
    });

    it('mentions the three stages', () => {
      const instruction = buildMnemosCognitiveInstruction();
      expect(instruction).toContain('STAGE 1');
      expect(instruction).toContain('STAGE 2');
      expect(instruction).toContain('STAGE 3');
    });

    it('mentions the tools by name', () => {
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
    it('returns compact version', () => {
      const compact = buildMnemosCognitiveInstructionCompact();
      expect(compact.length).toBeLessThan(buildMnemosCognitiveInstruction().length);
    });

    it('menciona Mnemos', () => {
      expect(buildMnemosCognitiveInstructionCompact()).toContain('MNEMOS');
    });
  });
});
