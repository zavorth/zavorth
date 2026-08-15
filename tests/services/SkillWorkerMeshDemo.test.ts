/**
 * hermetic demo journeys J1 (skill) + J2 (worker).
 * Acts as both automated QA and the "5 minute demo" script core.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillInstallPipelineService } from '../../src/services/SkillInstallPipelineService.js';
import { WorkerMeshService } from '../../src/services/WorkerMeshService.js';
import { WorkerDelegationRouterService } from '../../src/services/WorkerDelegationRouterService.js';
import { SkillWorkerDiscoveryService } from '../../src/services/SkillWorkerDiscoveryService.js';
import { ZavorthExternalAgentGatewayService } from '../../src/services/ZavorthExternalAgentGatewayService.js';
import { bindSkillDeclaredTools } from '../../src/services/SkillExecutorBindingService.js';
import { isDailyOpsPreferredTool } from '../../src/runtime/agent/tools/ToolExposureProfile.js';
import { formatAgentToolModelGuidance } from '../../src/services/AgentToolModelGuidance.js';
import { formatCredentialReadinessBlock } from '../../src/services/AgentHarnessCredentialHints.js';


describe('SkillWorkerMeshDemo J1+J2', () => {
 let tempRoot: string;
 let projectRoot: string;

 beforeEach(() => {
 tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mesh-demo-'));
 projectRoot = path.join(tempRoot, 'project');
 fs.mkdirSync(path.join(projectRoot, 'skills'), { recursive: true });
 fs.mkdirSync(path.join(projectRoot, 'data', 'runtime'), { recursive: true });
 });

 afterEach(() => {
 try {
 fs.rmSync(tempRoot, { recursive: true, force: true });
 } catch {
 /* ignore */
 }
 });

 it('J1: discover → preview → consent install → executor bind', async () => {
 const skillDir = path.join(tempRoot, 'fixture-skill');
 fs.mkdirSync(skillDir, { recursive: true });
 fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Demo\nUse read_file.\n', 'utf8');
 fs.writeFileSync(
 path.join(skillDir, 'manifest.json'),
 JSON.stringify({
 name: 'demo-read-skill',
 version: '1.0.0',
 description: 'Demo skill for mesh',
 author: 'zavorth-test',
 category: 'other',
 tags: ['demo', 'read'],
 tools: [{ name: 'read_file', description: 'Read files' }],
 }),
 'utf8',
 );

 // Also place under workspace skills for discovery
 const ws = path.join(projectRoot, 'skills', 'demo-read-skill');
 fs.cpSync(skillDir, ws, { recursive: true });

 const discovery = new SkillWorkerDiscoveryService({
 projectRoot,
 skillsDir: path.join(projectRoot, 'skills'),
 remoteSearch: async () => [],
 });
 const found = await discovery.discover({ query: 'demo read', remote: false });
 expect(found.skills.some((s) => s.name.includes('demo') || s.id.includes('demo'))).toBe(true);

 const pipeline = new SkillInstallPipelineService({
 projectRoot,
 receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
 now: () => new Date('2026-07-13T22:00:00.000Z'),
 });
 const plan = pipeline.preview({ source: skillDir });
 expect(plan.previewOnly).toBe(true);
 expect(plan.declaredTools.some((t) => t.name === 'read_file')).toBe(true);

 const prev = path.resolve(__dirname, '../../');
 process.chdir(projectRoot);
 try {
 const receipt = await pipeline.apply({ source: skillDir, consent: true });
 expect(['applied', 'partial']).toContain(receipt.status);
 expect(receipt.materialized).toBe(true);
 const bind = receipt.toolBinds.find((b) => b.declaredName === 'read_file');
 expect(bind?.status).toBe('direct');
 expect(bind?.resolvedName).toBe('read_file');
 // Receipt must not contain obvious secrets
 expect(JSON.stringify(receipt)).not.toMatch(/api_key\s*=\s*\w{12}/i);
 } finally {
 process.chdir(prev);
 }

 const binds = bindSkillDeclaredTools(['read_file', 'sandbox_execution', 'nope_tool']);
 expect(binds.direct).toContain('read_file');
 expect(binds.aliased.some((a) => a.includes('run_sandbox_code'))).toBe(true);
 expect(binds.resolvedToolNames).not.toContain('nope_tool');
 });

 it('J2: list workers → route → dry-run invoke + untrusted merge', async () => {
 const gateway = new ZavorthExternalAgentGatewayService({
 projectRoot,
 registryFile: path.join(projectRoot, 'data', 'runtime', 'external-agent-profiles.json'),
 now: () => new Date('2026-07-13T22:00:00.000Z'),
 });
 const mesh = new WorkerMeshService({
 projectRoot,
 gateway,
 receiptsDir: path.join(projectRoot, 'data', 'runtime', 'worker-mesh-receipts'),
 now: () => new Date('2026-07-13T22:00:00.000Z'),
 });
 const router = new WorkerDelegationRouterService({ mesh });

 const workers = mesh.listWorkers();
 expect(workers.some((w) => w.id === 'internal:leaf')).toBe(true);

 const reg = mesh.registerExternal({
 id: 'http-demo',
 label: 'HTTP worker',
 adapter: 'http',
 endpoint: 'http://127.0.0.1:9/health',
 approvalGranted: true,
 enableLive: true,
 requestedBy: 'w8-demo',
 });
 expect(reg.status).toBe('registered');

 // Structured preferLocalTools — free-text never keyword-selects local vs worker.
 const localRoute = router.route({
 task: 'Read the file package.json',
 availableLocalTools: ['read_file', 'list_directory'],
 workers: mesh.listWorkers(),
 preferLocalTools: true,
 risk: 'observation',
 });
 expect(localRoute.kind).toBe('local_tools');

 // Explicit workerId owns mesh routing (not free-text "research").
 const workerRoute = router.route({
 task: 'Delegate research about architecture',
 workers: mesh.listWorkers(),
 workerId: 'internal:researcher',
 risk: 'observation',
 });
 expect(workerRoute.kind).toBe('worker_dry_run');
 expect(workerRoute.suggestedWorkerId).toBe('internal:researcher');

 const receipt = await mesh.invoke({
 workerId: 'internal:researcher',
 prompt: 'Survey architecture (demo)',
 dryRun: true,
 approvalGranted: false,
 });
 expect(receipt.mode).toBe('dry-run');
 expect(receipt.workerId).toBe('internal:researcher');

 const merged = router.mergeWorkerResultIntoContext({
 workerId: receipt.workerId,
 receiptId: receipt.id,
 mode: receipt.mode,
 stdoutSummary: receipt.stdoutSummary,
 reason: receipt.reason,
 });
 expect(merged).toMatch(/untrusted_tool_output/);
 });

 it('product surface: daily-ops prefers mesh tools + guidance brand-safe', () => {
 // Bulk marketplace is deferred from lean daily-ops (reach via plugin_suggest / miss path).
 expect(isDailyOpsPreferredTool('zavorth_skill_marketplace')).toBe(false);
 expect(isDailyOpsPreferredTool('plugin_suggest')).toBe(true);
 expect(isDailyOpsPreferredTool('agent_manager')).toBe(true);
 const guidance = formatAgentToolModelGuidance();
 expect(guidance).toMatch(/plugin_suggest|zavorth_skill_marketplace|agent_manager/);
 expect(guidance).toMatch(/agent_manager/);
 const creds = formatCredentialReadinessBlock();
 expect(creds).not.toMatch(/sk-[a-z0-9]{10}/i);
 expect(creds).toMatch(/Skill trust profile|Tool exposure profile/i);
 });
});
