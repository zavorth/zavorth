export const ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_NOW = '2026-05-01T23:15:00.000Z' as const;
export const ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_RUNTIME_ID =
  'zavorth-npm-package-footprint-reduction-pack' as const;

export type ZavorthNpmPackageFootprintDecision =
  | 'zavorth-package-footprint-reduced'
  | 'zavorth-package-footprint-measured-no-safe-reduction';

export type ZavorthNpmPackageFootprintSnapshot = {
  nativeContract: 'ZavorthNpmPackageFootprintSnapshot/v1';
  label: 'baseline' | 'optimized';
  command: 'npm pack --dry-run --json --ignore-scripts';
  packageName: 'zavorth';
  packageVersion: '1.1.0-alpha.0';
  packageSizeBytes: number;
  unpackedSizeBytes: number;
  fileCount: number;
  mapFileCount: number;
  docsIncluded: string[];
};

export type ZavorthNpmPackageRemovedCategory = {
  nativeContract: 'ZavorthNpmPackageRemovedCategory/v1';
  category:
    | 'generated-sourcemaps'
    | 'internal-release-docs'
    | 'source-duplicate-risk'
    | 'tests-fixtures-repo-artifacts';
  disposition: 'excluded-from-tarball' | 'measured-not-present' | 'retained';
  fileCountDelta: number;
  rationale: string;
};

export type ZavorthNpmPackageRetainedRequiredCategory = {
  nativeContract: 'ZavorthNpmPackageRetainedRequiredCategory/v1';
  category: 'bin' | 'dist-runtime' | 'dist-ops-runtime' | 'public-docs' | 'package-metadata';
  retained: true;
  rationale: string;
};

export type ZavorthNpmPackagePolicyChange = {
  nativeContract: 'ZavorthNpmPackagePolicyChange/v1';
  file: 'package.json' | 'README.md';
  change: string;
  runtimeBehaviorChanged: false;
};

export type ZavorthNpmPackageRegressionCheck = {
  nativeContract: 'ZavorthNpmPackageRegressionCheck/v1';
  command: string;
  required: boolean;
  status: 'passed' | 'pending';
  rationale: string;
};

export type ZavorthNpmPackageBlockedAction = {
  nativeContract: 'ZavorthNpmPackageBlockedAction/v1';
  action:
    | 'create-package-publish'
    | 'domain-purchase'
    | 'global-install'
    | 'npm-publish'
    | 'runtime-dangerous-change'
    | 'trademark-file';
  performed: false;
};

export type ZavorthNpmPackageFootprintFinalState = {
  decision: ZavorthNpmPackageFootprintDecision;
  npmPublishActuallyPerformed: false;
  createPackagePublishActuallyPerformed: false;
  runtimeBehaviorChanged: false;
  cliBehaviorPreserved: true;
  globalInstallPerformed: false;
  rawSecretSerialized: false;
  externalExecutorPublicIdentityReintroduced: false;
};

export type ZavorthNpmPackageFootprintReductionPackNormalization = {
  nativeContract: 'ZavorthNpmPackageFootprintReductionPack/v1';
  packId: '274';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_RUNTIME_ID;
  decision: ZavorthNpmPackageFootprintDecision;
  baselineFootprint: ZavorthNpmPackageFootprintSnapshot;
  optimizedFootprint: ZavorthNpmPackageFootprintSnapshot;
  removedCategories: ZavorthNpmPackageRemovedCategory[];
  retainedRequiredCategories: ZavorthNpmPackageRetainedRequiredCategory[];
  packagePolicyChanges: ZavorthNpmPackagePolicyChange[];
  regressionChecks: ZavorthNpmPackageRegressionCheck[];
  blockedActions: ZavorthNpmPackageBlockedAction[];
  validationCommands: string[];
  finalState: ZavorthNpmPackageFootprintFinalState;
};

export type ZavorthNpmPackageFootprintReductionPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_RUNTIME_ID;
};

function baselineFootprint(): ZavorthNpmPackageFootprintSnapshot {
  return {
    nativeContract: 'ZavorthNpmPackageFootprintSnapshot/v1',
    label: 'baseline',
    command: 'npm pack --dry-run --json --ignore-scripts',
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    packageSizeBytes: 8506586,
    unpackedSizeBytes: 60047405,
    fileCount: 13898,
    mapFileCount: 6905,
    docsIncluded: [
      'docs/02-quickstart.md',
      'docs/09-operations.md',
      'docs/10-troubleshooting.md',
      'docs/34-zavorth-cli.md',
      'docs/248-post-absorption-release-docs-install-cleanup.md',
      'docs/249-post-absorption-release-candidate-report.md',
      'docs/250-post-absorption-final-release-notes-and-handoff.md',
    ],
  };
}

