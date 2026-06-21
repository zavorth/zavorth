import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type {
  ZavorthActionDefinition,
  ZavorthActionHandlerInput,
  ZavorthActionModule,
  ZavorthActionResult,
  ZavorthActionSchema,
} from '../ZavorthActionContracts.js';
import { ZavorthHiddenCapabilitySpineService, type ZavorthParitySource } from '../../../services/ZavorthHiddenCapabilitySpineService.js';
import { UniversalSkillExpansionService } from '../../../services/UniversalSkillExpansionService.js';
import { ZavorthExternalAgentGatewayService } from '../../../services/ZavorthExternalAgentGatewayService.js';

const SURFACE: ZavorthActionDefinition['surface'] = ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'];
const TEST_REFS = [
  'tests/services/ZavorthHiddenCapabilitySpineService.test.ts',
  'tests/runtime/actions/ZavorthCapabilitySpineActions.test.ts',
];

const outputSchema: ZavorthActionSchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

function text(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

function block(input: ZavorthActionHandlerInput, summary: string, lines: string[] = [], data?: Record<string, unknown>): ZavorthActionResult {
  return result({
    ok: false,
    actionId: input.actionId,
    operation: input.operation,
    status: 'blocked',
    summary,
    lines: lines.length ? lines : [summary],
    data,
  });
}

function service(root: string): ZavorthHiddenCapabilitySpineService {
  return new ZavorthHiddenCapabilitySpineService({ projectRoot: root });
}

async function appendJsonArray(file: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(await fsp.readFile(file, 'utf8'));
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  items.push(value);
  await fsp.writeFile(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

function queueFile(root: string): string {
  return path.join(root, '.zavorth', 'capability-exposure-queue.json');
}

function hiddenScan(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = service(input.root).buildSnapshot();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${snapshot.summary.hidden} hidden, ${snapshot.summary.partial} partial and ${snapshot.summary.exposed} exposed capability family/families.`,
    lines: snapshot.candidates.map((candidate) => `${candidate.status}: ${candidate.id} -> ${candidate.missingActionIds.slice(0, 4).join(', ') || 'no missing actions'}`),
    data: { snapshot },
  });
}

function hiddenInspect(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const id = text(input.args.id || input.args.candidateId);
  if (!id) return block(input, 'Missing hidden capability id.', ['Provide args.id.']);
  const candidate = service(input.root).inspect(id);
  if (!candidate) return block(input, `Hidden capability ${id} was not found.`, [`Unknown candidate: ${id}`]);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${candidate.title}: ${candidate.status}.`,
    lines: [
      `Domain: ${candidate.domain}`,
      `Status: ${candidate.status}`,
      `Missing actions: ${candidate.missingActionIds.join(', ') || 'none'}`,
      `Recommended: ${candidate.recommendedAction}`,
    ],
    data: { candidate },
  });
}

async function hiddenExpose(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const id = text(input.args.id || input.args.candidateId);
  if (!id) return block(input, 'Missing hidden capability id.', ['Provide args.id.']);
  const plan = service(input.root).buildMaterializationPlan(id);
  if (!plan) return block(input, `Hidden capability ${id} was not found.`, [`Unknown candidate: ${id}`]);
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Exposure plan ready for ${id}.`,
      lines: [
        `Manifest: ${plan.manifestPath}`,
        `Module: ${plan.actionModulePath}`,
        `Actions: ${plan.actionIds.join(', ')}`,
      ],
      data: { plan },
    });
  }
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  await appendJsonArray(queueFile(input.root), {
    queuedAt: new Date().toISOString(),
    requestedBy: input.actorId || 'operator',
    sourceSurface: input.sourceSurface || 'action-harness',
    plan,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `Exposure plan queued for ${id}.`,
    lines: [`Queued exposure plan for ${id}.`, `Queue: ${queueFile(input.root)}`],
    data: { plan, queueFile: queueFile(input.root) },
  });
}

function listSkills(root: string): Array<{ id: string; name: string; file: string; source: string }> {
  const roots = [
    ['native', path.join(root, 'skill-library', 'native')],
    ['imported', path.join(root, 'skill-library', 'imported')],
    ['workspace', path.join(root, 'skills')],
  ] as const;
  const found: Array<{ id: string; name: string; file: string; source: string }> = [];
  for (const [source, dir] of roots) {
    try {
      for (const file of walk(dir).filter((entry) => path.basename(entry).toLowerCase() === 'skill.md')) {
        const name = path.basename(path.dirname(file));
        found.push({
          id: `${source}:${name}`,
          name,
          file: path.relative(root, file),
          source,
        });
      }
    } catch {
      // Optional skill roots may not exist.
    }
  }
  return found.sort((left, right) => left.id.localeCompare(right.id));
}

function walk(dir: string): string[] {
  const items: string[] = [];
  if (!fs.existsSync(dir)) return items;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) items.push(...walk(full));
    else items.push(full);
  }
  return items;
}

function skillsList(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const skills = listSkills(input.root);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${skills.length} skill(s) discovered in local Zavorth skill roots.`,
    lines: skills.slice(0, 50).map((skill) => `${skill.id} -> ${skill.file}`),
    data: { skills },
  });
}

