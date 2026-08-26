import type { SurfaceDecisionChoice, SurfaceDecisionReceipt } from '../SurfaceDecisionContract.js';
import type { SurfaceDecisionPort, SurfaceDecisionPortDecideInput } from '../SurfaceDecisionPort.js';

export type PermissionRegistryDecider = (input: {
  reference: string;
  action: 'approve' | 'deny';
  scope: SurfaceDecisionChoice;
  actorId: string | null;
}) => Promise<string | null>;

export type PermissionRegistryPortOptions = {
  isPending?: (ref: string) => boolean;
};

/**
 * Permission decision port backed by a constructor-injected decider callback.
 * The legacy Telegram permission engine requires a full grammy Context plus a
 * live PermissionRequest registry, so the real engine bridges through this
 * decider in a later wiring step; the contract here stays surface-agnostic.
 */
export class PermissionRegistryPort implements SurfaceDecisionPort {
  private readonly decider: PermissionRegistryDecider;
  private readonly isPendingOverride: ((ref: string) => boolean) | null;

  constructor(decider: PermissionRegistryDecider, options: PermissionRegistryPortOptions = {}) {
    this.decider = decider;
    this.isPendingOverride = options.isPending ?? null;
  }

  public findPending(ref: string): boolean {
    if (this.isPendingOverride) {
      return this.isPendingOverride(ref);
    }
    return true;
  }

  public async decide(input: SurfaceDecisionPortDecideInput): Promise<SurfaceDecisionReceipt> {
    const receiptText = await this.decider({
      reference: input.ref,
      action: input.choice === 'deny' ? 'deny' : 'approve',
      scope: input.choice,
      actorId: input.actorId,
    });
    return {
      resolved: true,
      receiptText,
      decidedBy: 'operator',
      dismissals: [],
    };
  }
}
