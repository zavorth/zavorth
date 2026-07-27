import type {
  ExecutionEngineAvailability,
  ExecutionEngineId,
  ExecutionEnginePolicy,
} from '../contracts/ExecutionEngineContract';

export type ExecutionEngineRegistryOptions = {
  activeEngineId?: ExecutionEngineId;
  disableVelocity?: boolean;
  shieldOnly?: boolean;
  lockReason?: string;
};

export type ExecutionEngineRegistrySnapshot = {
  activeEngineId: ExecutionEngineId;
  policies: ExecutionEnginePolicy[];
  availability: ExecutionEngineAvailability[];
};

const ENGINE_POLICIES: Record<ExecutionEngineId, ExecutionEnginePolicy> = {
  lite: {
    id: 'lite',
    label: 'Zavorth Lite',
    audience: 'personal',
    latencyTarget: 'instant',
    sandboxPolicy: 'none',
    approvalPolicy: 'none',
    toolExposure: 'chat-documents-apis',
    diffPolicy: 'not-applicable',
    traceVisibility: 'hidden',
    adminLockPolicy: 'user-selectable',
    summary: 'Fast chat, documents and API help without touching the operating system.',
    allowedActions: ['chat', 'summarize documents', 'answer questions', 'read approved context'],
    blockedActions: ['host file mutation', 'shell execution', 'deployments', 'external side effects'],
  },
  velocity: {
    id: 'velocity',
    label: 'Zavorth Velocity',
    audience: 'developer',
    latencyTarget: 'fast',
    sandboxPolicy: 'trusted-workspace-only',
    approvalPolicy: 'risk-based',
    toolExposure: 'trusted-local-tools',
    diffPolicy: 'interactive-direct-if-trusted',
    traceVisibility: 'compact-operational',
    adminLockPolicy: 'admin-can-disable',
    summary: 'Fast review and apply for simple work inside trusted folders; runtime policy keeps final execution authority.',
    allowedActions: ['express answers', 'simple edits in trusted folders', 'interactive diffs', 'compact trace'],
    blockedActions: ['destructive commands', 'secrets', 'sensitive paths', 'deployments', 'network exfiltration'],
  },
  shield: {
    id: 'shield',
    label: 'Zavorth Shield',
    audience: 'business',
    latencyTarget: 'governed',
    sandboxPolicy: 'sandbox-required',
    approvalPolicy: 'always-for-impact',
    toolExposure: 'governed-full-tools',
    diffPolicy: 'interactive-approval-required',
    traceVisibility: 'full-operational',
    adminLockPolicy: 'admin-required',
    summary: 'Governed execution with sandbox, policy broker, approvals and receipts.',
    allowedActions: ['sandbox rehearsal', 'policy approvals', 'receipts', 'audit export', 'sensitive work with gates'],
    blockedActions: ['raw chain-of-thought exposure', 'unguarded host direct mutations'],
  },
};

function readEnvOptions(): ExecutionEngineRegistryOptions {
  const shieldOnly = process.env.ZAVORTH_ENGINE_ADMIN_LOCK === 'shield'
    || process.env.ZAVORTH_ENGINE_SHIELD_ONLY === 'true';
  const disableVelocity = shieldOnly || process.env.ZAVORTH_ENGINE_DISABLE_VELOCITY === 'true';
  return {
    shieldOnly,
    disableVelocity,
    lockReason: shieldOnly ? 'Admin policy requires Shield for this installation.'
      : (disableVelocity ? 'Admin policy disabled Velocity on this installation.' : undefined),
  };
}

export class ExecutionEngineRegistryService {
  private activeEngineId: ExecutionEngineId;
  private options: ExecutionEngineRegistryOptions;

  public constructor(options: ExecutionEngineRegistryOptions = {}) {
    this.options = { ...readEnvOptions(), ...options };
    this.activeEngineId = this.normalizeActive(options.activeEngineId ?? 'lite');
  }

  public listPolicies(): ExecutionEnginePolicy[] {
    return ['lite', 'velocity', 'shield'].map((id) => ENGINE_POLICIES[id as ExecutionEngineId]);
  }

  public getPolicy(engineId: ExecutionEngineId): ExecutionEnginePolicy {
    return ENGINE_POLICIES[engineId];
  }

  public getActiveEngineId(): ExecutionEngineId {
    return this.activeEngineId;
  }

  public getAvailability(): ExecutionEngineAvailability[] {
    return this.listPolicies().map((policy) => this.availabilityFor(policy.id));
  }

  public getSnapshot(): ExecutionEngineRegistrySnapshot {
    return {
      activeEngineId: this.activeEngineId,
      policies: this.listPolicies(),
      availability: this.getAvailability(),
    };
  }

  public select(engineId: ExecutionEngineId): {
    ok: boolean;
    activeEngineId: ExecutionEngineId;
    availability: ExecutionEngineAvailability;
  } {
    const availability = this.availabilityFor(engineId);
    if (availability.available) {
      this.activeEngineId = engineId;
    }
    return {
      ok: availability.available,
      activeEngineId: this.activeEngineId,
      availability,
    };
  }

  public setAdminPolicy(options: Partial<ExecutionEngineRegistryOptions>): void {
    this.options = { ...this.options, ...options };
    this.activeEngineId = this.normalizeActive(this.activeEngineId);
  }

  public isAvailable(engineId: ExecutionEngineId): boolean {
    return this.availabilityFor(engineId).available;
  }

  private normalizeActive(engineId: ExecutionEngineId): ExecutionEngineId {
    const availability = this.availabilityFor(engineId);
    return availability.available ? engineId : 'shield';
  }

  private availabilityFor(engineId: ExecutionEngineId): ExecutionEngineAvailability {
    if (this.options.shieldOnly && engineId !== 'shield') {
      return {
        engineId,
        available: false,
        reason: this.options.lockReason ?? 'Admin policy requires Shield.',
        nextSafeAction: 'Use Shield or ask an administrator to change the engine policy.',
      };
    }
    if (this.options.disableVelocity && engineId === 'velocity') {
      return {
        engineId,
        available: false,
        reason: this.options.lockReason ?? 'Velocity is disabled by admin policy.',
        nextSafeAction: 'Use Lite for chat or Shield for governed execution.',
      };
    }
    return {
      engineId,
      available: true,
      reason: null,
      nextSafeAction: null,
    };
  }
}
