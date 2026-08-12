import type { ZavorthPluginCapabilityBinding, ZavorthPluginManifest } from '../../contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../contracts/PluginManifestContract.js';
import {
  ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS,
  type ZavorthPluginRuntimeHookEvent,
} from '../../contracts/core/PluginRuntimeContract.js';
import type { DefinedPlugin } from './definePlugin.js';
import { isDefinedPlugin } from './definePlugin.js';
import { resolvePluginPermissions } from './permissionPresets.js';

export type ManifestInferenceResult = {
  ok: boolean;
  source: 'defined-plugin' | 'source-scan' | 'existing-manifest' | 'none';
  manifest: ZavorthPluginManifest | null;
  findings: string[];
  inferredCapabilityIds: string[];
  inferredHookEvents: string[];
};

export function inferManifestFromDefinedPlugin(
  defined: DefinedPlugin,
): ManifestInferenceResult {
  if (!isDefinedPlugin(defined)) {
    return {
      ok: false,
      source: 'none',
      manifest: null,
      findings: ['value is not a DefinedPlugin'],
      inferredCapabilityIds: [],
      inferredHookEvents: [],
    };
  }

  const capabilityIds = (defined.manifest.capabilities || [])
    .map((capability) => String(capability.id || '').trim())
    .filter(Boolean);
  const hookEvents = extractHookEventsFromInput(defined);

  return {
    ok: capabilityIds.length > 0,
    source: 'defined-plugin',
    manifest: defined.manifest,
    findings: capabilityIds.length > 0
      ? [`inferred ${capabilityIds.length} capability(ies) from definePlugin`]
      : ['defined plugin has no capabilities'],
    inferredCapabilityIds: capabilityIds,
    inferredHookEvents: hookEvents,
  };
}

export function inferManifestFromSource(
  sourceText: string,
  fallbackId: string,
): ManifestInferenceResult {
  const text = String(sourceText || '');
  const findings: string[] = [];
  const capabilityIds = unique([
    ...matchQuotedCalls(text, 'bindCapability'),
    ...matchQuotedCalls(text, 'bindTool'),
    ...extractToolKeysFromDefinePlugin(text),
    ...extractCapabilityIdsFromDefinePlugin(text),
  ]);
  const hookEvents = unique([
    ...matchQuotedCalls(text, 'registerHook'),
    ...extractHookEventsFromDefinePlugin(text),
  ]).filter((event) => (
    (ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS as readonly string[]).includes(event)
  ));

  const definePluginId = extractDefinePluginId(text) || normalizeFallbackId(fallbackId);
  if (!definePluginId) {
    findings.push('unable to resolve plugin id from source');
  }
  if (capabilityIds.length === 0) {
    findings.push('no bindCapability/bindTool/definePlugin tools found in source');
  } else {
    findings.push(`source-scan found capabilities: ${capabilityIds.join(', ')}`);
  }
  if (hookEvents.length > 0) {
    findings.push(`source-scan found hooks: ${hookEvents.join(', ')}`);
  }

  if (!definePluginId && capabilityIds.length === 0) {
    return {
      ok: false,
      source: 'none',
      manifest: null,
      findings,
      inferredCapabilityIds: [],
      inferredHookEvents: hookEvents,
    };
  }

  const id = definePluginId || 'inferred-plugin';
  const moduleKind = extractModuleKind(text) || 'tool';
  const permissions = resolvePluginPermissions({
    moduleKind,
    permissions: 'auto',
  });
  const capabilities = capabilityIds.length > 0
    ? capabilityIds.map((capabilityId) => stubCapability(capabilityId, moduleKind))
    : [stubCapability('main.run', moduleKind)];

  const manifest: ZavorthPluginManifest = {
    schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    id,
    label: id,
    version: '0.1.0',
    moduleKind,
    summary: `${id} inferred from source scan`,
    description: `Lightweight source-scan inference for ${id}.`,
    tags: [moduleKind, 'inferred'],
    source: {
      kind: 'local',
      locator: `local://${id}`,
      digest: null,
      trusted: false,
    },
    compatibility: {
      zavorthVersion: '>=1.1.0',
      pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    },
    capabilities,
    permissions,
    entrypoint: {
      module: './index.js',
      exportName: 'register',
      runtime: 'node',
    },
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
      defaultAction: 'invoke',
    },
    policy: {
      defaultTrust: 'review',
      requiresApproval: permissions.some((permission) => permission.required),
      allowNetworkByDefault: false,
      allowFilesystemWriteByDefault: false,
      allowProcessSpawnByDefault: false,
      sandboxProfile: permissions.some((permission) => permission.kind === 'network.external') ? 'networked'
        : 'restricted',
    },
    artifactKinds: [],
    receiptKinds: [`${id}.receipt`],
  };

  return {
    ok: true,
    source: 'source-scan',
    manifest,
    findings,
    inferredCapabilityIds: capabilities.map((capability) => capability.id),
    inferredHookEvents: hookEvents,
  };
}

