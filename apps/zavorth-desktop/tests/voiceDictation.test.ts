import { describe, expect, it } from 'vitest';
import {
  mergeDictationTranscript,
  resolveDictationLanguage,
  speechRecognitionAvailability,
} from '../src/voice/voiceDictation';

describe('voice dictation helpers', () => {
  it('resolves pt languages to pt-BR', () => {
    expect(resolveDictationLanguage('pt-PT')).toBe('pt-BR');
    expect(resolveDictationLanguage('en-US')).toBe('en-US');
    expect(resolveDictationLanguage(null)).toBe('en-US');
  });

  it('merges transcripts without dropping prior text', () => {
    expect(mergeDictationTranscript('', 'hello')).toBe('hello');
    expect(mergeDictationTranscript('hello', 'world')).toBe('hello world');
  });

  it('reports availability from global constructors', () => {
    expect(speechRecognitionAvailability({}).available).toBe(false);
    expect(speechRecognitionAvailability({
      webkitSpeechRecognition: function Fake() {},
    }).available).toBe(true);
  });
});