function skillsInspect(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const id = text(input.args.id || input.args.name || input.args.skill);
  if (!id) return block(input, 'Missing skill id or name.', ['Provide args.id or args.name.']);
  const skill = listSkills(input.root).find((entry) => entry.id === id || entry.name === id);
  if (!skill) return block(input, `Skill ${id} was not found.`, [`Unknown skill: ${id}`]);
  const content = fs.readFileSync(path.join(input.root, skill.file), 'utf8').slice(0, 4000);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Skill ${skill.name} found.`,
    lines: [`Skill: ${skill.id}`, `File: ${skill.file}`],
    data: { skill, contentPreview: content },
  });
}

async function skillsAbsorb(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const sourcePath = text(input.args.sourcePath || input.args.source || input.args.path);
  if (!sourcePath) return block(input, 'Missing skill source path.', ['Provide args.sourcePath.']);
  const expansion = new UniversalSkillExpansionService({ projectRoot: input.root });
  const snapshot = await expansion.buildSnapshot({
    sources: [{ sourcePath, presetId: 'generic-skill-folder', sourceKind: 'auto' }],
    projectRoot: input.root,
    apply: input.operation === 'action.apply',
    allowSource: input.trustedOperatorConfirmation === true,
    allowAllCandidates: input.trustedOperatorConfirmation === true,
    channel: 'action-harness',
  });
  return result({
    ok: snapshot.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.apply' ? 'applied' : input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `Skill absorption ${snapshot.status}; candidates=${snapshot.summary.candidates}.`,
    lines: [
      `Status: ${snapshot.status}`,
      `Candidates: ${snapshot.summary.candidates}`,
      `Materialized: ${snapshot.summary.materialized}`,
    ],
    data: { snapshot },
  });
}

function externalAgentsList(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const gateway = new ZavorthExternalAgentGatewayService({ projectRoot: input.root });
  const snapshot = gateway.buildRegistrySnapshot();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${snapshot.summary.total} external agent profile(s).`,
    lines: snapshot.profiles.map((profile) => `${profile.id} | ${profile.adapter} | ${profile.status}`),
    data: { snapshot },
  });
}

async function externalAgentInvoke(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const profileId = text(input.args.profileId || input.args.id);
  const prompt = text(input.args.prompt || input.args.task);
  if (!profileId || !prompt) return block(input, 'Missing external agent profileId or prompt.', ['Provide args.profileId and args.prompt.']);
  const gateway = new ZavorthExternalAgentGatewayService({ projectRoot: input.root });
  const dryRun = input.operation !== 'action.apply';
  const receipt = await gateway.invoke({
    profileId,
    prompt,
    dryRun,
    approvalGranted: input.trustedOperatorConfirmation === true,
    requestedBy: input.actorId || 'operator',
  });
  return result({
    ok: receipt.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.apply' ? 'applied' : input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `External agent invocation ${receipt.status}.`,
    lines: [receipt.output.text.slice(0, 1000)],
    data: { receipt },
  });
}

