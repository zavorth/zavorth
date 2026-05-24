import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { buildZavorthCliQuickStartSnapshot } from './ZavorthCliQuickStartProjection.js';
import { renderZavorthCliQuickStart } from './ZavorthCliQuickStartRenderer.js';
import type { ZavorthCliQuickStartSnapshot } from './ZavorthCliQuickStartTypes.js';

export type RunZavorthCliQuickStartInput = {
  projectRoot: string;
  json?: boolean;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export type RunZavorthCliQuickStartResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliQuickStartSnapshot;
};

export function runZavorthCliQuickStart(input: RunZavorthCliQuickStartInput): RunZavorthCliQuickStartResult {
  const snapshot = buildZavorthCliQuickStartSnapshot({
    projectRoot: input.projectRoot,
    now: input.now,
    mutationPlane: input.mutationPlane,
  });
  const output = input.json
    ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${renderZavorthCliQuickStart(snapshot)}\n`;

  return {
    exitCode: snapshot.status === 'blocked' ? 1 : 0,
    output,
    snapshot,
  };
}
