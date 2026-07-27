/**
 * Channels completeness / smoke CLI help + launcher wiring.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { CHANNEL_COMPLETENESS_CONTRACT_VERSION } from '../../src/services/ChannelCompletenessService.js';

const root = process.cwd();

async function capture(run: () => Promise<number> | number): Promise<{ code: number; out: string }> {
  const chunks: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    chunks.push(args.map(String).join(' '));
  };
  try {
    const code = await run();
    return { code: typeof code === 'number' ? code : 0, out: chunks.join('\n') };
  } finally {
    console.log = origLog;
  }
}

describe('ChannelCompletenessCli intents', () => {
  it('defaults empty args to completeness inventory', () => {
    const { resolveChannelCompletenessIntent } = require('./stubs/ChannelCompletenessCli.js');
    const intent = resolveChannelCompletenessIntent([]);
    expect(intent.kind).toBe('completeness');
    if (intent.kind === 'completeness') {
      expect(intent.json).toBe(false);
      expect(intent.channelId).toBeNull();
    }
  });

  it('routes completeness --json --channel matrix', () => {
    const { resolveChannelCompletenessIntent } = require('./stubs/ChannelCompletenessCli.js');
    const intent = resolveChannelCompletenessIntent([
      'completeness',
      '--json',
      '--channel',
      'matrix',
    ]);
    expect(intent.kind).toBe('completeness');
    if (intent.kind === 'completeness') {
      expect(intent.json).toBe(true);
      expect(intent.channelId).toBe('matrix');
    }
  });

  it('routes smoke with channel filter', () => {
    const { resolveChannelCompletenessIntent } = require('./stubs/ChannelCompletenessCli.js');
    const intent = resolveChannelCompletenessIntent(['smoke', '--channel', 'mattermost', '--json']);
    expect(intent.kind).toBe('smoke');
    if (intent.kind === 'smoke') {
      expect(intent.channelId).toBe('mattermost');
      expect(intent.json).toBe(true);
    }
  });

  it('routes --smoke flag on completeness path', () => {
    const { resolveChannelCompletenessIntent } = require('./stubs/ChannelCompletenessCli.js');
    const intent = resolveChannelCompletenessIntent(['--smoke', '--channel', 'matrix']);
    expect(intent.kind).toBe('smoke');
    if (intent.kind === 'smoke') {
      expect(intent.channelId).toBe('matrix');
    }
  });

  it('shows help for --help / help', () => {
    const { resolveChannelCompletenessIntent, formatChannelCompletenessHelp } = require('./stubs/ChannelCompletenessCli.js');
    expect(resolveChannelCompletenessIntent(['--help']).kind).toBe('help');
    expect(resolveChannelCompletenessIntent(['help']).kind).toBe('help');
    const help = formatChannelCompletenessHelp();
    expect(help).toContain('zavorth channels completeness');
    expect(help).toContain('zavorth channels smoke');
    expect(help).toContain('--json');
    expect(help).toContain('--channel');
    expect(help).toContain('--smoke');
    expect(help).toContain(CHANNEL_COMPLETENESS_CONTRACT_VERSION);
    expect(help).toContain('channels doctor');
  });

  it('runChannelCompletenessCli prints help', async () => {
    const { runChannelCompletenessCli } = require('./stubs/ChannelCompletenessCli.js');
    const { code, out } = await capture(() => runChannelCompletenessCli(['--help']));
    expect(code).toBe(0);
    expect(out).toContain('Channel Completeness');
    expect(out).toContain('--smoke');
  });
});

describe('channels completeness launcher wiring', () => {
  const launcher = readFileSync(join(root, 'src/cli/ZavorthCliBuiltinLauncher.ts'), 'utf8');

  it('wires atlas matrix and long-tail activation before doctor deepening', () => {
    expect(launcher).toContain("['atlas', 'matrix', 'capability-atlas'");
    expect(launcher).toContain("['doctor', 'canary', 'activate']");
    const atlasIdx = launcher.indexOf("['atlas', 'matrix', 'capability-atlas'");
    const doctorIdx = launcher.indexOf("['doctor', 'canary', 'activate']");
    expect(atlasIdx).toBeGreaterThan(0);
    expect(doctorIdx).toBeGreaterThan(atlasIdx);
  });

  it('keeps channels doctor long-tail activation path', () => {
    expect(launcher).toContain('runChannelLongTailActivation');
    expect(launcher).toContain("normalizeMeshActivationArgs('channel'");
    expect(launcher).toMatch(/doctor.*canary.*activate/);
  });

  it('does not remove deepening channel doctor routing', () => {
    expect(launcher).toContain('deepeningActions');
    expect(launcher).toContain("'doctor'");
    expect(launcher).toContain('runChannelDeepening');
  });
});
