import { handleZavorthCliVoiceCommand } from '../../src/cli/ZavorthCliVoiceCommand';

const createWriter = () => {
  const lines: string[] = [];
  return {
    writer: {
      line: (text: string) => lines.push(text),
      error: (text: string) => lines.push(text),
    },
    lines,
  };
};

const createParams = (commandName: string | null, args: string) => {
  const { writer, lines } = createWriter();
  return {
    params: {
      runtime: {} as any,
      effectiveFlags: {} as any,
      commandName,
      args,
      writer,
    },
    lines,
  };
};

describe('ZavorthCliVoiceCommand', () => {
  it('returns null for non-voice commands', async () => {
    const { params } = createParams('status', '');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeNull();
  });

  it('handles voice status', async () => {
    const { params, lines } = createParams('voice', 'status');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(result!.handled).toBe(true);
    expect(lines.join('\n')).toContain('Pipeline Status');
  });

  it('defaults to status when no subcommand given', async () => {
    const { params, lines } = createParams('voice', '');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(lines.join('\n')).toContain('Pipeline Status');
  });

  it('handles voice speak with missing text', async () => {
    const { params, lines } = createParams('voice', 'speak');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(false);
    expect(lines.join('\n')).toContain('Usage');
  });

  it('handles voice consent status', async () => {
    const { params, lines } = createParams('voice', 'consent');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(lines.join('\n')).toContain('Privacy Consent');
  });

  it('handles voice consent accept', async () => {
    const { params, lines } = createParams('voice', 'consent accept');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(lines.join('\n')).toContain('accepted');
  });

  it('handles voice doctor', async () => {
    const { params, lines } = createParams('voice', 'doctor');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.handled).toBe(true);
    expect(lines.join('\n')).toContain('Voice Doctor');
  });

  it('handles unknown subcommand with help', async () => {
    const { params, lines } = createParams('voice', 'foobar');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(lines.join('\n')).toContain('Subcommands');
  });

  it('handles voice arm', async () => {
    const { params, lines } = createParams('voice', 'arm --ttl 60');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(lines.join('\n')).toContain('armed');
  });

  it('handles voice disarm', async () => {
    const { params, lines } = createParams('voice', 'disarm');
    const result = await handleZavorthCliVoiceCommand(params);
    expect(result).toBeTruthy();
    expect(result!.ok).toBe(true);
    expect(lines.join('\n')).toContain('disarmed');
  });
});