export function reconcileManifestWithInference(
  existing: ZavorthPluginManifest | null,
  inferred: ManifestInferenceResult,
  options?: { writeMode?: 'merge-dev' | 'strict' },
): {
  manifest: ZavorthPluginManifest | null;
  findings: string[];
  drift: string[];
} {
  const writeMode = options?.writeMode || 'merge-dev';
  const findings = [...(inferred.findings || [])];
  const drift: string[] = [];

  if (!existing && !inferred.manifest) {
    return {
      manifest: null,
      findings: [...findings, 'no existing or inferred manifest available'],
      drift,
    };
  }

  if (!existing) {
    return {
      manifest: inferred.manifest,
      findings: [...findings, 'using fully inferred manifest'],
      drift,
    };
  }

  const existingCapabilityIds = new Set(
    (existing.capabilities || []).map((capability) => String(capability.id || '').trim()).filter(Boolean),
  );
  const inferredCapabilityIds = inferred.inferredCapabilityIds || [];
  const missingCapabilities = inferredCapabilityIds.filter((id) => !existingCapabilityIds.has(id));
  const extraCapabilities = Array.from(existingCapabilityIds).filter(
    (id) => inferredCapabilityIds.length > 0 && !inferredCapabilityIds.includes(id),
  );

  for (const id of missingCapabilities) {
    const message = `capability referenced in code but missing from manifest: ${id}`;
    if (writeMode === 'strict') {
      drift.push(message);
    } else {
      findings.push(message);
    }
  }
  for (const id of extraCapabilities) {
    findings.push(`manifest capability not observed in inference: ${id}`);
  }

  if (writeMode === 'strict') {
    return {
      manifest: existing,
      findings,
      drift,
    };
  }

  const moduleKind = existing.moduleKind || inferred.manifest?.moduleKind || 'tool';
  const mergedCapabilities = [...(existing.capabilities || [])];
  for (const id of missingCapabilities) {
    mergedCapabilities.push(stubCapability(id, moduleKind));
  }

  const tags = unique([
    ...(existing.tags || []),
    ...(inferred.inferredHookEvents.length > 0 ? ['hooks'] : []),
    ...(missingCapabilities.length > 0 ? ['inferred-capabilities'] : []),
  ]);

  return {
    manifest: {
      ...existing,
      capabilities: mergedCapabilities,
      tags,
    },
    findings,
    drift,
  };
}

function extractHookEventsFromInput(defined: DefinedPlugin): string[] {
  const hooks = defined.input?.hooks;
  if (!hooks) {
    return [];
  }
  if (Array.isArray(hooks)) {
    return unique(hooks.map((entry) => String(entry.event || '').trim()).filter(Boolean));
  }
  return unique(Object.keys(hooks).map((event) => String(event || '').trim()).filter(Boolean));
}

function matchQuotedCalls(source: string, fnName: string): string[] {
  const pattern = new RegExp(
    `\\b${escapeRegExp(fnName)}\\s*\\(\\s*['"]([^'"]+)['"]`,
    'g',
  );
  const matches: string[] = [];
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match) {
    if (match[1]) {
      matches.push(match[1]);
    }
    match = pattern.exec(source);
  }
  return matches;
}

