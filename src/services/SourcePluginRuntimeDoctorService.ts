import type {
  SourcePluginRuntimeDoctorSnapshot,
} from '../contracts/SourcePluginPackageContract.js';
import { ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION } from '../contracts/SourcePluginPackageContract.js';

import { SourcePluginPackageAdapterService } from './SourcePluginPackageAdapterService.js';
import { PluginRegistryService } from './PluginRegistryService.js';

type SourcePluginRuntimeDoctorRuntime = {
  now?: () => Date;
  adapterService?: SourcePluginPackageAdapterService;
};

export class SourcePluginRuntimeDoctorService {
  private readonly now: () => Date;
  private readonly adapter: SourcePluginPackageAdapterService;

  constructor(runtime: SourcePluginRuntimeDoctorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapter = runtime.adapterService || new SourcePluginPackageAdapterService({
      now: this.now,
    });
  }

  public doctorPackageJson(input: {
    packageJson: unknown;
    packagePath?: string | null;
    digest?: string | null;
  }): SourcePluginRuntimeDoctorSnapshot {
    const adapter = this.adapter.convertPackageJson(input);
    const registry = new PluginRegistryService({
      now: this.now,
      manifests: [adapter.manifest],
    });
    const entry = registry.getEntry(adapter.manifest.id);
    const installWithoutApproval = registry.install(adapter.manifest.id);
    const installWithApproval = registry.install(adapter.manifest.id, { approved: true });
    const enableWithApproval = registry.enable(adapter.manifest.id, { approved: true });
    const invocationPlan = registry.prepareInvocation({
      pluginId: adapter.manifest.id,
      capabilityId: adapter.manifest.capabilities[0]?.id || `${adapter.manifest.id}.invoke`,
      approved: false,
    });
    const receipts = [
      installWithoutApproval,
      installWithApproval,
      enableWithApproval,
      invocationPlan.receipt,
    ];
    const blocked = receipts.filter((receipt) => receipt.status === 'blocked').length;
    const approvalsRequired = receipts.filter((receipt) => receipt.status === 'approval_required').length;
    const manifestFindings = entry?.health.findings || [];
    const status = adapter.status === 'blocked' || blocked > 0 || manifestFindings.length > 0
      ? 'failed'
      : 'passed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION,
      status,
      adapter,
      manifestHealth: {
        ok: manifestFindings.length === 0,
        findings: manifestFindings,
      },
      lifecycle: {
        installWithoutApproval,
        installWithApproval,
        enableWithApproval,
        invokeWithoutApproval: invocationPlan.receipt,
      },
      summary: {
        receipts: receipts.length,
        approvalsRequired,
        blocked,
        executionPerformed: false,
        noSecretsSerialized: true,
      },
      policy: {
        doctorOnly: true,
        noExternalPluginCodeExecution: true,
        approvalRequiredBeforeSensitiveInvoke: true,
        sandboxPolicyEvaluated: true,
        receiptsEmitted: true,
      },
    };
  }
}
