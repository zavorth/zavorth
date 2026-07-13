import { BaseSurfaceProjector } from './BaseSurfaceProjector.js';

/** Safe default for unknown / text-only surfaces. */
export class PlainSurfaceProjector extends BaseSurfaceProjector {
  public readonly channel = 'plain';
  protected readonly renderTarget = 'plain' as const;

  protected override defaultMaxActionsPerRow(): number {
    return 1;
  }
}
