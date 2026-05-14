import {
  CanonicalSessionContextAssembler,
  type CanonicalHotContextInput,
  type CanonicalHotContextSnapshot,
  type CanonicalSessionContextInput,
  type CanonicalSessionContextSnapshot,
} from './CanonicalSessionContextAssembler.js';

export type HotContextCanonicalAssembler = Pick<CanonicalSessionContextAssembler, 'assemble'>;

export type HotContextAssemblerOptions = {
  canonicalAssembler?: HotContextCanonicalAssembler | null;
};

export type HotContextAssemblerInput = Omit<
  CanonicalSessionContextInput,
  'profile' | 'warm' | 'cold'
> & {
  hot?: CanonicalHotContextInput | null;
};

export type HotContextAssemblerSnapshot = {
  hot: CanonicalHotContextSnapshot;
  canonical: CanonicalSessionContextSnapshot;
  metadata: Record<string, unknown>;
};

export class HotContextAssembler {
  private readonly canonicalAssembler: HotContextCanonicalAssembler;

  constructor(options: HotContextAssemblerOptions = {}) {
    this.canonicalAssembler = options.canonicalAssembler || new CanonicalSessionContextAssembler();
  }

  public assemble(input: HotContextAssemblerInput = {}): HotContextAssemblerSnapshot {
    const canonical = this.canonicalAssembler.assemble({
      ...input,
      profile: 'hot',
      hot: input.hot || {},
      metadata: {
        ...(input.metadata || {}),
        hotContextSource: 'HotContextAssembler',
      },
    });
    const metadata: Record<string, unknown> = {
      ...canonical.metadata,
      source: 'CanonicalSessionContextAssembler',
      layer: 'hot',
      required: true,
      includesWarm: false,
      includesCold: false,
      toolExposureGatedByHotContext: false,
    };

    return {
      hot: canonical.hot,
      canonical: {
        ...canonical,
        metadata,
      },
      metadata,
    };
  }
}
