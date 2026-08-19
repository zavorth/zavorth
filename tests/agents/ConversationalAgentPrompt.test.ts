import {
  buildConversationalSystemInstruction,
  removeInternalVoicePreamble,
} from './stubs/ConversationalAgentPrompt';

describe('ConversationalAgentPrompt', () => {
  it('builds the default instruction from explicit runtime context', () => {
    const instruction = buildConversationalSystemInstruction({
      hallucinationInstruction: 'Verify uncertain claims.',
      date: '7/16/2026',
      workspace: 'C:/workspace',
      platform: 'win32',
      architecture: 'x64',
    });

    expect(instruction).toContain('- Date: 7/16/2026');
    expect(instruction).toContain('- Workspace: C:/workspace');
    expect(instruction).toContain('- Platform: win32 (x64)');
    expect(instruction).toContain('Verify uncertain claims.');
    expect(instruction).toContain('schema → preview → apply');
    expect(instruction).toContain('**DEFAULT MODE:**');
    expect(instruction).not.toMatch(/\\u00e2|\\u00c3|\\uFFFD/);
  });

  it('deduplicates direct-mode style hints', () => {
    const instruction = buildConversationalSystemInstruction({
      mode: 'direct',
      styleHints: ['Short answer', 'Short answer', '  Include evidence  '],
      hallucinationInstruction: 'Stay factual.',
      date: '7/16/2026',
      workspace: '/workspace',
      platform: 'linux',
      architecture: 'x64',
    });

    expect(instruction).toContain('**DIRECT MODE:**');
    expect(instruction.match(/- Short answer/g)).toHaveLength(1);
    expect(instruction).toContain('- Include evidence');
  });

  it('removes only the internal transcription preamble', () => {
    const transcript = removeInternalVoicePreamble([
      '[Automatically transcribed audio]',
      'Detected locale: English.',
      'STT provider: local.',
      'Use this transcript as an auditory draft.',
      'Reply in the same language as the transcript.',
      'Schedule the meeting for tomorrow.',
    ].join('\n'));

    expect(transcript).toBe('Schedule the meeting for tomorrow.');
    expect(removeInternalVoicePreamble('Detected locale matters to this report.')).toBe(
      'Detected locale matters to this report.',
    );
  });
});
