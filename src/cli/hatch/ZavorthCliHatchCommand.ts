import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { buildZavorthCliHatchSnapshot } from './ZavorthCliHatchProjection.js';
import { renderZavorthCliHatch } from './ZavorthCliHatchRenderer.js';
import type { ZavorthCliHatchSnapshot } from './ZavorthCliHatchTypes.js';

export type RunZavorthCliHatchInput = {
  projectRoot: string;
  json?: boolean;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export type RunZavorthCliHatchResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliHatchSnapshot;
};

export function runZavorthCliHatch(input: RunZavorthCliHatchInput): RunZavorthCliHatchResult {
  const snapshot = buildZavorthCliHatchSnapshot({
    projectRoot: input.projectRoot,
    now: input.now,
    mutationPlane: input.mutationPlane,
  });
  const output = input.json
    ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${renderZavorthCliHatch(snapshot)}\n`;

  return {
    exitCode: snapshot.status === 'blocked' ? 1 : 0,
    output,
    snapshot,
  };
}
