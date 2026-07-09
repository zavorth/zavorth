import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { ZavorthActionGateway } from '../../runtime/actions/index.js';
import { SkillCuratorPlaneService } from '../../skills/SkillCuratorPlaneService.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  readArray,
  readJson,
  writeJson,
  appendJsonArray,
  idWithTime,
  runProcess,
  render,
  splitList
} from '../ZavorthCliSharedHelpers.js';
import { logger } from '../../logger.js';
import {
normalizeRequirements,
  enforceRequirements,
  idFromSpec,
  resolveNpmCommand
} from '../ZavorthCliLiveNamespaces.js';type JsonObject = Record<string, unknown>;

export async function runSkills(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  if (isSkillGovernanceAction(action, args)) {
    return runSkillsGovernance(root, args);
  }
  if (action === 'curator' || action === 'curate') {
    return runSkillsCurator(args);
  }
  if (action === 'quarantine') {
    const { SkillQuarantinePipelineService } = await import('../../services/SkillQuarantinePipelineService.js');
    const service = new SkillQuarantinePipelineService({ projectRoot: root });
    const subcommand = String(args[1] || 'preview').trim().toLowerCase();
    const skillId = String(args[2] || readFlag(args, 'skill-id') || 'learned-daily-procedure').trim();
    const snapshot = service.buildSnapshot({
      skillId,
      title: readFlag(args, 'title') || skillId,
      summary: readFlag(args, 'summary') || 'Quarantined skill candidate.',
      applyDraft: subcommand === 'draft' || subcommand === 'apply' || args.includes('--apply'),
      promote: subcommand === 'promote' || args.includes('--promote'),
      approvalId: readFlag(args, 'approval-id'),
    });
    return render(args, 'Zavorth skills quarantine', [
      `Status: ${snapshot.status}`,
      `Skill: ${snapshot.skillId}`,
      `Draft written: ${snapshot.draftWritten ? 'yes' : 'no'}`,
      `Sandbox preview: ${snapshot.sandboxPreviewReady ? 'yes' : 'no'}`,
      `Promotion: ${snapshot.promotionPerformed ? 'done' : 'approval required'}`,
      `Quarantine: ${snapshot.quarantinePath}`,
      snapshot.promotedPath ? `Promoted: ${snapshot.promotedPath}` : 'Promoted: none',
    ], snapshot as unknown as JsonObject);
  }
  const registryFile = path.join(stateDir(root), 'skills.json');
  const registry = await readArray(registryFile);
  const catalog = mergeSkillCatalog(await loadSkillCatalog(root), registry);
  if (action === 'marketplace' || action === 'search') {
    const query = args[1] || readFlag(args, 'query') || '';
    const matches = query ? catalog.filter((skill) => JSON.stringify(skill).toLowerCase().includes(query.toLowerCase())) : catalog;
    return render(args, 'Zavorth skills marketplace', matches.length ? matches.slice(0, 30).map(formatSkillRow) : ['No skills matched.'], { skills: matches.map(sanitizeSkillRecord) });
  }
  if (action === 'install') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    const deps = normalizeSkillDependencies(skill);
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth skills', [
        `Install preview: ${String(skill.id)}`,
        `Dependencies: ${deps.length ? deps.join(', ') : 'none'}`,
        `Requirements: ${skillRequirementLines(skill).join('; ') || 'none'}`,
        'Add --yes to install missing npm dependencies and register the skill.',
      ], { dryRun: true, skill: sanitizeSkillRecord(skill), dependencies: deps });
    }
    let install: JsonObject = { skipped: true };
    if (deps.length > 0) {
      const result = await runProcess(resolveNpmCommand(), ['install', ...deps, '--save-dev'], root, 120000);
      install = { exitCode: result.exitCode, output: result.output.slice(0, 1000), durationMs: result.durationMs };
      if (result.exitCode !== 0) return render(args, 'Zavorth skills', [`Dependency install failed for ${String(skill.id)}`], { ok: false, install });
    }
    const record = { ...skill, status: 'installed', enabled: false, installedAt: new Date().toISOString(), allowlisted: isSkillAllowlisted(root, String(skill.id)) };
    await upsertSkillRecord(registryFile, record);
    return render(args, 'Zavorth skills', [`Installed skill: ${String(skill.id)}`], { skill: sanitizeSkillRecord(record), install });
  }
  if (action === 'enable' || action === 'disable') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    if (action === 'enable' && !(skill.allowByDefault === true || isSkillAllowlisted(root, String(skill.id)))) {
      return render(args, 'Zavorth skills', [`Skill is not allowlisted: ${String(skill.id)}`, `Run: zavorth skills allowlist add ${String(skill.id)}`], { ok: false, skill: sanitizeSkillRecord(skill) });
    }
    if (action === 'enable' && !args.includes('--yes')) {
      return render(args, 'Zavorth skills', [`Enable preview: ${String(skill.id)}`, ...skillRequirementLines(skill), 'Add --yes to enable this skill in runtime state.'], { dryRun: true, skill: sanitizeSkillRecord(skill) });
    }
    const record = { ...skill, status: 'installed', enabled: action === 'enable', updatedAt: new Date().toISOString(), allowlisted: isSkillAllowlisted(root, String(skill.id)) || skill.allowByDefault === true };
    await upsertSkillRecord(registryFile, record);
    await writeSkillsRuntimeState(root);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'skills.json'), { id: idWithTime('skill-receipt'), skillId: skill.id, action, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth skills', [`${action === 'enable' ? 'Enabled' : 'Disabled'} skill: ${String(skill.id)}`], { skill: sanitizeSkillRecord(record) });
  }
  if (action === 'allowlist') return runSkillAllowlist(root, args);
  if (action === 'doctor') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills doctor', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    const checks = doctorSkill(root, skill);
    return render(args, 'Zavorth skills doctor', checks.map((check) => `${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.summary}`), { ok: checks.every((check) => check.ok), checks });
  }
  if (action === 'proof' || action === 'live-proof') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    if (!skill) return render(args, 'Zavorth skills proof', [`Skill not found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth skills proof', [`Live proof preview: ${String(skill.id)}`, 'Add --yes to run the declared proof command or metadata proof.'], { dryRun: true, skill: sanitizeSkillRecord(skill) });
    const proof = await runSkillProof(root, skill, args);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'skills.json'), { id: idWithTime('skill-proof'), skillId: skill.id, status: proof.ok ? 'passed' : 'failed', proof, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth skills proof', [`Proof ${proof.ok ? 'passed' : 'failed'}: ${String(skill.id)}`, proof.summary], { proof });
  }
  if (action === 'requirements') {
    const query = args[1] || '';
    const skills = query ? catalog.filter((skill) => JSON.stringify(skill.requirements || []).toLowerCase().includes(query.toLowerCase())) : catalog;
    return render(args, 'Zavorth skills requirements', skills.length ? skills.map((skill) => `${String(skill.id)}: ${skillRequirementLines(skill).join('; ') || 'none'}`) : ['No skills matched requirements filter.'], { skills: skills.map(sanitizeSkillRecord) });
  }
  if (action === 'inspect' || action === 'show') {
    const id = args[1] || readFlag(args, 'id') || '';
    const skill = catalog.find((entry) => String(entry.id) === id || String(entry.name) === id);
    return render(args, 'Zavorth skills', skill ? skillDetailLines(skill) : [`Skill not found: ${id || '<missing>'}`], { skill: skill ? sanitizeSkillRecord(skill) : null });
  }
  const filtered = filterSkills(catalog, args);
  return render(args, 'Zavorth skills', filtered.length ? filtered.map(formatSkillRow) : ['No skills matched.'], { skills: filtered.map(sanitizeSkillRecord) });
}

export async function runSkillsGovernance(root: string, args: string[]) {
  const gateway = new ZavorthActionGateway({ root });
  const wanted = resolveRequestedSkillGovernanceMode(args);

  if (!wanted) {
    const status = await gateway.status('skills.governance.status');
    const current = normalizeSkillGovernanceMode(String(status.data?.mode || process.env.ZAVORTH_SKILLS_GOVERNANCE_MODE || 'casual'));
    return render(args, 'Zavorth skill governance', [
      `Current mode: ${current}`,
      'casual: fast personal-use imports; hard security/license blockers remain active.',
      'governed: stricter review for enterprise, compliance and sensitive workspaces.',
      'Switch: zavorth skills governance governed --apply',
    ], {
      mode: current,
      envKey: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
      actionId: 'skills.governance.status',
      switchCommands: [
        'zavorth skills governance casual --apply',
        'zavorth skills governance governed --apply',
      ],
    });
  }

  if (!args.includes('--apply') && !args.includes('--yes')) {
    const preview = await gateway.preview('skills.governance.set', { mode: wanted });
    return render(args, 'Zavorth skill governance', [
      ...preview.lines.filter((line) => line !== 'Preview only. No file was written.'),
      'Preview only. Add --apply to write ZAVORTH_SKILLS_GOVERNANCE_MODE into .env.',
    ], {
      dryRun: true,
      mode: wanted,
      actionId: preview.actionId,
      ...(preview.data || {}),
      envKey: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
    });
  }

  const applied = await gateway.apply('skills.governance.set', { mode: wanted }, {
    trustedOperatorConfirmation: true,
    actorId: 'operator',
    sourceSurface: 'cli:skills-governance',
  });

  return render(args, 'Zavorth skill governance', [
    ...applied.lines,
  ], {
    applied: true,
    mode: wanted,
    actionId: applied.actionId,
    ...(applied.data || {}),
    envKey: 'ZAVORTH_SKILLS_GOVERNANCE_MODE',
  });
}

export async function runSkillsCurator(args: string[]) {
  const plane = new SkillCuratorPlaneService();
  const topLevelAction = firstArg(args, 'curator');
  const subcommand = topLevelAction === 'curate'
    ? 'run'
    : String(args[1] || 'status').toLowerCase();
  const skillId = topLevelAction === 'curate'
    ? readFlag(args, 'id') || ''
    : String(args[2] || readFlag(args, 'id') || '').trim();

  if (subcommand === 'status') {
    const status = await plane.status();
    return render(args, 'Zavorth skills curator', [
      `State: ${status.enabled ? 'enabled' : 'disabled'}${status.paused ? ' / paused' : ''}`,
      `Managed skills: ${status.stats.managed} (${status.stats.stale} stale, ${status.stats.archived} archived, ${status.stats.pinned} pinned)`,
      `Last run: ${status.lastRunAt || 'never'}`,
      `Next run: ${status.nextRunAt || 'not scheduled yet'}`,
      status.lastRunSummary ? `Summary: ${status.lastRunSummary}` : 'Summary: none',
      `Report: ${status.lastReportPath || 'none'}`,
      'Commands: run --dry-run, run, pause, resume, pin <skill>, unpin <skill>, restore <skill>',
    ], status as unknown as JsonObject);
  }

  if (subcommand === 'run') {
    const report = await plane.runCuratorReview({
      dryRun: args.includes('--dry-run'),
      llmReview: args.includes('--llm-review') || args.includes('--ai-review'),
      reason: args.includes('--dry-run') ? 'cli-dry-run' : 'cli-run',
      triggeredBy: 'cli:skills-curator',
    });
    return render(args, 'Zavorth skills curator', [
      report.summary,
      `Lifecycle transitions: ${report.transitions.length}`,
      `Consolidation candidates: ${report.auxiliaryReview.consolidationCandidates.length}`,
      `LLM review: ${report.llmReview.status}`,
      report.dryRun ? 'Dry-run only. No skill lifecycle state was changed.' : 'Applied safe lifecycle transitions.',
    ], report as unknown as JsonObject);
  }

  if (subcommand === 'pause') {
    const state = await plane.pause();
    return render(args, 'Zavorth skills curator', ['Curator paused. Scheduled maintenance will not run.'], state as unknown as JsonObject);
  }

  if (subcommand === 'resume') {
    const state = await plane.resume();
    return render(args, 'Zavorth skills curator', ['Curator resumed. Scheduled maintenance is eligible again.'], state as unknown as JsonObject);
  }

  if (subcommand === 'pin' || subcommand === 'unpin') {
    if (!skillId) {
      return render(args, 'Zavorth skills curator', ['Missing skill id. Usage: zavorth skills curator pin <skill>'], { ok: false });
    }
    const pinned = subcommand === 'pin';
    await plane.togglePin(skillId, pinned);
    return render(args, 'Zavorth skills curator', [`${pinned ? 'Pinned' : 'Unpinned'} skill: ${skillId}`], {
      skillId,
      pinned,
      });
  }

  if (subcommand === 'restore') {
    if (!skillId) {
      return render(args, 'Zavorth skills curator', ['Missing skill id. Usage: zavorth skills curator restore <skill>'], { ok: false });
    }
    await plane.restoreSkill(skillId);
    return render(args, 'Zavorth skills curator', [`Restored archived skill: ${skillId}`], { skillId });
  }

  return render(args, 'Zavorth skills curator', [
    `Unsupported curator command: ${subcommand}`,
    'Allowed: status, run, pause, resume, pin, unpin, restore',
  ], { ok: false, subcommand });
}

async function loadSkillCatalog(root: string): Promise<JsonObject[]> {
  const bundled: JsonObject[] = [
    { id: 'debugging', name: 'Debugging', summary: 'Investigate failures with evidence-first workflow.', requirements: [], dependencies: [], allowByDefault: true },
    { id: 'requirements-analysis', name: 'Requirements Analysis', summary: 'Turn ambiguous requests into clear acceptance criteria.', requirements: [], dependencies: [], allowByDefault: true },
    { id: 'system-design', name: 'System Design', summary: 'Architecture planning with tradeoffs and contracts.', requirements: [], dependencies: [], allowByDefault: true },
    { id: 'security-review', name: 'Security Review', summary: 'Risk review with policy and mitigation focus.', requirements: [{ kind: 'env', name: 'ZAVORTH_SECURITY_MODE', required: false }], dependencies: [], allowByDefault: false },
    { id: 'web-research', name: 'Web Research', summary: 'Current-information research with source evidence.', requirements: [{ kind: 'env', name: 'WEB_SEARCH_PROVIDER', required: false }], dependencies: [], allowByDefault: false },
  ];
  const localFiles = [path.join(root, 'skills.json'), path.join(root, 'skills', 'catalog.json'), path.join(stateDir(root), 'skill-marketplace.json')];
  const local = (await Promise.all(localFiles.map(async (file) => {
    const value = await readJson(file, []);
    return Array.isArray(value) ? value as JsonObject[] : [];
  }))).flat();
  return [...bundled, ...local].map(normalizeSkillRecord);
}

function mergeSkillCatalog(catalog: JsonObject[], registry: unknown[]): JsonObject[] {
  const map = new Map<string, JsonObject>();
  for (const skill of catalog) map.set(String(skill.id), skill);
  for (const entry of registry) {
    const item = normalizeSkillRecord(entry as JsonObject);
    map.set(String(item.id), { ...(map.get(String(item.id)) || {}), ...item });
  }
  return Array.from(map.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function normalizeSkillRecord(value: JsonObject): JsonObject {
  const id = idFromSpec(String(value.id || value.name || 'skill'));
  return {
    id,
    name: String(value.name || id),
    summary: String(value.summary || value.description || 'Governed skill.'),
    requirements: normalizeRequirements(((value.requirements || []) as unknown[])),
    dependencies: Array.isArray(value.dependencies) ? value.dependencies.map(String) : splitList(String(value.dependencies || '')),
    status: value.status || 'available',
    enabled: value.enabled === true,
    allowByDefault: value.allowByDefault === true,
    allowlisted: value.allowlisted === true,
    proof: value.proof || null,
  };
}

function filterSkills(catalog: JsonObject[], args: string[]): JsonObject[] {
  const requirement = readFlag(args, 'requirement') || '';
  const enabledOnly = args.includes('--enabled');
  const missingOnly = args.includes('--missing');
  return catalog.filter((skill) => {
    if (enabledOnly && skill.enabled !== true) return false;
    if (requirement && !JSON.stringify(skill.requirements || []).toLowerCase().includes(requirement.toLowerCase())) return false;
    if (missingOnly && enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>).ok) return false;
    return true;
  });
}

function formatSkillRow(skill: JsonObject): string {
  const req = enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>);
  return `- ${String(skill.id)} | ${skill.enabled ? 'enabled' : 'disabled'} | ${req.ok ? 'ready' : 'missing'} | ${String(skill.summary)}`;
}

function skillDetailLines(skill: JsonObject): string[] {
  return [
    `id: ${String(skill.id)}`,
    `name: ${String(skill.name)}`,
    `summary: ${String(skill.summary)}`,
    `enabled: ${String(skill.enabled === true)}`,
    `requirements: ${skillRequirementLines(skill).join('; ') || 'none'}`,
    `dependencies: ${normalizeSkillDependencies(skill).join(', ') || 'none'}`,
  ];
}

function skillRequirementLines(skill: JsonObject): string[] {
  return enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>).lines;
}

function normalizeSkillDependencies(skill: JsonObject): string[] {
  return Array.from(new Set(((skill.dependencies || []) as string[]).map(String).filter(Boolean)));
}

async function upsertSkillRecord(file: string, record: JsonObject): Promise<void> {
  const items = await readArray(file);
  const index = items.findIndex((entry) => String((entry as JsonObject).id) === String(record.id));
  if (index >= 0) items[index] = record;
  else items.push(record);
  await writeJson(file, items);
}

async function runSkillAllowlist(root: string, args: string[]) {
  const file = path.join(stateDir(root), 'skills-allowlist.json');
  const action = args[1] || 'list';
  const allowlist = await readArray(file);
  if (action === 'add') {
    const id = args[2] || readFlag(args, 'id') || '';
    if (!id) return render(args, 'Zavorth skills allowlist', ['Usage: zavorth skills allowlist add <id>'], { ok: false });
    const next = Array.from(new Set([...allowlist.map(String), idFromSpec(id)]));
    await writeJson(file, next);
    return render(args, 'Zavorth skills allowlist', [`Allowlisted skill: ${idFromSpec(id)}`], { allowlist: next });
  }
  if (action === 'remove') {
    const id = idFromSpec(args[2] || readFlag(args, 'id') || '');
    const next = allowlist.map(String).filter((entry) => entry !== id);
    await writeJson(file, next);
    return render(args, 'Zavorth skills allowlist', [`Removed skill from allowlist: ${id}`], { allowlist: next });
  }
  return render(args, 'Zavorth skills allowlist', allowlist.length ? allowlist.map((entry) => `- ${String(entry)}`) : ['No skill allowlist entries yet.'], { allowlist });
}

function isSkillAllowlisted(root: string, id: string): boolean {
  try {
    const file = path.join(stateDir(root), 'skills-allowlist.json');
    const raw = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    return Array.isArray(raw) && raw.includes(idFromSpec(id));
  } catch (error: unknown) {logger.warn('[Zavorth Cli Skills Namespace] JSON parse failed', error); return false; }
}

function doctorSkill(root: string, skill: JsonObject): Array<{ id: string; ok: boolean; summary: string }> {
  const requirements = enforceRequirements((skill.requirements || []) as Array<{ kind: string; name: string; required: boolean }>);
  const deps = normalizeSkillDependencies(skill);
  const pkg = existsSync(path.join(root, 'package.json')) ? JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) : {};
  const installed = new Set(Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }));
  const missingDeps = deps.filter((dep) => !installed.has(dep));
  return [
    { id: 'requirements', ok: requirements.ok, summary: requirements.ok ? 'Requirements satisfied.' : `Missing: ${requirements.missing.join(', ')}` },
    { id: 'dependencies', ok: missingDeps.length === 0, summary: missingDeps.length ? `Missing dependencies: ${missingDeps.join(', ')}` : 'Dependencies installed or not required.' },
    { id: 'allowlist', ok: Boolean(skill.allowByDefault || isSkillAllowlisted(root, String(skill.id))), summary: skill.allowByDefault || isSkillAllowlisted(root, String(skill.id)) ? 'Skill is allowed.' : 'Skill requires allowlist before enable.' },
  ];
}

async function runSkillProof(root: string, skill: JsonObject, args: string[]): Promise<{ ok: boolean; summary: string; result?: JsonObject }> {
  const proof = (skill.proof || {}) as JsonObject;
  const command = readFlag(args, 'command') || String(proof.command || '');
  if (!command) return { ok: true, summary: 'Metadata proof recorded; no live proof command declared.' };
  const result = await runProcess(command, [], root, readNumberFlag(args, 'timeout-ms') || 30000);
  return { ok: result.exitCode === 0, summary: result.output.slice(0, 500) || `exit ${result.exitCode}`, result };
}

async function writeSkillsRuntimeState(root: string): Promise<void> {
  const registry = await readArray(path.join(stateDir(root), 'skills.json'));
  const enabled = registry.map((entry) => entry as JsonObject).filter((skill) => skill.enabled === true);
  await writeJson(path.join(stateDir(root), 'skills-runtime.json'), {
    version: 1,
    updatedAt: new Date().toISOString(),
    enabled: enabled.map((skill) => ({
      id: skill.id,
      name: skill.name,
      requirements: skill.requirements || [],
      dependencies: skill.dependencies || [],
    })),
  });
}

function sanitizeSkillRecord(value: unknown): JsonObject {
  return { ...((value || {}) as JsonObject) };
}

function isSkillGovernanceAction(action: string, args: string[]): boolean {
  return action === 'governance' || args.includes('--governance') || args.includes('--enterprise');
}

function resolveRequestedSkillGovernanceMode(args: string[]): 'casual' | 'governed' | null {
  if (args.includes('casual')) return 'casual';
  if (args.includes('governed') || args.includes('governance')) return 'governed';
  return null;
}

function normalizeSkillGovernanceMode(value: string): 'casual' | 'governed' {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'governed' || clean === 'governance' || clean === 'strict') return 'governed';
  return 'casual';
}
