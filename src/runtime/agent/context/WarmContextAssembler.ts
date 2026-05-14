import {
  CanonicalSessionContextAssembler,
  type CanonicalHotContextInput,
  type CanonicalHotContextSnapshot,
  type CanonicalSessionContextInput,
  type CanonicalSessionContextSnapshot,
  type CanonicalWarmContextInput,
  type CanonicalWarmContextSnapshot,
} from './CanonicalSessionContextAssembler.js';

export type WarmContextCanonicalAssembler = Pick<CanonicalSessionContextAssembler, 'assemble'>;

export type WarmContextAssemblerOptions = {
  canonicalAssembler?: WarmContextCanonicalAssembler | null;
};

export type WarmContextAssemblerInput = Omit<
  CanonicalSessionContextInput,
  'profile' | 'cold'
> & {
  hot?: CanonicalHotContextInput | null;
  warm?: CanonicalWarmContextInput | null;
};

export type WarmContextAssemblerSnapshot = {
  hot: CanonicalHotContextSnapshot;
  warm: CanonicalWarmContextSnapshot;
  canonical: CanonicalSessionContextSnapshot;
  metadata: Record<string, unknown>;
};

export class WarmContextAssembler {
  private readonly canonicalAssembler: WarmContextCanonicalAssembler;

  constructor(options: WarmContextAssemblerOptions = {}) {
    this.canonicalAssembler = options.canonicalAssembler || new CanonicalSessionContextAssembler();
  }

  public assemble(input: WarmContextAssemblerInput = {}): WarmContextAssemblerSnapshot {
    const canonical = this.canonicalAssembler.assemble({
      ...input,
      profile: 'warm',
      hot: input.hot || {},
      warm: input.warm || {},
      metadata: {
        ...(input.metadata || {}),
        warmContextSource: 'WarmContextAssembler',
      },
    });
    const metadata: Record<string, unknown> = {
      ...canonical.metadata,
      source: 'CanonicalSessionContextAssembler',
      layer: 'warm',
      required: false,
      includesWarm: true,
      includesCold: false,
      toolExposureGatedByWarmContext: false,
    };

    return {
      hot: canonical.hot,
      warm: canonical.warm!,
      canonical: {
        ...canonical,
        metadata,
      },
      metadata,
    };
  }
}
