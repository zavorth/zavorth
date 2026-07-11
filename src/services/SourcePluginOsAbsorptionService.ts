import type {
  SourcePluginOsAbsorptionSnapshot,
} from '../contracts/SourcePluginPackageContract.js';
import { ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION } from '../contracts/SourcePluginPackageContract.js';

import { SourcePluginRuntimeDoctorService } from './SourcePluginRuntimeDoctorService.js';
import { SourcePluginSdkCompatibilityMatrixService } from './SourcePluginSdkCompatibilityMatrixService.js';
import { resolveZavorthSourceRoot } from './ZavorthSourceRootResolver.js';

type SourcePluginOsAbsorptionRuntime = {
  now?: () => Date;
  sourceRoot?: string;
  matrixService?: SourcePluginSdkCompatibilityMatrixService;
  doctorService?: SourcePluginRuntimeDoctorService;
};

export class SourcePluginOsAbsorptionService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly matrixService: SourcePluginSdkCompatibilityMatrixService;
  private readonly doctorService: SourcePluginRuntimeDoctorService;

  constructor(runtime: SourcePluginOsAbsorptionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.matrixService = runtime.matrixService || new SourcePluginSdkCompatibilityMatrixService({
      now: this.now,
    });
    this.doctorService = runtime.doctorService || new SourcePluginRuntimeDoctorService({
      now: this.now,
    });
  }

  public buildSnapshot(input: { sourceRoot?: string | null } = {}): SourcePluginOsAbsorptionSnapshot {
    const sourceRoot = resolveZavorthSourceRoot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
    });
    const matrix = this.matrixService.buildSnapshot(sourceRoot);
    const doctor = this.doctorService.doctorPackageJson({
      packageJson: this.buildSampleSourcePluginPackage(),
      packagePath: 'intent-model://sample/source-compatible-provider',
      digest: 'sha256:intent-model-sample',
    });
    const status = matrix.status === 'passed' && doctor.status === 'passed' ? 'passed' : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION,
      status,
      gate: 'source-plugin-package',
      statement: 'Source Plugin OS and package SDK surfaces are absorbed as Zavorth-native contracts, adapter checks, policy and receipts.',
      matrix,
      doctor,
      summary: {
        packagesFound: matrix.summary.packagesFound,
        declaredExports: matrix.summary.declaredExports,
        manifestsConverted: doctor.adapter.status === 'converted' ? 1 : 0,
        lifecycleReceipts: doctor.summary.receipts,
        approvalsRequired: doctor.summary.approvalsRequired,
        blocked: doctor.summary.blocked,
        unimplementedSourceShim: false,
        runtimeExecutionPerformed: false,
        secretValuesSerialized: false,
      },
      policy: {
        noSourceSourceCopy: true,
        noSourceImportPathShim: true,
        noExternalPluginCodeExecution: true,
        disabledByDefault: true,
        policyRequiredBeforeInvoke: true,
        artifactFirstReceipts: true,
      },
      commands: {
        inspect: 'npm run source-plugin-os-absorption --silent',
        inspectJson: 'npm run source-plugin-os-absorption:json --silent',
        check: 'npm run source-plugin-os-absorption:check --silent',
        qa: 'npm run qa:source-plugin-os-absorption --silent',
        nextStage: 'Preview engine - Agent Runtime Bridge Pack',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Source Plugin OS Absorption - Intent model',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Packages found: ${snapshot.summary.packagesFound}/${snapshot.matrix.summary.packagesExpected}`,
      `Declared Source package exports: ${snapshot.summary.declaredExports}`,
      `Plugin SDK exports: ${snapshot.matrix.summary.pluginSdkExports}`,
      `Memory host exports: ${snapshot.matrix.summary.memoryHostExports}`,
      `Package contract exports: ${snapshot.matrix.summary.packageContractExports}`,
      `SDK root exports: ${snapshot.matrix.summary.sdkRootExports}`,
      `Converted manifests: ${snapshot.summary.manifestsConverted}`,
      `Lifecycle receipts: ${snapshot.summary.lifecycleReceipts}`,
      `Approvals required in doctor: ${snapshot.summary.approvalsRequired}`,
      `Blocked receipts: ${snapshot.summary.blocked}`,
      `Runtime execution performed: ${snapshot.summary.runtimeExecutionPerformed}`,
    ];

    lines.push('Package decisions:');
    for (const entry of snapshot.matrix.entries) {
      lines.push(`- ${entry.packageName}: ${entry.status}, exports=${entry.declaredExports}, decision=${entry.decision}, target=${entry.zavorthTarget}`);
    }

    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildSampleSourcePluginPackage(): unknown {
    return {
      name: '@example/source-weather-provider',
      version: '1.2.3',
      description: 'Source-compatible provider plugin used by Zavorth Intent model doctor.',
      keywords: ['source', 'provider', 'auth'],
      main: './dist/index.js',
      source: {
        compat: {
          pluginApi: '^1.0.0',
          minGatewayVersion: '>=1.1.0',
        },
        build: {
          sourceVersion: '0.0.0-private',
          pluginSdkVersion: '0.0.0-private',
        },
        plugin: {
          id: 'weather-provider',
          label: 'Weather Provider',
          kind: 'provider',
        },
        entrypoint: {
          module: './dist/index.js',
          exportName: 'createWeatherProviderPlugin',
        },
        capabilities: [
          {
            id: 'weather.lookup',
            intent: 'weather_lookup',
            label: 'Weather Lookup',
            summary: 'Looks up weather through a policy-gated provider plugin.',
            artifactKinds: ['weather.lookup.receipt'],
          },
        ],
        permissions: [
          {
            kind: 'network.external',
            scope: 'external',
            reason: 'Weather provider calls an external weather API when enabled.',
            required: true,
          },
          {
            kind: 'secret.read',
            scope: 'workspace',
            reason: 'Weather provider may require an API key SecretRef.',
            required: true,
          },
          {
            kind: 'artifact.write',
            scope: 'workspace',
            reason: 'Weather lookups write artifact-first receipts.',
            required: false,
          },
        ],
      },
    };
  }
}