function workflowsList(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const workflows = service(input.root).listWorkflowScripts();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${workflows.length} workflow script(s) discovered.`,
    lines: workflows.slice(0, 80).map((workflow) => `${workflow.runnable ? 'runnable' : 'inventory'} ${workflow.script}`),
    data: { workflows },
  });
}

async function runProcess(command: string, args: string[], cwd: string, timeoutMs: number): Promise<{ exitCode: number; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ exitCode: 124, output: output.slice(-12000), timedOut: true });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, output: error.message, timedOut: false });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 0, output: output.slice(-12000), timedOut: false });
    });
  });
}

async function workflowsRun(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const script = text(input.args.script || input.args.name);
  if (!script) return block(input, 'Missing workflow script.', ['Provide args.script.']);
  const workflow = service(input.root).listWorkflowScripts().find((entry) => entry.script === script);
  if (!workflow) return block(input, `Workflow script ${script} was not found.`, [`Unknown script: ${script}`]);
  if (input.operation === 'action.preview' || input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `Workflow run preview for ${script}.`,
      lines: [`Script: ${script}`, `Command: npm run ${script} --silent`, 'No workflow was executed.'],
      data: { workflow, liveExecution: false },
    });
  }
  if (input.operation !== 'action.apply') return block(input, `Unsupported operation for ${input.actionId}.`);
  if (!workflow.runnable) return block(input, `Workflow ${script} is inventory-only and cannot be run by this action.`);
  const executed = await runProcess('npm', ['run', script, '--silent'], input.root, 120000);
  return result({
    ok: executed.exitCode === 0,
    actionId: input.actionId,
    operation: input.operation,
    status: executed.exitCode === 0 ? 'applied' : 'blocked',
    summary: `Workflow ${script} exited with code ${executed.exitCode}.`,
    lines: executed.output.split(/\r?\n/u).slice(-120),
    data: { workflow, exitCode: executed.exitCode, timedOut: executed.timedOut, output: executed.output },
  });
}

function parity(input: ZavorthActionHandlerInput, source: ZavorthParitySource): ZavorthActionResult {
  const pack = service(input.root).buildParityPack(source);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${source} parity: ${pack.summary.native}/${pack.summary.total} native mappings.`,
    lines: pack.tools.map((tool) => `${tool.status}: ${tool.sourceToolId} -> ${tool.zavorthActionId}`),
    data: { pack },
  });
}

function action(capabilityId: string, input: Omit<ZavorthActionDefinition, 'capabilityId' | 'verificationStatus' | 'surface' | 'testRefs'>): ZavorthActionDefinition {
  return { ...input, capabilityId, verificationStatus: 'verified', surface: SURFACE, testRefs: TEST_REFS };
}

