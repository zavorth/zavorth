/**
 * Trusted Operator Mode — single-user local posture with less green-lane friction.
 * Never bypasses red lane, policy changes, or receipt requirements.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { TrustedOperatorModeState } from '../../contracts/UniversalPowerFabricContract.js';

export type TrustedOperatorDecision = {
  autoApprove: boolean;
  reason: string;
  lane: 'green' | 'yellow' | 'red';
  receiptsRequired: true;
};

type Runtime = {
  stateFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export class TrustedOperatorModeService {
  private readonly stateFile: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private state: TrustedOperatorModeState;

  constructor(runtime: Runtime = {}) {
    this.stateFile = path.resolve(
      runtime.stateFile
        || path.join(process.cwd(), '.zavorth', 'trusted-operator-mode.json'),
    );
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.state = this.load();
  }

  public getState(): TrustedOperatorModeState {
    return { ...this.state };
  }

  public isEnabled(): boolean {
    return this.state.enabled;
  }

  public enable(updatedBy: string | null = null, note: string | null = null): TrustedOperatorModeState {
    return this.setEnabled(true, updatedBy, note);
  }

  public disable(updatedBy: string | null = null, note: string | null = null): TrustedOperatorModeState {
    return this.setEnabled(false, updatedBy, note);
  }

  public setEnabled(enabled: boolean, updatedBy: string | null = null, note: string | null = null): TrustedOperatorModeState {
    this.state = {
      ...this.state,
      enabled,
      updatedAt: this.now().toISOString(),
      updatedBy: updatedBy || null,
      note: note || null,
    };
    this.persist();
    return this.getState();
  }

  /**
   * Decide whether Trusted Operator may auto-approve an action description.
   * Red always denied for auto. Yellow never auto. Green/read-only may auto when enabled.
   */
  public decide(input: {
    description?: string;
    risk?: 'low' | 'medium' | 'high' | 'critical';
    mutation?: boolean;
    trustedFolder?: boolean;
    securityPolicyChange?: boolean;
  }): TrustedOperatorDecision {
    void input.description;
    const risk = input.risk || 'medium';
    const mutation = input.mutation === true;
    const trustedFolder = input.trustedFolder !== false;

    if (input.securityPolicyChange || risk === 'critical' || risk === 'high') {
      return {
        autoApprove: false,
        reason: 'Red-lane / high-risk action never auto-approves under Trusted Operator Mode.',
        lane: 'red',
        receiptsRequired: true,
      };
    }

    if (!this.state.enabled) {
      return {
        autoApprove: false,
        reason: 'Trusted Operator Mode is disabled.',
        lane: mutation ? 'yellow' : 'green',
        receiptsRequired: true,
      };
    }

    if (!trustedFolder && mutation) {
      return {
        autoApprove: false,
        reason: 'Mutations outside trusted folders still require explicit approval.',
        lane: 'yellow',
        receiptsRequired: true,
      };
    }

    if (risk === 'low' && !mutation) {
      return {
        autoApprove: true,
        reason: 'Green/read-only action auto-approved with receipts while Trusted Operator Mode is on.',
        lane: 'green',
        receiptsRequired: true,
      };
    }

    // medium trusted-folder small mutation still needs approval (Velocity-style) unless risk is low
    return {
      autoApprove: false,
      reason: 'Yellow/medium action requires explicit approval even in Trusted Operator Mode.',
      lane: 'yellow',
      receiptsRequired: true,
    };
  }

  private load(): TrustedOperatorModeState {
    const base: TrustedOperatorModeState = {
      enabled: false,
      updatedAt: null,
      updatedBy: null,
      note: null,
      reduceGreenApprovals: true,
      redLaneIntact: true,
      receiptsAlways: true,
      autoApproveRiskCeiling: 'low',
      trustedFolderOnly: true,
    };
    if (!this.existsSync(this.stateFile)) return base;
    try {
      const parsed = JSON.parse(this.readFileSync(this.stateFile, 'utf8')) as Partial<TrustedOperatorModeState>;
      return {
        ...base,
        enabled: Boolean(parsed.enabled),
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null,
        note: parsed.note || null,
      };
    } catch {
      return base;
    }
  }

  private persist(): void {
    try {
      this.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      this.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch {
      // keep memory state
    }
  }
}
