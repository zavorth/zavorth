export const ZAVORTH_MODULE_SDK_EXPORT_CONTRACT_VERSION = '2026-05-04.worker-4' as const;

export type ModuleSdkExportStatus =
  | 'closed'
  | 'attention';

export type ModuleSdkExportDecision =
  | 'zavorth-native-sdk'
  | 'not-source-compatible-shim';

export type ModuleSdkSurfaceId =
  | 'sdk-root'
  | 'module-authoring'
  | 'contracts'
  | 'plugin-os'
  | 'capabilities'
  | 'codex-runtime'
  | 'openshell-sandbox'
  | 'version';

export type ModuleSdkSurfaceStatus =
  | 'exported'
  | 'missing';

export type ModuleSdkPackageExport = {
  subpath: string;
  types: string;
  default: string;
  status: ModuleSdkSurfaceStatus;
};

export type ModuleSdkSurface = {
  id: ModuleSdkSurfaceId;
  label: string;
  status: ModuleSdkSurfaceStatus;
  sourceFile: string;
  distTypes: string;
  distDefault: string;
  exports: string[];
  replacesSourceCategory: string;
  decision: ModuleSdkExportDecision;
};

export type ModuleSdkCompatibilityPosition = {
  source: 'source';
  sourcePackageExportsApprox: number;
  sourcePluginSdkEntrypointsApprox: number;
  zavorthPublicSubpaths: number;
  decision: ModuleSdkExportDecision;
  reason: string;
  compatibilityShimProvided: false;
  sourceImportPathsSupported: false;
};

export type ModuleSdkExportSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_MODULE_SDK_EXPORT_CONTRACT_VERSION;
  status: ModuleSdkExportStatus;
  summary: {
    publicSubpaths: number;
    exportedSurfaces: number;
    missingSurfaces: number;
    packageExports: number;
    sourcePackageExportsApprox: number;
    sourcePluginSdkEntrypointsApprox: number;
    compatibilityShimProvided: false;
    sourceImportPathsSupported: false;
    secretValuesSerialized: false;
  };
  compatibility: ModuleSdkCompatibilityPosition;
  packageExports: ModuleSdkPackageExport[];
  surfaces: ModuleSdkSurface[];
  policy: {
    noSourceImportPaths: true;
    noSourceSdkShim: true;
    stableZavorthSubpaths: true;
    contractFirstApi: true;
    artifactFirstRuntime: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run module-sdk-export:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextWorker: 'Worker 5 - provider/channel live smoke proof';
  };
};
