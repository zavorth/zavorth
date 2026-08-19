'use strict';

const { isDefinedPlugin } = require('./definePlugin.js');
const { resolvePluginPermissions } = require('./permissionPresets.js');

const HOOK_EVENTS = new Set([
  'plugin.load',
  'plugin.unload',
  'tool.before',
  'tool.after',
  'session.start',
  'session.end',
  'shutdown.before',
]);

function inferManifestFromDefinedPlugin(defined) {
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

function inferManifestFromSource(sourceText, fallbackId) {
  const text = String(sourceText || '');
  const findings = [];
  const capabilityIds = unique([
    ...matchQuotedCalls(text, 'bindCapability'),
    ...matchQuotedCalls(text, 'bindTool'),
    ...extractToolKeysFromDefinePlugin(text),
  ]);
  const hookEvents = unique([
    ...matchQuotedCalls(text, 'registerHook'),
  ]).filter((event) => HOOK_EVENTS.has(event));

  const definePluginId = extractDefinePluginId(text) || normalizeFallbackId(fallbackId);
  if (!definePluginId) findings.push('unable to resolve plugin id from source');
  if (capabilityIds.length === 0) {
    findings.push('no bindCapability/bindTool/definePlugin tools found in source');
  } else {
    findings.push(`source-scan found capabilities: ${capabilityIds.join(', ')}`);
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
  const permissions = resolvePluginPermissions({ moduleKind, permissions: 'auto' });
  const capabilities = (capabilityIds.length > 0 ? capabilityIds : ['main.run']).map((capabilityId) => ({
    id: capabilityId,
    intent: `${moduleKind}.${capabilityId}`,
    label: capabilityId,
    summary: `${capabilityId} capability.`,
    artifactKinds: [],
    command: {
      name: capabilityId.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
      aliases: [],
      usage: null,
    },
  }));

  const manifest = {
    schemaVersion: 'zavorth.plugin-os.v1',
    id,
    label: id,
    version: '0.1.0',
    moduleKind,
    summary: `${id} inferred from source scan`,
    description: `Lightweight source-scan inference for ${id}.`,
    tags: [moduleKind, 'inferred'],
    source: { kind: 'local', locator: `local://${id}`, digest: null, trusted: false },
    compatibility: { zavorthVersion: '>=1.1.0', pluginApiVersion: 'zavorth.plugin-os.v1' },
    capabilities,
    permissions,
    entrypoint: { module: './index.js', exportName: 'register', runtime: 'node' },
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

function reconcileManifestWithInference(existing, inferred, options) {
  const writeMode = (options && options.writeMode) || 'merge-dev';
  const findings = [...((inferred && inferred.findings) || [])];
  const drift = [];

  if (!existing && !(inferred && inferred.manifest)) {
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
  const inferredCapabilityIds = (inferred && inferred.inferredCapabilityIds) || [];
  const missingCapabilities = inferredCapabilityIds.filter((id) => !existingCapabilityIds.has(id));

  for (const id of missingCapabilities) {
    const message = `capability referenced in code but missing from manifest: ${id}`;
    if (writeMode === 'strict') drift.push(message);
    else findings.push(message);
  }

  if (writeMode === 'strict') {
    return { manifest: existing, findings, drift };
  }

  const moduleKind = existing.moduleKind || (inferred.manifest && inferred.manifest.moduleKind) || 'tool';
  const mergedCapabilities = [...(existing.capabilities || [])];
  for (const id of missingCapabilities) {
    mergedCapabilities.push({
      id,
      intent: `${moduleKind}.${id}`,
      label: id,
      summary: `${id} capability.`,
      artifactKinds: [],
      command: { name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(), aliases: [], usage: null },
    });
  }

  return {
    manifest: { ...existing, capabilities: mergedCapabilities },
    findings,
    drift,
  };
}

function extractHookEventsFromInput(defined) {
  const hooks = defined.input && defined.input.hooks;
  if (!hooks) return [];
  if (Array.isArray(hooks)) {
    return unique(hooks.map((entry) => String(entry.event || '').trim()).filter(Boolean));
  }
  return unique(Object.keys(hooks).map((event) => String(event || '').trim()).filter(Boolean));
}

function matchQuotedCalls(source, fnName) {
  const pattern = new RegExp(`\\b${escapeRegExp(fnName)}\\s*\\(\\s*['"]([^'"]+)['"]`, 'g');
  const matches = [];
  let match = pattern.exec(source);
  while (match) {
    if (match[1]) matches.push(match[1]);
    match = pattern.exec(source);
  }
  return matches;
}

function extractToolKeysFromDefinePlugin(source) {
  const startMatch = source.match(/\btools\s*:\s*\{/u);
  if (!startMatch || startMatch.index === undefined) return [];
  const openIndex = startMatch.index + startMatch[0].length - 1;
  const block = extractBalancedObject(source, openIndex);
  if (!block) return [];
  const keys = [];
  const keyPattern = /(?:^|[,{])\s*['"]([a-zA-Z0-9_.-]+)['"]\s*:/gu;
  let match = keyPattern.exec(block);
  while (match) {
    const key = match[1];
    if (key && !['handler', 'name', 'description', 'label', 'intent', 'summary', 'output', 'artifacts', 'receipts'].includes(key)) {
      keys.push(key);
    }
    match = keyPattern.exec(block);
  }
  return keys;
}

function extractBalancedObject(source, openBraceIndex) {
  if (source[openBraceIndex] !== '{') return null;
  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIndex, index + 1);
    }
  }
  return null;
}

function extractDefinePluginId(source) {
  const match = source.match(/\bdefinePlugin\s*\(\s*\{[\s\S]*...\bid\s*:\s*['"]([^'"]+)['"]/u);
  return match?.[1] ? normalizeFallbackId(match[1]) : null;
}

function extractModuleKind(source) {
  const match = source.match(/\bkind\s*:\s*['"]([a-zA-Z0-9_-]+)['"]/u);
  return match?.[1] ? String(match[1]).toLowerCase() : null;
}

function normalizeFallbackId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || null;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
};