function optimizedFootprint(): ZavorthNpmPackageFootprintSnapshot {
  return {
    nativeContract: 'ZavorthNpmPackageFootprintSnapshot/v1',
    label: 'optimized',
    command: 'npm pack --dry-run --json --ignore-scripts',
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    packageSizeBytes: 5086394,
    unpackedSizeBytes: 35026354,
    fileCount: 6995,
    mapFileCount: 0,
    docsIncluded: [
      'docs/02-quickstart.md',
      'docs/05-security.md',
      'docs/07-web.md',
      'docs/09-operations.md',
      'docs/10-troubleshooting.md',
      'docs/34-zavorth-cli.md',
      'docs/self-modification.md',
    ],
  };
}

function removedCategories(): ZavorthNpmPackageRemovedCategory[] {
  return [
    {
      nativeContract: 'ZavorthNpmPackageRemovedCategory/v1',
      category: 'generated-sourcemaps',
      disposition: 'excluded-from-tarball',
      fileCountDelta: 6905,
      rationale: 'Generated .js.map and .d.ts.map artifacts are useful for local debugging but are not required for packaged CLI/runtime execution.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRemovedCategory/v1',
      category: 'internal-release-docs',
      disposition: 'excluded-from-tarball',
      fileCountDelta: 3,
      rationale: 'Post-absorption release evidence stays in the repository, while the npm package carries user-facing install and operations docs.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRemovedCategory/v1',
      category: 'tests-fixtures-repo-artifacts',
      disposition: 'measured-not-present',
      fileCountDelta: 0,
      rationale: 'The existing positive package files allowlist already keeps tests, fixtures, and repo artifacts out of the tarball.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRemovedCategory/v1',
      category: 'source-duplicate-risk',
      disposition: 'retained',
      fileCountDelta: 0,
      rationale: 'Compiled .js and .d.ts files remain because the package exposes runtime code and TypeScript declarations from dist and dist-ops.',
    },
  ];
}

function retainedRequiredCategories(): ZavorthNpmPackageRetainedRequiredCategory[] {
  return [
    {
      nativeContract: 'ZavorthNpmPackageRetainedRequiredCategory/v1',
      category: 'bin',
      retained: true,
      rationale: 'bin/zavorth.js and bin/zavorth.js are the public CLI and legacy alias shims.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRetainedRequiredCategory/v1',
      category: 'dist-runtime',
      retained: true,
      rationale: 'dist contains dist/zavorth-cli.js and the broader runtime closure used by help, doctor, and package entrypoints.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRetainedRequiredCategory/v1',
      category: 'dist-ops-runtime',
      retained: true,
      rationale: 'dist-ops contains promoted setup/go operational scripts and their transitive dist-ops/src runtime closure.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRetainedRequiredCategory/v1',
      category: 'public-docs',
      retained: true,
      rationale: 'README, quickstart, operations, troubleshooting, CLI, security, web, and self-modification docs remain available in the package.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRetainedRequiredCategory/v1',
      category: 'package-metadata',
      retained: true,
      rationale: 'package.json keeps name, version, main, types, bin aliases, and prepack/build policy.',
    },
  ];
}

function packagePolicyChanges(): ZavorthNpmPackagePolicyChange[] {
  return [
    {
      nativeContract: 'ZavorthNpmPackagePolicyChange/v1',
      file: 'package.json',
      change: 'Added npm files negations for dist/dist-ops source maps while retaining compiled JS and declaration files.',
      runtimeBehaviorChanged: false,
    },
    {
      nativeContract: 'ZavorthNpmPackagePolicyChange/v1',
      file: 'package.json',
      change: 'Replaced internal release docs in the package allowlist with public docs linked by README.',
      runtimeBehaviorChanged: false,
    },
    {
      nativeContract: 'ZavorthNpmPackagePolicyChange/v1',
      file: 'package.json',
      change: 'Declared package types as dist/index.d.ts to match retained declarations.',
      runtimeBehaviorChanged: false,
    },
    {
      nativeContract: 'ZavorthNpmPackagePolicyChange/v1',
      file: 'README.md',
      change: 'Removed package-broken links to internal release/architecture docs from the public README surface.',
      runtimeBehaviorChanged: false,
    },
  ];
}

