import type { ComputerUseWatchModePolicyDocument, ComputerUseWatchModePolicyFileService } from '../ComputerUseWatchModePolicyFileService.js';
import type { ComputerUseWatchModeState, WatchModeSnapshot } from './ComputerUseWatchModeSharedTypes.js';

type ComputerUseWatchModePolicySupportDeps = {
  state: ComputerUseWatchModeState;
  policyFileService: Pick<ComputerUseWatchModePolicyFileService, 'readPolicy' | 'savePolicy'>;
  persistSnapshot: () => WatchModeSnapshot;
  strictApprovalDefault?: boolean;
  allowedApps?: string[];
  allowedSites?: string[];
  readListEnv: (...keys: string[]) => string[];
  readStrictApprovalDefault: () => boolean;
  mergeLists: (primary: string[], secondary: string[]) => string[];
  normalizeAppList: (values: string[]) => string[];
  normalizeSiteList: (values: string[]) => string[];
  normalizeApp: (value: unknown) => string;
  normalizeSite: (value: unknown) => string;
};

export class ComputerUseWatchModePolicySupport {
  constructor(private readonly deps: ComputerUseWatchModePolicySupportDeps) {
    this.bootstrapState();
  }

  public setStrictApprovalDefault(value: boolean): WatchModeSnapshot {
    this.deps.state.strictApprovalDefault = value === true;
    this.persistPolicy();
    return this.deps.persistSnapshot();
  }

  public allowApp(app: string): WatchModeSnapshot {
    const normalized = this.deps.normalizeApp(app);
    if (!normalized) {
      throw new Error('app obrigatorio para atualizar a allowlist do Watch Mode.');
    }
    if (!this.deps.state.allowedApps.includes(normalized)) {
      this.deps.state.allowedApps = this.deps.normalizeAppList([...this.deps.state.allowedApps, normalized]);
    }
    this.persistPolicy();
    return this.deps.persistSnapshot();
  }

  public allowSite(site: string): WatchModeSnapshot {
    const normalized = this.deps.normalizeSite(site);
    if (!normalized) {
      throw new Error('site obrigatorio para atualizar a allowlist do Watch Mode.');
    }
    if (!this.deps.state.allowedSites.includes(normalized)) {
      this.deps.state.allowedSites = this.deps.normalizeSiteList([...this.deps.state.allowedSites, normalized]);
    }
    this.persistPolicy();
    return this.deps.persistSnapshot();
  }

  private bootstrapState(): void {
    const persistedPolicy = this.deps.policyFileService.readPolicy();
    this.deps.state.strictApprovalDefault =
      this.deps.strictApprovalDefault ?? persistedPolicy.strictApprovalDefault ?? this.deps.readStrictApprovalDefault();
    this.deps.state.allowedApps = this.deps.normalizeAppList(
      this.deps.mergeLists(
        persistedPolicy.allowedApps,
        this.deps.allowedApps || this.deps.readListEnv('ZAVORTH_WATCH_ALLOWED_APPS', 'ZAVORTH_COMPUTER_USE_ALLOWED_APPS'),
      ),
    );
    this.deps.state.allowedSites = this.deps.normalizeSiteList(
      this.deps.mergeLists(
        persistedPolicy.allowedSites,
        this.deps.allowedSites || this.deps.readListEnv('ZAVORTH_WATCH_ALLOWED_SITES', 'ZAVORTH_COMPUTER_USE_ALLOWED_SITES'),
      ),
    );
    this.deps.state.defaultBudget = {
      ...this.deps.state.defaultBudget,
      ...persistedPolicy.defaultBudget,
      screenshotTtlMs: persistedPolicy.screenshotTtlMs,
      maxScreenshotBytes: persistedPolicy.maxScreenshotBytes,
      screenshotRedactionMode: persistedPolicy.screenshotRedactionMode,
      sensitiveScreenPolicy: persistedPolicy.sensitiveScreenPolicy,
    };
  }

  private persistPolicy(): ComputerUseWatchModePolicyDocument {
    return this.deps.policyFileService.savePolicy({
      strictApprovalDefault: this.deps.state.strictApprovalDefault,
      allowedApps: [...this.deps.state.allowedApps],
      allowedSites: [...this.deps.state.allowedSites],
      screenshotTtlMs: this.deps.state.defaultBudget.screenshotTtlMs,
      maxScreenshotBytes: this.deps.state.defaultBudget.maxScreenshotBytes,
      screenshotRedactionMode: this.deps.state.defaultBudget.screenshotRedactionMode,
      sensitiveScreenPolicy: this.deps.state.defaultBudget.sensitiveScreenPolicy,
      defaultBudget: { ...this.deps.state.defaultBudget },
    });
  }
}
