/**
 * CLI: zavorth consensus <action> ?  *
 * Thin wrapper over ConsensusSurface (same path as /consensus on channels).
 */

import {
  formatConsensusHelp,
  invokeConsensusSurface,
} from '../services/ConsensusSurface.js';

export async function runConsensusCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h') || rawArgs[0] === 'help') {
    console.log(formatConsensusHelp());
    return 0;
  }

  if (rawArgs.length === 0) {
    console.log(formatConsensusHelp());
    return 1;
  }

  const result = await invokeConsensusSurface({
    tokens: rawArgs,
    projectRoot: process.cwd(),
  });

  console.log(result.text);
  return result.ok ? 0 : 1;
}
