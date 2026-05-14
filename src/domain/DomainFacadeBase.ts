export type DomainMetricValue = string | number | boolean | null;

export type DomainSnapshot = {
  id: string;
  label: string;
  initialized: boolean;
  initializedAt: string | null;
  summary: string;
  details: string[];
  metrics: Record<string, DomainMetricValue>;
};

export abstract class DomainFacadeBase<TSnapshot extends DomainSnapshot = DomainSnapshot> {
  private initializedAt: string | null = null;

  protected constructor(
    private readonly id: string,
    private readonly label: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public initializeSync(): void {
    if (!this.initializedAt) {
      this.initializedAt = this.now().toISOString();
    }
  }

  public async initialize(): Promise<void> {
    this.initializeSync();
  }

  public getInitializationState(): {
    id: string;
    label: string;
    initialized: boolean;
    initializedAt: string | null;
  } {
    return {
      id: this.id,
      label: this.label,
      initialized: Boolean(this.initializedAt),
      initializedAt: this.initializedAt,
    };
  }

  protected composeSnapshot(input: {
    summary: string;
    details?: string[];
    metrics?: Record<string, DomainMetricValue>;
  }): DomainSnapshot {
    const state = this.getInitializationState();
    return {
      id: this.id,
      label: this.label,
      initialized: state.initialized,
      initializedAt: state.initializedAt,
      summary: input.summary,
      details: Array.isArray(input.details) ? input.details : [],
      metrics: input.metrics || {},
    };
  }

  public abstract buildSnapshot(): TSnapshot;
}