export function createCapabilitySpineActionModule(): ZavorthActionModule {
  return {
    id: 'capability-spine',
    manifestId: 'capability-spine',
    actions: [
      action('capability-spine', { id: 'capabilities.hidden.scan', title: 'Scan hidden capabilities', description: 'Inventory internal Zavorth capability families that are not fully exposed through the Action Harness.', aliases: ['hidden capabilities', 'capability scan', 'scan hidden'], domains: ['capabilities', 'atlas'], risk: 'safe', effects: ['read'], scope: 'capabilities', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: hiddenScan }),
      action('capability-spine', { id: 'capabilities.hidden.inspect', title: 'Inspect hidden capability', description: 'Inspect one hidden or partially exposed capability family and its missing Action Harness actions.', aliases: ['inspect hidden capability', 'capability inspect'], domains: ['capabilities', 'atlas'], risk: 'safe', effects: ['read'], scope: 'capabilities', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, outputSchema, handler: hiddenInspect }),
      action('capability-spine', { id: 'capabilities.hidden.expose', title: 'Queue hidden capability exposure', description: 'Preview and queue a materialization plan that turns hidden capability families into verified Action Harness actions.', aliases: ['expose hidden capability', 'materialize capability'], domains: ['capabilities', 'atlas'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'capabilities', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, outputSchema, handler: hiddenExpose }),
      action('capability-spine', { id: 'skills.catalog.list', title: 'List skills', description: 'List local skill roots known to Zavorth without executing skill content.', aliases: ['skills list', 'list skills'], domains: ['skills'], risk: 'safe', effects: ['read'], scope: 'skills', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: skillsList }),
      action('capability-spine', { id: 'skills.catalog.inspect', title: 'Inspect skill', description: 'Inspect a local skill manifest/content preview without executing it.', aliases: ['skill inspect', 'view skill'], domains: ['skills'], risk: 'safe', effects: ['read'], scope: 'skills', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } }, outputSchema, handler: skillsInspect }),
      action('capability-spine', { id: 'skills.absorb', title: 'Absorb skill source', description: 'Import approved local skill sources into skill-library/imported.', aliases: ['absorb skill', 'import skill', 'skill absorption'], domains: ['skills'], risk: 'attention', mutationDomain: 'capability', mutationRisk: 'medium', effects: ['write'], scope: 'skills', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { sourcePath: { type: 'string' }, source: { type: 'string' } }, required: ['sourcePath'] }, outputSchema, handler: skillsAbsorb }),
      action('capability-spine', { id: 'agents.external.list', title: 'List external agents', description: 'List external agent profiles registered as governed Zavorth arms.', aliases: ['external agents list', 'agent arms'], domains: ['agents'], risk: 'safe', effects: ['read'], scope: 'agents', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: externalAgentsList }),
      action('capability-spine', { id: 'agents.external.invoke', title: 'Invoke external agent', description: 'Preview or invoke an approved external agent profile as a governed arm.', aliases: ['invoke external agent', 'delegate task', 'external arm'], domains: ['agents'], risk: 'danger', mutationDomain: 'capability', mutationRisk: 'high', effects: ['external_send', 'shell'], scope: 'agents', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { profileId: { type: 'string' }, prompt: { type: 'string' } }, required: ['profileId', 'prompt'] }, outputSchema, handler: externalAgentInvoke }),
      action('capability-spine', { id: 'workflows.list', title: 'List workflows', description: 'List Zavorth package workflow scripts that can be surfaced as governed workflow actions.', aliases: ['workflow list', 'list workflows'], domains: ['workflows'], risk: 'safe', effects: ['read'], scope: 'workflows', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: workflowsList }),
      action('capability-spine', { id: 'workflows.run', title: 'Run workflow', description: 'Preview or run an allowlisted Zavorth workflow script with approval and receipt.', aliases: ['run workflow', 'workflow run'], domains: ['workflows'], risk: 'attention', mutationDomain: 'sandbox', mutationRisk: 'medium', effects: ['shell'], scope: 'workflows', receiptPolicy: 'required', requiresPreview: true, requiresApproval: true, inputSchema: { type: 'object', properties: { script: { type: 'string' } }, required: ['script'] }, outputSchema, handler: workflowsRun }),
      action('capability-spine', { id: 'capabilities.parity.hermes', title: 'Hermes parity pack', description: 'Map Hermes tools and toolsets to native or planned Zavorth Action Harness actions.', aliases: ['hermes parity', 'hermes tools'], domains: ['capabilities', 'parity'], risk: 'safe', effects: ['read'], scope: 'capabilities', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: (input) => parity(input, 'hermes') }),
      action('capability-spine', { id: 'capabilities.parity.openclaw', title: 'OpenClaw parity pack', description: 'Map OpenClaw plugins/tools to native or planned Zavorth Action Harness actions.', aliases: ['openclaw parity', 'openclaw tools'], domains: ['capabilities', 'parity'], risk: 'safe', effects: ['read'], scope: 'capabilities', receiptPolicy: 'none', requiresPreview: false, requiresApproval: false, inputSchema: { type: 'object', properties: {} }, outputSchema, handler: (input) => parity(input, 'openclaw') }),
    ],
  };
}
