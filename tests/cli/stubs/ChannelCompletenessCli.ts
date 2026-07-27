import { CHANNEL_COMPLETENESS_CONTRACT_VERSION } from '../../../src/services/ChannelCompletenessService.js';

export function formatChannelCompletenessHelp(): string {
  return [
    'Channel Completeness',
    '',
    'Usage: zavorth channels completeness [options]',
    '',
    'Inspect first-class channel completeness across the product fabric.',
    '',
    'Commands:',
    '  completeness         Full channel inventory',
    '  zavorth channels smoke       Mock inbound + outbound smoke test',
    '',
    'Options:',
    '  --json               Output JSON snapshot',
    '  --channel <id>       Filter to a single channel',
    '  --smoke              Run smoke test path',
    '',
    `Contract: ${CHANNEL_COMPLETENESS_CONTRACT_VERSION}`,
    '',
    'See also: channels doctor',
  ].join('\n');
}

export function resolveChannelCompletenessIntent(args: string[]): any {
  if (args.length === 0) {
    return { kind: 'completeness', json: false, channelId: null };
  }
  if (args.includes('--help') || args.includes('help')) {
    return { kind: 'help' };
  }
  const hasSmoke = args.includes('--smoke') || args[0] === 'smoke';
  const json = args.includes('--json');
  const channelIdx = args.indexOf('--channel');
  const channelId = channelIdx >= 0 ? args[channelIdx + 1] || null : null;

  if (hasSmoke) {
    return { kind: 'smoke', json, channelId };
  }
  return { kind: 'completeness', json, channelId };
}

export async function runChannelCompletenessCli(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('help')) {
    console.log(formatChannelCompletenessHelp());
    return 0;
  }
  return 0;
}
