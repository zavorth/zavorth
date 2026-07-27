import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { SkillLocalRegistry } from '../skills/marketplace/SkillLocalRegistry.js';
import { SkillGitRegistry } from '../skills/marketplace/SkillGitRegistry.js';
import { validateSkillPackage } from '../skills/marketplace/SkillPackageValidator.js';
import {
  scanSkillForSecurity,
  getSkillPermissions,
  recordAuditLog,
  signSkillPackage,
} from '../skills/marketplace/SkillMarketplaceSecurity.js';
import { SkillRollback } from '../skills/marketplace/SkillRollback.js';
import { SkillDependencyResolver } from '../skills/marketplace/SkillDependencyResolver.js';
import { detectSource, getSourceHint } from '../skills/marketplace/SkillSourceDetector.js';
import { SkillUpdateChecker } from '../skills/marketplace/SkillUpdateChecker.js';
import { detectConflicts } from '../skills/marketplace/SkillConflictDetector.js';
import { SkillBundleManager } from '../skills/marketplace/SkillBundle.js';
import { setAuthToken, removeAuthToken } from '../skills/marketplace/SkillAuth.js';
import { asErrorLike } from '../utils/errorLike';
import { SkillInstallPipelineService } from '../services/SkillInstallPipelineService.js';
import { SkillWorkerDiscoveryService } from '../services/SkillWorkerDiscoveryService.js';
import { WorkerMeshService } from '../services/WorkerMeshService.js';
import { SkillRegistryOpsService } from '../services/SkillRegistryOpsService.js';
import { getTrustedSkillGitDomains } from '../skills/marketplace/SkillGitRegistry.js';

export class ZavorthSkillMarketplaceTool extends BaseTool {
  public readonly name = 'zavorth_skill_marketplace';

