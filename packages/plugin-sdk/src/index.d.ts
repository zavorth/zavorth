export type DefinePluginToolSpec = ((...args: any[]) => any) | {
  handler: (...args: any[]) => any;
  name?: string;
  description?: string;
  label?: string;
  intent?: string;
  summary?: string;
};

export type DefinePluginInput = {
  id: string;
  label?: string;
  version?: string;
  kind?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  capabilities?: Array<string | ({ id: string } & Record<string, unknown>)>;
  tools?: Record<string, DefinePluginToolSpec>;
  hooks?: Record<string, (...args: any[]) => any> | Array<{ event: string; handler: (...args: any[]) => any }>;
  permissions?: Array<Record<string, unknown>> | 'auto';
  policy?: Record<string, unknown>;
  entrypoint?: { module?: string; exportName?: string; runtime?: string };
  setup?: (ctx: any) => void | Promise<void>;
  zavorthVersion?: string;
};

export type DefinedPlugin = {
  kind: 'zavorth.defined-plugin';
  manifest: any;
  register: (ctx: any) => void | Promise<void>;
  input: DefinePluginInput;
};

export type ManifestInferenceResult = {
  ok: boolean;
  source: 'defined-plugin' | 'source-scan' | 'existing-manifest' | 'none';
  manifest: any | null;
  findings: string[];
  inferredCapabilityIds: string[];
  inferredHookEvents: string[];
};

export function definePlugin(input: DefinePluginInput): DefinedPlugin;
export function isDefinedPlugin(value: unknown): value is DefinedPlugin;
export function toPluginRegisterExport(defined: DefinedPlugin): {
  register: (ctx: any) => void | Promise<void>;
  manifest: any;
};

export function permissionPresetForModuleKind(kind: string): Array<Record<string, unknown>>;
export function resolvePluginPermissions(input: {
  moduleKind: string;
  permissions?: Array<Record<string, unknown>> | 'auto' | null;
  extra?: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>>;

export function inferManifestFromDefinedPlugin(defined: DefinedPlugin): ManifestInferenceResult;
export function inferManifestFromSource(sourceText: string, fallbackId: string): ManifestInferenceResult;
export function reconcileManifestWithInference(
  existing: any | null,
  inferred: ManifestInferenceResult,
  options?: { writeMode?: 'merge-dev' | 'strict' },
): { manifest: any | null; findings: string[]; drift: string[] };
