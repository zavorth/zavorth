import { BaseSurfaceProjector } from './BaseSurfaceProjector.js';

export class CliSurfaceProjector extends BaseSurfaceProjector {
  public readonly channel = 'cli';
  protected readonly renderTarget = 'cli' as const;

  protected override defaultMaxActionsPerRow(): number {
    return 1;
  }
}