  public readonly description =
    'Skill Marketplace — discover, preview, install (with consent), publish, and manage Zavorth skills. Preferred install flow: action=preview then action=install with consent=true. Sources: Git, zip/tarball, npm, registries, local paths. Brand-agnostic.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          "Action: 'search', 'search_remote', 'rank', 'list', 'preview', 'install', 'receipt', 'trust', 'publish', 'publish_plan', 'verify', 'registry_export', 'trusted_hosts', 'info', 'remove', 'update', 'rollback', 'outdated', 'conflicts', 'auth', 'sign', 'bundle'.",
      },
      use_llm: {
        type: 'boolean',
        description: 'For search/rank: re-order a closed candidate list with the LLM. Default false (deterministic).',
      },
      remote: {
        type: 'boolean',
        description: 'For search: include remote repository search (network). Default false (offline/local).',
      },
      trust_kind: {
        type: 'string',
        description: "For action=trust add: 'domain' | 'publisher' | 'registry-prefix'.",
      },
      trust_pattern: {
        type: 'string',
        description: 'For action=trust add/remove: domain or publisher pattern (generic).',
      },
      query: {
        type: 'string',
        description: 'Search query for skills.',
      },
      skill_id: {
        type: 'string',
        description: 'Skill ID (for install/info/remove/update/preview filter).',
      },
      source: {
        type: 'string',
        description: 'Source URL or path for preview/install/publish (Git URL or local path).',
      },
      consent: {
        type: 'boolean',
        description: 'Required true to materialize install after preview. Default false.',
      },
      force: {
        type: 'boolean',
        description:
          'Override trust deny band. Agent tools reject force unless ZAVORTH_SKILL_ALLOW_FORCE=1 (operator only).',
      },
      operator_confirm: {
        type: 'boolean',
        description: 'Required true for trust policy mutations and auth token writes (operator-gated).',
      },
      receipt_id: {
        type: 'string',
        description: 'Receipt id for action=receipt (omit to list recent).',
      },
      skill_dir: {
        type: 'string',
        description: 'local skill directory path for publish.',
      },
      repo_url: {
        type: 'string',
        description: 'Git repository URL for publish / publish_plan.',
      },
      dry_run: {
        type: 'boolean',
        description: 'For action=publish: when true, write publish-plan only (no git push). Default false.',
      },
      out_path: {
        type: 'string',
        description: 'Output path for publish_plan / registry_export artifacts.',
      },
      install_all: {
        type: 'boolean',
        description: 'Install all skills from a multi-skill repository. Default: false.',
      },
      category: {
        type: 'string',
        description:
          "Filter by category: 'coding', 'research', 'creative', 'devops', 'security', 'data', 'automation', 'communication', 'productivity', 'other'.",
      },
    },
    required: ['action'],
  };

  private readonly registry: SkillLocalRegistry;
  private readonly gitRegistry: SkillGitRegistry;
  private readonly depResolver: SkillDependencyResolver;
  private readonly skillsDir: string;
  private readonly pipeline: SkillInstallPipelineService;
  private readonly discovery: SkillWorkerDiscoveryService;

  constructor(options?: { dataDir?: string; projectRoot?: string }) {
    super();
    this.registry = new SkillLocalRegistry(options);
    this.gitRegistry = new SkillGitRegistry(options);
    this.depResolver = new SkillDependencyResolver(options);
    const root = options?.projectRoot || process.cwd();
    this.skillsDir = path.join(root, 'skills');
    this.pipeline = new SkillInstallPipelineService({
      projectRoot: root,
      gitRegistry: this.gitRegistry,
    });
    this.discovery = new SkillWorkerDiscoveryService({
      projectRoot: root,
      registry: this.registry,
      mesh: new WorkerMeshService({ projectRoot: root }),
      trust: this.pipeline.getTrustService(),
    });
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '')
      .trim()
      .toLowerCase();
    switch (action) {
      case 'search':
        return await this.search(args);
      case 'search_remote':
      case 'search-remote':
        return await this.search({ ...args, remote: true });
      case 'rank':
        return await this.search({ ...args, use_llm: true });
      case 'discover':
        return await this.search(args);
      case 'list':
        return this.list(args);
      case 'preview':
        return this.preview(args);
      case 'install':
        return this.install(args);
      case 'receipt':
        return this.receipt(args);
      case 'trust':
        return this.trust(args);
      case 'publish':
        return this.publish(args);
      case 'publish_plan':
      case 'publish-plan':
      case 'plan_publish':
        return this.publishPlan(args);
      case 'verify':
        return this.verify(args);
      case 'registry_export':
      case 'registry-export':
      case 'export_registry':
        return this.registryExport(args);
      case 'trusted_hosts':
      case 'trusted-hosts':
      case 'trusted_domains':
        return this.trustedHosts();
      case 'info':
        return this.info(args);
      case 'remove':
        return this.remove(args);
      case 'update':
        return this.update(args);
      case 'rollback':
        return this.rollback(args);
      case 'outdated':
        return this.outdated();
      case 'conflicts':
        return this.conflicts();
      case 'auth':
        return this.auth(args);
      case 'sign':
        return this.sign(args);
      case 'bundle':
        return this.bundle(args);
      default:
        return `Unknown action "${action}". Available: search, search_remote, rank, list, preview, install, receipt, trust, publish, publish_plan, verify, registry_export, trusted_hosts, info, remove, update, rollback, outdated, conflicts, auth, sign, bundle`;
    }
  }

  private trust(args: Record<string, unknown>): string {
    const trust = this.pipeline.getTrustService();
    const op = String(args.query || args.skill_id || 'show')
      .trim()
      .toLowerCase();
    if (op === 'add' || op === 'remove') {
      if (!this.isOperatorConfirmed(args)) {
        return [
          'Error: trust policy mutations require operator_confirm=true',
          '(or ZAVORTH_SKILL_OPERATOR_MODE=1). Agents cannot expand trust silently.',
        ].join(' ');
      }
    }
    if (op === 'add') {
      const kindRaw = String(args.trust_kind || '').toLowerCase();
      const pattern = String(args.trust_pattern || args.source || '').trim();
      const kind =
        kindRaw === 'domain' || kindRaw === 'publisher' || kindRaw === 'registry-prefix'
          ? kindRaw
          : kindRaw === 'registry'
            ? 'registry-prefix'
            : null;
      if (!kind || !pattern) {
        return 'Error: trust add needs trust_kind=domain|publisher|registry-prefix and trust_pattern=...';
      }
      const entry = trust.addOwnerTrusted({ kind, pattern });
      return `Added owner-trusted ${entry.kind}: ${entry.pattern}`;
    }
    if (op === 'remove') {
      const pattern = String(args.trust_pattern || args.source || '').trim();
      if (!pattern) return 'Error: trust remove needs trust_pattern or source.';
      return trust.removeOwnerTrusted(pattern) ? `Removed owner-trusted entry matching ${pattern}`
        : `No owner-trusted entry for ${pattern}`;
    }
    const entries = trust.listOwnerTrusted();
    return [
      `Trust profile: ${trust.getProfile()} (ZAVORTH_SKILL_TRUST_PROFILE)`,
      'Owner-trusted:',
      ...(entries.length ? entries.map((e) => `  ? [${e.kind}] ${e.pattern}`) : ['  (none)']),
    ].join('\n');
  }

  private isOperatorConfirmed(args: Record<string, unknown>): boolean {
    if (args.operator_confirm === true) return true;
    const mode = String(process.env.ZAVORTH_SKILL_OPERATOR_MODE || '')
      .trim()
      .toLowerCase();
    return mode === '1' || mode === 'true' || mode === 'on' || mode === 'yes';
  }

  private isForceAllowed(args: Record<string, unknown>): boolean {
    if (args.force !== true) return false;
    const allow = String(process.env.ZAVORTH_SKILL_ALLOW_FORCE || '')
      .trim()
      .toLowerCase();
    if (allow === '1' || allow === 'true' || allow === 'on' || allow === 'yes') return true;
    if (this.isOperatorConfirmed(args)) return true;
    return false;
  }

  private preview(args: Record<string, unknown>): string {
    const source = String(args.source || args.skill_id || '').trim();
    if (!source) return 'Error: "source" is required for preview.';
    const plan = this.pipeline.preview({
      source,
      skillId: args.skill_id ? String(args.skill_id) : null,
    });
    return this.pipeline.formatPlanText(plan);
  }

  private receipt(args: Record<string, unknown>): string {
    const id = String(args.receipt_id || args.skill_id || '').trim();
    if (id) {
      const one = this.pipeline.getReceipt(id);
      if (!one) return `Receipt not found: ${id}`;
      return this.pipeline.formatReceiptText(one);
    }
    const list = this.pipeline.listReceipts(10);
    if (list.length === 0) return 'No skill install receipts yet.';
    return ['Recent skill install receipts:', ...list.map((r) => `  ${r.id}  ${r.status}  ${r.skillId || '—'}`)].join(
      '\n',
    );
  }

  private async search(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || args.source || '').trim();
    const remote = args.remote === true;
    const useLlm = args.use_llm === true || args.useLlm === true;
    const includeWorkers = args.include_workers !== false;
    if (!query) {
      return 'Error: "query" is required for search/discover. Tip: paste a skill URL to detect install-from-URL.';
    }

    const result = await this.discovery.discover({
      query,
      remote,
      useLlm,
      includeWorkers,
      scanWorkspace: true,
      limit: 15,
    });

    // Optional category filter on local hits
    const category = String(args.category || '').trim();
    if (category) {
      result.skills = result.skills.filter((s) => s.category === category || s.tags.includes(category));
    }

    return result.formatText();
  }

  private list(args: Record<string, unknown>): string {
    const entries = this.registry.listAll();
    if (entries.length === 0) return 'No skills registered in the marketplace.';

    const lines = [`Registered skills (${entries.length}):`];
    for (const s of entries) {
      const installed = s.installedAt ? ' [installed]' : '';
      lines.push(`  ${s.id} v${s.version} by ${s.author}${installed} - ${s.description}`);
    }
    return lines.join('\n');
  }

  private async install(args: Record<string, unknown>): Promise<string> {
    const source = String(args.source || args.skill_id || '').trim();
    if (!source) return 'Error: "source" is required (URL, path, package name, or skill ID).';

    const consent = args.consent === true || args.approve === true || args.yes === true;
    const forceRequested = args.force === true;
    const force = this.isForceAllowed(args);
    if (forceRequested && !force) {
      return [
        'Error: force=true is blocked on the agent tool surface.',
        'Set ZAVORTH_SKILL_ALLOW_FORCE=1 and operator_confirm=true for operator override,',
        'or use CLI after explicit human review.',
      ].join(' ');
    }
    const onlySkill = String(args.skill_id || '').trim() || undefined;

    // Multi-skill remote listing still uses discover (awaited) when install_all is not set.
    const installAll = args.install_all === true;
    if (
      installAll === false &&
      (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('git@')) &&
      !onlySkill
    ) {
      try {
        const { tmpDir, skills } = this.gitRegistry.discoverSkills(source);
        if (skills.length === 0) {
          this.cleanup(tmpDir);
          return 'No valid skills found in repository.';
        }
        if (skills.length > 1) {
          this.cleanup(tmpDir);
          const lines = [`Found ${skills.length} skills in repository:`];
          for (const s of skills) {
            lines.push(`  ? ${s.name} v${s.version}${s.description ? `: ${s.description}` : ''}`);
          }
          lines.push('');
          lines.push('Preview one: action=preview source=<url> skill_id=<name>');
          lines.push('Install one: action=install source=<url> skill_id=<name> consent=true');
          lines.push('Or install_all: true with consent=true (installs first via pipeline per skill in a follow-up).');
          return lines.join('\n');
        }
        this.cleanup(tmpDir);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        return `Git discover failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    if (!consent) {
      const plan = this.pipeline.preview({ source, skillId: onlySkill });
      return [
        this.pipeline.formatPlanText(plan),
        '',
        'Install not applied (consent required).',
        'Call again with consent=true after reviewing the plan.',
      ].join('\n');
    }

    const receipt = await this.pipeline.apply({
      source,
      skillId: onlySkill,
      consent: true,
      force,
    });
    // Prefer structured JSON for agent consumption (tool binds + SkillIR digest).
    const structured = {
      ok: receipt.status === 'applied' || receipt.status === 'partial',
      mode: 'install',
      receipt: {
        id: receipt.id,
        status: receipt.status,
        skillId: receipt.skillId,
        targetDir: receipt.targetDir,
        materialized: receipt.materialized,
        skillIrDigest: receipt.skillIrDigest || null,
        parserId: receipt.parserId || null,
        toolBinds: receipt.toolBinds,
        smoke: receipt.smoke,
        reason: receipt.reason,
      },
      text: this.pipeline.formatReceiptText(receipt),
    };
    return JSON.stringify(structured, null, 2);
  }

  private publish(args: Record<string, unknown>): string {
    const dryRun =
      args.dry_run === true ||
      String(args.dry_run || '').trim() === '1' ||
      String(process.env.ZAVORTH_SKILL_PUBLISH_DRY_RUN || '').trim() === '1';
    if (dryRun) {
      return this.publishPlan(args);
    }

    const skillDir = String(args.skill_dir || args.source || '').trim();
    const repoUrl = String(args.repo_url || '').trim() || undefined;
    if (!skillDir) return 'Error: "skill_dir" is required for publish.';

    const localPath = path.resolve(skillDir);
    if (!fs.existsSync(localPath)) return `Directory not found: ${skillDir}`;

    const validation = validateSkillPackage(localPath);
    if (!validation.valid || !validation.manifest) return `Cannot publish: ${validation.errors.join(', ')}`;

    if (repoUrl) {
      const ops = new SkillRegistryOpsService({ skillsDir: this.skillsDir });
      const plan = ops.planPublish({ skillDir: localPath, repoUrl });
      if (!plan.repoAllowed) {
        return [
          `Error: repo not allowed for publish.`,
          ...plan.messages,
          'Use action=publish_plan for a dry-run artifact, or ZAVORTH_SKILL_TRUSTED_DOMAINS (operator).',
        ].join('\n');
      }
      const r = this.gitRegistry.publishToRepo(localPath, repoUrl);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    this.registry.addEntry(validation.manifest, 'local', null);
    return `Registered "${validation.manifest.name}" v${validation.manifest.version} in local marketplace.`;
  }

  private publishPlan(args: Record<string, unknown>): string {
    const skillDir = String(args.skill_dir || args.source || args.skill_id || '').trim();
    if (!skillDir) return 'Error: "skill_dir" (or source) is required for publish_plan.';
    let localPath = path.resolve(skillDir);
    if (!fs.existsSync(localPath)) {
      const under = path.join(this.skillsDir, skillDir);
      if (fs.existsSync(under)) localPath = under;
    }
    if (!fs.existsSync(localPath)) return `Directory not found: ${skillDir}`;

    const repoUrl = String(args.repo_url || process.env.ZAVORTH_SKILL_PUBLISH_REPO || '').trim() || null;
    const outPath =
      String(args.out_path || '').trim() ||
      path.join(process.cwd(), 'data', 'runtime', 'skill-registry', 'publish-plan.json');
    const ops = new SkillRegistryOpsService({ skillsDir: this.skillsDir });
    const written = ops.writePublishPlan(outPath, { skillDir: localPath, repoUrl });
    if (written.ok === false) {
      return `Error: ${written.message || 'publish_plan failed'}`;
    }
    const p = written.plan;
    return [
      `Publish plan (dry-run): ${p.skillId || p.skillDir}`,
      `ok=${p.ok} wouldPush=${p.wouldPush} signed=${p.signed} packageValid=${p.packageValid} risk=${p.riskLevel}`,
      `repo=${p.repoUrl || '(none)'} allowed=${p.repoAllowed}`,
      `artifact=${written.path}`,
      ...p.messages.map((m) => `· ${m}`),
      ...(p.nextSteps.length ? ['next:', ...p.nextSteps.map((s) => `  ? ${s}`)] : []),
    ].join('\n');
  }

  private verify(args: Record<string, unknown>): string {
    const skillDir = String(args.skill_dir || args.source || args.skill_id || '').trim();
    if (!skillDir) return 'Error: "skill_dir" is required for verify.';
    let localPath = path.resolve(skillDir);
    if (!fs.existsSync(localPath)) {
      const under = path.join(this.skillsDir, skillDir);
      if (fs.existsSync(under)) localPath = under;
    }
    if (!fs.existsSync(localPath)) return `Directory not found: ${skillDir}`;
    const ops = new SkillRegistryOpsService({ skillsDir: this.skillsDir });
    const report = ops.verify(localPath);
    return [
      `Skill verify: ${report.path}`,
      `packageValid=${report.packageValid}`,
      `signature=${report.signature.mode} ok=${report.signature.ok} (${report.signature.message})`,
      `security risk=${report.security.riskLevel} issues=${report.security.issues}`,
      report.ok ? 'result=PASS' : 'result=FAIL',
    ].join('\n');
  }

  private registryExport(args: Record<string, unknown>): string {
    const outPath =
      String(args.out_path || '').trim() || path.join(process.cwd(), 'data', 'runtime', 'skill-registry', 'index.json');
    const baseUrl = String(args.repo_url || args.source || process.env.ZAVORTH_SKILL_REGISTRY_URL || '').trim() || null;
    const ops = new SkillRegistryOpsService({ skillsDir: this.skillsDir });
    const written = ops.writeIndex(outPath, { registryBaseUrl: baseUrl });
    if (!written.ok) return `Error: ${written.message}`;
    return `Registry index exported: ${written.path} (${written.count} skill(s))`;
  }

  private trustedHosts(): string {
    const domains = getTrustedSkillGitDomains();
    const lines = ['Trusted skill git hosts:', ...domains.map((d) => ` ? ${d}`)];
    if (process.env.ZAVORTH_SKILL_TRUSTED_DOMAINS) {
      lines.push('(extra via ZAVORTH_SKILL_TRUSTED_DOMAINS)');
    }
    return lines.join('\n');
  }

  private info(args: Record<string, unknown>): string {
    const id = String(args.skill_id || '').trim();
    if (!id) return 'Error: "skill_id" is required.';

    const entry = this.registry.getEntry(id);
    if (!entry) return `Skill "${id}" not found in marketplace.`;

    return [
      `Name:        ${entry.name}`,
      `Version:     ${entry.version}`,
      `Author:      ${entry.author}`,
      `Description: ${entry.description}`,
      `Category:    ${entry.category}`,
      `Tags:        ${entry.tags.join(', ') || 'none'}`,
      `Source:      ${entry.source}${entry.sourceUrl ? ` (${entry.sourceUrl})` : ''}`,
      `Installed:   ${entry.installedAt || 'no'}`,
      `Downloads:   ${entry.downloads}`,
      `Rating:      ${entry.rating.toFixed(1)}`,
    ].join('\n');
  }

  private remove(args: Record<string, unknown>): string {
    const rawId = String(args.skill_id || '').trim();
    if (!rawId) return 'Error: "skill_id" is required.';

    // Confine removal under skillsDir (no path traversal).
    const id = rawId
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .pop()!
      .replace(/[^a-zA-Z0-9._@+-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    if (!id || id === '.' || id === '..') {
      return 'Error: invalid skill_id.';
    }

    const skillsRoot = path.resolve(this.skillsDir);
    const targetDir = path.resolve(skillsRoot, id);
    const rootPrefix = skillsRoot.endsWith(path.sep) ? skillsRoot : skillsRoot + path.sep;
    if (targetDir !== skillsRoot && !targetDir.startsWith(rootPrefix)) {
      return 'Error: skill_id escapes skills directory.';
    }
    if (!fs.existsSync(targetDir)) return `Skill "${id}" is not installed.`;

    fs.rmSync(targetDir, { recursive: true, force: true });
    this.registry.markUninstalled(id);
    return `Removed "${id}" from skills/`;
  }

  private update(args: Record<string, unknown>): string {
    const id = String(args.skill_id || '').trim();
    if (!id) return 'Error: "skill_id" is required.';

    const entry = this.registry.getEntry(id);
    if (!entry) return `Skill "${id}" not found in marketplace.`;
    if (!entry.installedAt) return `Skill "${id}" is not installed.`;

    if (entry.source === 'git' && entry.sourceUrl) {
      const r = this.gitRegistry.installFromRepo(entry.sourceUrl, entry.id);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    return `Skill "${entry.id}" is a local skill. Update by re-publishing: zavorth skill publish ${entry.id}`;
  }

  private rollback(args: Record<string, unknown>): string {
    const query = String(args.skill_id || '').trim();
    const version = String(args.version || '').trim() || undefined;

    if (!query) {
      const rb = new SkillRollback();
      const backups = rb.listBackups();
      if (backups.length === 0) return 'No backups available for rollback.';
      const lines = ['Available backups:'];
      for (const b of backups) lines.push(`  ${b.skillId} v${b.version} (${b.backedUpAt})`);
      lines.push('');
      lines.push('Specify skill_id to see available versions for a specific skill.');
      return lines.join('\n');
    }

    const rb = new SkillRollback();
    const skillId = rb.findSkillByName(query) || this.registry.getEntry(query)?.id || query;

    if (version) {
      const result = rb.rollbackToVersion(skillId, version);
      return result.success ? result.message : `Error: ${result.message}`;
    }

    const backups = rb.getBackupsForSkill(skillId);
    if (backups.length === 0) return `No backups found for "${skillId}".`;

    if (backups.length === 1) {
      const result = rb.rollback(skillId);
      return result.success ? result.message : `Error: ${result.message}`;
    }

    const lines = [`Multiple versions available for "${skillId}":`];
    backups.forEach((b, i) => lines.push(`  ${i + 1}. v${b.version} (${b.backedUpAt})`));
    lines.push('');
    lines.push('Specify version to rollback to a specific version.');
    return lines.join('\n');
  }

  private outdated(): string {
    const checker = new SkillUpdateChecker();
    const outdated = checker.findOutdated();
    if (outdated.length === 0) return 'All installed skills are up to date.';
    const lines = [`${outdated.length} update(s) available:`];
    for (const s of outdated) lines.push(`  ${s.id}: ${s.installedVersion} -> ${s.availableVersion}`);
    return lines.join('\n');
  }

  private conflicts(): string {
    const result = detectConflicts(this.skillsDir);
    if (!result.hasConflicts) return 'No conflicts detected between installed skills.';
    const lines = [`${result.conflicts.length} conflict(s) detected:`];
    for (const c of result.conflicts) {
      const icon = c.severity === 'error' ? '\u2717' : '\u26a0';
      lines.push(`  ${icon} ${c.type}: ${c.skill1} <-> ${c.skill2} — ${c.detail}`);
    }
    return lines.join('\n');
  }

  private sign(args: Record<string, unknown>): string {
    if (!this.isOperatorConfirmed(args)) {
      return [
        'Error: skill signing requires operator_confirm=true',
        '(or ZAVORTH_SKILL_OPERATOR_MODE=1). Signing is local package integrity, not CDN publish.',
      ].join(' ');
    }
    const skillDir = String(args.skill_dir || args.source || '').trim();
    const key = String(args.signing_key || args.token || process.env.ZAVORTH_SKILL_SIGNING_KEY || '').trim();
    if (!skillDir) return 'Error: "skill_dir" (or source) is required for sign.';
    if (!key) {
      return 'Error: provide signing_key / token or set ZAVORTH_SKILL_SIGNING_KEY (operator secret).';
    }
    const result = signSkillPackage(skillDir, key);
    return result.ok ? result.message : `Error: ${result.message}`;
  }

  private auth(args: Record<string, unknown>): string {
    if (!this.isOperatorConfirmed(args)) {
      return [
        'Error: auth token writes require operator_confirm=true',
        '(or ZAVORTH_SKILL_OPERATOR_MODE=1). Never pass secrets via agent free-text alone.',
      ].join(' ');
    }
    // Sub-action: prefer auth_op / subaction; args.action is already "auth".
    const op = String(args.auth_op || args.subaction || args.query || 'set')
      .trim()
      .toLowerCase();
    const host = String(args.host || args.skill_id || '').trim();
    const token = String(args.token || '').trim();
    if (!host) return 'Error: "host" is required.';
    if (op === 'remove' || op === 'delete') {
      removeAuthToken(process.cwd(), host);
      return `Removed auth for ${host}`;
    }
    if (!token) return 'Error: "token" is required for auth set (not source).';
    setAuthToken(process.cwd(), host, token);
    return `Auth token set for ${host} (stored in skill-marketplace auth store; not echoed).`;
  }

  private bundle(args: Record<string, unknown>): string {
    const bundleManager = new SkillBundleManager();
    const action = String(args.action || 'list').trim();
    if (action === 'list') {
      const bundles = bundleManager.listBundles();
      if (bundles.length === 0) return 'No bundles created.';
      return bundles.map((b) => `${b.id} ? ${b.name}: ${b.skills.join(', ')}`).join('\n');
    }
    if (action === 'create') {
      const id = String(args.skill_id || '').trim();
      const name = String(args.query || id).trim();
      const skills = String(args.source || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!id || skills.length === 0)
        return 'Error: "skill_id" (bundle id) and "source" (comma-separated skill names) required.';
      bundleManager.createBundle(id, name, '', skills);
      return `Bundle "${id}" created with ${skills.length} skill(s)`;
    }
    if (action === 'show') {
      const bundle = bundleManager.getBundle(String(args.skill_id || '').trim());
      if (!bundle) return 'Bundle not found.';
      return `${bundle.name} (${bundle.id}): ${bundle.skills.join(', ')}`;
    }
    return 'Unknown bundle action. Use: list, create, show';
  }

  private cleanup(dir: string): void {
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
