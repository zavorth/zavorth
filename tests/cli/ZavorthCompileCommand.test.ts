import { handleZavorthCompileCommand } from '../../src/cli/ZavorthCompileCommand';

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

describe('ZavorthCompileCommand', () => {
  it('returns null for non-compile commands', async () => {
    const { params } = createParams('status', '');
    const result = await handleZavorthCompileCommand(params);
    expect(result).toBeNull();
  });

  it('handles compile --check', async () => {
    const { params, lines } = createParams('compile', '--check');
    const result = await handleZavorthCompileCommand(params);
    expect(result).toBeTruthy();
    expect(result!.handled).toBe(true);
    expect(lines.join('\n')).toContain('Prerequisites');
  });

  it('checks Node version >= 20', async () => {
    const { params, lines } = createParams('compile', '--check');
    const result = await handleZavorthCompileCommand(params);
    expect(result).toBeTruthy();
    const output = lines.join('\n');
    // Node >= 20 should pass this check
    expect(output).toContain('Node.js');
    const major = parseInt(process.versions.node.split('.')[0], 10);
    if (major >= 20) {
      expect(output).toContain('✅');
    }
  });

  it('checks for build output', async () => {
    const { params, lines } = createParams('compile', '--check');
    await handleZavorthCompileCommand(params);
    const output = lines.join('\n');
    expect(output).toContain('Build output');
  });

  it('checks for esbuild', async () => {
    const { params, lines } = createParams('compile', '--check');
    await handleZavorthCompileCommand(params);
    const output = lines.join('\n');
    expect(output).toContain('esbuild');
  });
});
