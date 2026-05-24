import { normalizeZavorthHeadlessArgs } from '../../../src/cli/headless/ZavorthHeadlessCommand.js';
import { parseZavorthCliFlags } from '../../../src/cli/ZavorthCliCommandHelpers.js';

describe('Zavorth headless mode', () => {
  it('rewrites -p prompts to the ask command', () => {
    const result = normalizeZavorthHeadlessArgs(['-p', 'explain this repo', '--json']);

    expect(result.enabled).toBe(true);
    expect(result.prompt).toBe('explain this repo');
    expect(result.argv).toEqual(['ask', 'explain this repo', '--json']);
  });

  it('keeps approval mode as metadata without adding it to prompt text', () => {
    const flags = parseZavorthCliFlags(['-p', 'fix tests', '--json', '--approval-mode', 'governed']);

    expect(flags.headless).toBe(true);
    expect(flags.json).toBe(true);
    expect(flags.command).toBe('ask');
    expect(flags.commandText).toBe('ask fix tests');
    expect(flags.approvalMode).toBe('governed');
  });

  it('does not consume flags as the prompt value', () => {
    const flags = parseZavorthCliFlags(['-p', '--json']);

    expect(flags.headless).toBe(true);
    expect(flags.json).toBe(true);
    expect(flags.command).toBe('ask');
    expect(flags.commandText).toBe('ask');
  });
});
