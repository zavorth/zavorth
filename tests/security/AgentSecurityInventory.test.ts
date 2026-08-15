import fs from 'fs';
import path from 'path';
import { NODE_HOST_SUPPORTED_CAPABILITY_IDS } from '../../src/domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityCatalog';

import {
  BOOTSTRAP_NATIVE_TOOL_SECURITY_MANIFEST,
  findMissingExplicitNativeToolSecurityDefinitions,
  listExplicitNativeToolSecurityNames,
  NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS,
} from '../../src/security/AgentToolSecurityCatalog';
import {
  buildAgentSecurityInventory,
  NODE_HOST_CAPABILITY_SECURITY_INVENTORY,
  validateAgentSecurityInventory,
} from '../../src/security/AgentSecurityInventory';

const ROOT = path.resolve(__dirname, '..', '..');

function readBootstrapToolRuntime(): string {
  return fs.readFileSync(path.join(ROOT, 'src/bootstrap/bootstrapToolRuntime.ts'), 'utf8');
}

function parseBootstrapRegisteredConstructors(source: string): string[] {
  return Array.from(source.matchAll(/toolRegistry\.register\(new\s+([A-Za-z0-9_]+)/g))
    .map((match) => match[1])
    .sort();
}

describe('Agent security inventory gate', () => {
  it('keeps the central inventory complete and explicit', () => {
    const inventory = buildAgentSecurityInventory();
    const findings = validateAgentSecurityInventory(inventory);

    expect(findings).toEqual([]);
    expect(inventory.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'web_search',
      'remote_shell',
      'desktop_automation',
      'mcp.dynamic_tools',
      'skills.imported_library',
      'webhooks.dispatch',
      'admin.api',
      'mitm.zavorthBridge',
      'system.run',
      'browser.proxy',
    ]));
    expect(inventory.find((entry) => entry.id === 'remote_shell')).toEqual(expect.objectContaining({
      canExecuteCode: true,
      canMutateHost: true,
      defaultRisk: 'dangerous',
      requiresConfirmation: true,
    }));
    expect(inventory.find((entry) => entry.id === 'webhooks.dispatch')).toEqual(expect.objectContaining({
      canExfiltrateData: true,
      defaultRisk: 'dangerous',
    }));
  });

  it('requires every bootstrap native tool constructor to have an explicit catalog entry', () => {
    const registeredConstructors = parseBootstrapRegisteredConstructors(readBootstrapToolRuntime());
    const manifestByClass = new Map(
      BOOTSTRAP_NATIVE_TOOL_SECURITY_MANIFEST.map((entry) => [entry.className, entry.toolName]),
    );
    const missingManifest = registeredConstructors.filter((className) => !manifestByClass.has(className));
    const toolNames = registeredConstructors.map((className) => manifestByClass.get(className) || '');

    expect(missingManifest).toEqual([]);
    expect(findMissingExplicitNativeToolSecurityDefinitions(toolNames)).toEqual([]);
  });

  it('keeps native tool definitions unique and non-fallback', () => {
    const names = NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS.map((definition) => definition.toolName.toLowerCase());
    expect(names).toHaveLength(new Set(names).size);
    expect(listExplicitNativeToolSecurityNames()).toEqual([...new Set(names)].sort());
    expect(NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS.map((definition) => definition.source || 'explicit'))
      .not.toContain('fallback');
  });

  it('requires every supported node-host capability to be classified', () => {
    const classified = new Set(NODE_HOST_CAPABILITY_SECURITY_INVENTORY.map((entry) => entry.id));
    const missing = NODE_HOST_SUPPORTED_CAPABILITY_IDS.filter((capabilityId) => !classified.has(capabilityId));

    expect(missing).toEqual([]);
    for (const entry of NODE_HOST_CAPABILITY_SECURITY_INVENTORY) {
      expect(entry.source).toBe('explicit');
      expect(entry.capabilities.length).toBeGreaterThan(0);
      expect(entry.description).toEqual(expect.any(String));
      if (entry.defaultRisk !== 'safe') {
        expect(entry.requiresConfirmation).toBe(true);
      }
    }
  });
});
