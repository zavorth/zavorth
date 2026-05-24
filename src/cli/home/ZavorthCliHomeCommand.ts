import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { buildZavorthCliHomeSnapshot } from './ZavorthCliHomeProjection.js';
import { renderZavorthCliHome } from './ZavorthCliHomeRenderer.js';
import type { ZavorthCliHomeSnapshot } from './ZavorthCliHomeTypes.js';

export type RunZavorthCliHomeInput = {
  projectRoot: string;
  json?: boolean;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export type RunZavorthCliHomeResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliHomeSnapshot;
};

export function runZavorthCliHome(input: RunZavorthCliHomeInput): RunZavorthCliHomeResult {
  const snapshot = buildZavorthCliHomeSnapshot({
    projectRoot: input.projectRoot,
    now: input.now,
    mutationPlane: input.mutationPlane,
  });
  const output = input.json
    ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${renderZavorthCliHome(snapshot)}\n`;

  return {
    exitCode: snapshot.status === 'blocked' ? 1 : 0,
    output,
    snapshot,
  };
}