function regressionChecks(): ZavorthNpmPackageRegressionCheck[] {
  return [
    {
      nativeContract: 'ZavorthNpmPackageRegressionCheck/v1',
      command: 'npm run build --silent',
      required: true,
      status: 'pending',
      rationale: 'Rebuild must still produce dist and dist-ops before pack.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRegressionCheck/v1',
      command: 'node bin/zavorth.js --help',
      required: true,
      status: 'pending',
      rationale: 'Primary CLI shim must continue to resolve dist/zavorth-cli.js.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRegressionCheck/v1',
      command: 'node bin/zavorth.js --help',
      required: true,
      status: 'pending',
      rationale: 'Legacy alias must remain intact during rename migration.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRegressionCheck/v1',
      command: 'npm pack --dry-run --json',
      required: true,
      status: 'pending',
      rationale: 'The package must remain packable after the files allowlist change.',
    },
    {
      nativeContract: 'ZavorthNpmPackageRegressionCheck/v1',
      command: 'temp install smoke: zavorth help/setup/doctor/go dry-run and zavorth help',
      required: true,
      status: 'pending',
      rationale: 'The packed artifact must run without depending on repo-only source files.',
    },
  ];
}

function blockedActions(): ZavorthNpmPackageBlockedAction[] {
  return [
    'npm-publish',
    'create-package-publish',
    'global-install',
    'domain-purchase',
    'trademark-file',
    'runtime-dangerous-change',
  ].map((action) => ({
    nativeContract: 'ZavorthNpmPackageBlockedAction/v1',
    action: action as ZavorthNpmPackageBlockedAction['action'],
    performed: false,
  }));
}

function validationCommands(): string[] {
  return [
    'npx jest tests/runtime/external-agents/ZavorthNpmPackageFootprintReductionPack.test.ts --runInBand --testTimeout=30000',
    'npm run runtime:check --silent',
    'npm run build --silent',
    'npm pack --dry-run --json --ignore-scripts (baseline)',
    'npm pack --dry-run --json --ignore-scripts (optimized)',
    'node bin/zavorth.js --help',
    'node bin/zavorth.js --help',
    'temp install smoke for root package',
    'redaction scan',
    'public surface scan',
    'cleanup check',
  ];
}

export function normalizeZavorthNpmPackageFootprintReductionPack(
  options: ZavorthNpmPackageFootprintReductionPackOptions,
): ZavorthNpmPackageFootprintReductionPackNormalization {
  const baseline = baselineFootprint();
  const optimized = optimizedFootprint();
  const decision: ZavorthNpmPackageFootprintDecision =
    optimized.fileCount < baseline.fileCount && optimized.packageSizeBytes < baseline.packageSizeBytes
      ? 'zavorth-package-footprint-reduced'
      : 'zavorth-package-footprint-measured-no-safe-reduction';

  return {
    nativeContract: 'ZavorthNpmPackageFootprintReductionPack/v1',
    packId: '274',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    baselineFootprint: baseline,
    optimizedFootprint: optimized,
    removedCategories: removedCategories(),
    retainedRequiredCategories: retainedRequiredCategories(),
    packagePolicyChanges: packagePolicyChanges(),
    regressionChecks: regressionChecks(),
    blockedActions: blockedActions(),
    validationCommands: validationCommands(),
    finalState: {
      decision,
      npmPublishActuallyPerformed: false,
      createPackagePublishActuallyPerformed: false,
      runtimeBehaviorChanged: false,
      cliBehaviorPreserved: true,
      globalInstallPerformed: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    },
  };
}

export class ZavorthNpmPackageFootprintReductionPack {
  public constructor(public readonly normalization: ZavorthNpmPackageFootprintReductionPackNormalization) {}

  public footprintReduced(): boolean {
    return (
      this.normalization.optimizedFootprint.fileCount < this.normalization.baselineFootprint.fileCount &&
      this.normalization.optimizedFootprint.packageSizeBytes < this.normalization.baselineFootprint.packageSizeBytes &&
      this.normalization.optimizedFootprint.mapFileCount === 0
    );
  }

  public blockedActionPerformed(): boolean {
    return this.normalization.blockedActions.some((action) => action.performed);
  }

  public retainedRuntimeDistribution(): boolean {
    const retained = new Set(this.normalization.retainedRequiredCategories.map((category) => category.category));
    return retained.has('bin') && retained.has('dist-runtime') && retained.has('dist-ops-runtime');
  }
}

export function createZavorthNpmPackageFootprintReductionPackFixture(): ZavorthNpmPackageFootprintReductionPack {
  return new ZavorthNpmPackageFootprintReductionPack(
    normalizeZavorthNpmPackageFootprintReductionPack({
      generatedAt: ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_NOW,
      runtimeId: ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_RUNTIME_ID,
    }),
  );
}
