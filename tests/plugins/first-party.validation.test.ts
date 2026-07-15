import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import type { ZavorthDiscoveredPlugin } from '../../src/contracts/core/PluginRuntimeContract.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { PluginLoadService } from '../../src/services/PluginLoadService.js';

const PLUGINS_ROOT = path.resolve(__dirname, '../../plugins');
const requireFromTest = createRequire(__filename);

const FIRST_PARTY = [
 'web-search',
 'github',
 'memory-local',
 'memory-honcho',
 'cost-tracker',
 'browser-playwright',
 'security-guidance',
 'plugin-router-ai',
 'session-scratch-janitor',
 'selfmod-plugin-forge',
 'mcp-bridge',
 'gmail',
 'calendar',
 'linear',
 'notion',
 // Daily Ops pack
 'workspace-doctor',
 'task-board',
 'pr-ship',
 'ci-watch',
 'secrets-guardian',
 'session-recall',
 'notify-outbox',
 // Provider pack
 'provider-openai-compatible',
 'provider-anthropic',
 'provider-xai',
 'provider-gemini',
 'provider-status',
 // Expanded first-party providers
 'provider-openai',
 'provider-groq',
 'provider-deepseek',
 'provider-openrouter',
 'provider-ollama',
 'provider-together',
 'provider-mistral',
 'provider-cerebras',
 'provider-qwen',
 'provider-local-llama',
 // Platform pack
 'platform-telegram',
 'platform-discord',
 'platform-whatsapp',
 'platform-webhook',
 // Memory pack
 'memory-file-journal',
 'memory-vector-local',
 'memory-mem0',
 // Media pack
 'media-image-gen',
 'media-vision',
 'media-tts',
 'media-transcription',
 'media-video-gen',
 // browser & search pack
 'browser-cdp',
 'search-exa',
 'search-firecrawl',
 // trust fabric
 'secret-source-env',
 'secret-source-file',
 'dashboard-auth-basic',
 'dashboard-auth-token',
 'context-engine-bridge',
 'middleware-rate-limit',
 // lifestyle & demos
 'spotify-soft',
 'demo-showcase',
];

function asDiscovered(id: string, packageDir: string, manifest: ZavorthPluginManifest): ZavorthDiscoveredPlugin {
 return {
 pluginId: id,
 sourceKind: 'bundled',
 sourceRoot: PLUGINS_ROOT,
 packageDir,
 manifestPath: path.join(packageDir, 'manifest.json'),
 manifestFilename: 'manifest.json',
 manifest,
 validation: { ok: true, findings: [] },
 compatibility: { ok: true, findings: [] },
 state: {
 runtimeState: 'enabled',
 trust: 'trusted',
 installed: true,
 enabled: true,
 installedRevision: manifest.version || '1.0.0',
 sourceLocator: `bundled://${id}`,
 },
 loadEligible: true,
 selected: true,
 findings: [],
 };
}

describe('first-party Plugin OS packages', () => {
 it('ships manifest.json + index.js + README.md for each package', () => {
 for (const id of FIRST_PARTY) {
 const dir = path.join(PLUGINS_ROOT, id);
 expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(true);
 expect(fs.existsSync(path.join(dir, 'index.js'))).toBe(true);
 expect(fs.existsSync(path.join(dir, 'README.md'))).toBe(true);
 }
 });

 it('validates every first-party manifest', () => {
 const registry = new PluginRegistryService();
 for (const id of FIRST_PARTY) {
 const manifestPath = path.join(PLUGINS_ROOT, id, 'manifest.json');
 const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
 const findings = registry.validateManifest(manifest);
 expect({ id, findings }).toEqual({ id, findings: [] });
 }
 });

 it('exports register and loads via PluginLoadService require import', async () => {
 for (const id of FIRST_PARTY) {
 const dir = path.join(PLUGINS_ROOT, id);
 const indexPath = path.join(dir, 'index.js');
 // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
 const mod = require(indexPath);
 expect(typeof mod.register).toBe('function');

 const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as ZavorthPluginManifest;
 const loader = new PluginLoadService({
 workspacePath: path.resolve(__dirname, '../..'),
 importModule: async (modulePath: string) => requireFromTest(modulePath),
 });
 const result = await loader.loadOne(asDiscovered(id, dir, manifest), { approved: true });
 expect({ id, status: result.status, findings: result.findings }).toEqual({
 id,
 status: 'loaded',
 findings: result.findings,
 });
 expect(result.status).toBe('loaded');
 expect(result.capabilities.length).toBeGreaterThan(0);
 }
 });
});