function extractToolKeysFromDefinePlugin(source: string): string[] {
  const startMatch = source.match(/\btools\s*:\s*\{/u);
  if (!startMatch || startMatch.index === undefined) {
    return [];
  }
  const openIndex = startMatch.index + startMatch[0].length - 1;
  const block = extractBalancedObject(source, openIndex);
  if (!block) {
    return [];
  }
  const keys: string[] = [];
  const keyPattern = /(?:^|[,{])\s*['"]([a-zA-Z0-9_.-]+)['"]\s*:/gu;
  let match: RegExpExecArray | null = keyPattern.exec(block);
  while (match) {
    const key = match[1];
    if (key && !['handler', 'name', 'description', 'label', 'intent', 'summary', 'output', 'artifacts', 'receipts'].includes(key)) {
      keys.push(key);
    }
    match = keyPattern.exec(block);
  }
  return keys;
}

function extractBalancedObject(source: string, openBraceIndex: number): string | null {
  if (source[openBraceIndex] !== '{') {
    return null;
  }
  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex + 1, index);
      }
    }
  }
  return null;
}

function extractCapabilityIdsFromDefinePlugin(source: string): string[] {
  const capabilitiesBlock = source.match(/capabilities\s*:\s*\[([\s\S]*?)\]/u);
  if (!capabilitiesBlock) {
    return [];
  }
  const ids: string[] = [];
  const stringIds = capabilitiesBlock[1].matchAll(/['"]([^'"]+)['"]/gu);
  for (const match of stringIds) {
    ids.push(match[1]);
  }
  const objectIds = capabilitiesBlock[1].matchAll(/id\s*:\s*['"]([^'"]+)['"]/gu);
  for (const match of objectIds) {
    ids.push(match[1]);
  }
  return ids;
}

function extractHookEventsFromDefinePlugin(source: string): string[] {
  const hooksBlock = source.match(/hooks\s*:\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/u);
  if (!hooksBlock) {
    return [];
  }
  const body = hooksBlock[1];
  const events: string[] = [];
  for (const event of ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS) {
    if (body.includes(`'${event}'`) || body.includes(`"${event}"`) || body.includes(event)) {
      if (body.includes(event)) {
        events.push(event);
      }
    }
  }
  const quoted = body.matchAll(/['"]([a-z]+\.[a-z_]+)['"]/gu);
  for (const match of quoted) {
    if ((ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS as readonly string[]).includes(match[1])) {
      events.push(match[1]);
    }
  }
  return unique(events);
}

function extractDefinePluginId(source: string): string | null {
  const match = source.match(/definePlugin\s*\(\s*\{[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/u);
  return match?.[1] ? normalizeFallbackId(match[1]) : null;
}

function extractModuleKind(source: string): ZavorthPluginManifest['moduleKind'] | null {
  const match = source.match(/\b(?:kind|moduleKind)\s*:\s*['"]([a-z]+)['"]/u);
  if (!match?.[1]) {
    return null;
  }
  const kind = match[1];
  const allowed = new Set([
    'agent', 'provider', 'channel', 'sandbox', 'tool', 'media', 'voice',
    'search', 'memory', 'diagnostics', 'qa', 'bridge', 'workspace', 'module',
  ]);
  return allowed.has(kind) ? kind as ZavorthPluginManifest['moduleKind'] : null;
}

function stubCapability(
  id: string,
  moduleKind: ZavorthPluginManifest['moduleKind'],
): ZavorthPluginCapabilityBinding {
  return {
    id,
    intent: `${moduleKind}.${id}`,
    label: id,
    summary: `Inferred capability ${id}.`,
    artifactKinds: [],
    command: {
      name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
      aliases: [],
      usage: null,
    },
  };
}

function normalizeFallbackId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}

export type { ZavorthPluginRuntimeHookEvent };
