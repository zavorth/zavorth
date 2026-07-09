import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { SkillLocalRegistry } from '../skills/marketplace/SkillLocalRegistry.js';
import { SkillGitRegistry } from '../skills/marketplace/SkillGitRegistry.js';
import { validateSkillPackage } from '../skills/marketplace/SkillPackageValidator.js';
import { searchGitHubReposBroad } from '../skills/marketplace/SkillGitHubSearch.js';
import { scanSkillForSecurity, getSkillPermissions, recordAuditLog } from '../skills/marketplace/SkillMarketplaceSecurity.js';
import { SkillRollback } from '../skills/marketplace/SkillRollback.js';
import { SkillDependencyResolver } from '../skills/marketplace/SkillDependencyResolver.js';
import { detectSource, getSourceHint } from '../skills/marketplace/SkillSourceDetector.js';
import { SkillUpdateChecker } from '../skills/marketplace/SkillUpdateChecker.js';
import { detectConflicts } from '../skills/marketplace/SkillConflictDetector.js';
import { SkillBundleManager } from '../skills/marketplace/SkillBundle.js';
import { setAuthToken, removeAuthToken } from '../skills/marketplace/SkillAuth.js';
import { asErrorLike } from '../utils/errorLike';

export class ZavorthSkillMarketplaceTool extends BaseTool {
  public readonly name = 'zavorth_skill_marketplace';

  public readonly description =
    'Skill Marketplace — discover, install, publish, and manage Zavorth skills. Install from any source: Git repos (GitHub, GitLab, Bitbucket), zip/tarball URLs, npm packages, skill registries, local paths, or local files. Skills are directories with any markdown instruction file + optional JSON metadata. The agent auto-detects the source type and handles it accordingly.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'search', 'list', 'install', 'publish', 'info', 'remove', 'update', 'rollback', 'outdated', 'conflicts', 'auth', 'bundle'.",
      },
      query: {
        type: 'string',
        description: 'Search query for skills.',
      },
      skill_id: {
        type: 'string',
        description: 'Skill ID (for install/info/remove/update).',
      },
      source: {
        type: 'string',
        description: 'Source URL or path for install/publish (Git URL or local path).',
      },
      skill_dir: {
        type: 'string',
        description: 'Local skill directory path for publish.',
      },
      repo_url: {
        type: 'string',
        description: 'Git repository URL for publish.',
      },
      install_all: {
        type: 'boolean',
        description: 'Install all skills from a multi-skill repository. Default: false.',
      },
      category: {
        type: 'string',
        description: "Filter by category: 'coding', 'research', 'creative', 'devops', 'security', 'data', 'automation', 'communication', 'productivity', 'other'.",
      },
    },
    required: ['action'],
  };

  private readonly registry: SkillLocalRegistry;
  private readonly gitRegistry: SkillGitRegistry;
  private readonly depResolver: SkillDependencyResolver;
  private readonly skillsDir: string;

  constructor(options?: { dataDir?: string }) {
    super();
    this.registry = new SkillLocalRegistry(options);
    this.gitRegistry = new SkillGitRegistry(options);
    this.depResolver = new SkillDependencyResolver(options);
    this.skillsDir = path.join(process.cwd(), 'skills');
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '').trim().toLowerCase();
    switch (action) {
      case 'search': return this.search(args);
      case 'list': return this.list(args);
      case 'install': return this.install(args);
      case 'publish': return this.publish(args);
      case 'info': return this.info(args);
      case 'remove': return this.remove(args);
      case 'update': return this.update(args);
      case 'rollback': return this.rollback(args);
      case 'outdated': return this.outdated();
      case 'conflicts': return this.conflicts();
      case 'auth': return this.auth(args);
      case 'bundle': return this.bundle(args);
      default:
        return `Unknown action "${action}". Available: search, list, install, publish, info, remove, update, rollback, outdated, conflicts, auth, bundle`;
    }
  }

  private search(args: Record<string, unknown>): string {
    const query = String(args.query || '').trim();
    const category = String(args.category || '').trim() || undefined;
    const remote = args.remote === true;
    if (!query) return 'Error: "query" is required for search.';

    const results = this.registry.search(query, category ? { category } : undefined);
    const lines: string[] = [];

    if (results.length > 0) {
      const trustSummary = this.registry.getTrustSummary();
      lines.push(`Local: ${results.length} skill(s) (${trustSummary.verified} verified, ${trustSummary.trusted} trusted):`);
      lines.push('');
      for (const s of results) {
        const installed = s.installedAt ? ' [installed]' : '';
        lines.push(`  ${s.id} v${s.version} by ${s.author}${installed}`);
        lines.push(`    ${s.description}`);
        lines.push(`    Tags: ${s.tags.join(', ') || 'none'} | Trust: ${s.trustLevel}`);
        lines.push('');
      }
    }

    if (remote || results.length === 0) {
      searchGitHubReposBroad(query).then((repos) => {
        if (repos.length > 0) {
          lines.push(`GitHub: ${repos.length} repository(ies) found:`);
          for (const r of repos) {
            lines.push(`  ${r.fullName} (${r.stars} stars)`);
            lines.push(`    ${r.description}`);
            lines.push(`    Install: zavorth skill install ${r.url}`);
            lines.push('');
          }
        }
      });
    }

    if (results.length === 0 && !remote) {
      lines.push(`No local skills for "${query}". Use remote: true to search GitHub.`);
    }

    return lines.join('\n');
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

  private install(args: Record<string, unknown>): string {
    const source = String(args.source || args.skill_id || '').trim();
    const installAll = args.install_all === true;
    const force = args.force === true;
    const onlySkill = String(args.skill_id || '').trim() || undefined;
    if (!source) return 'Error: "source" is required (URL, path, package name, or skill ID).';

    const detected = detectSource(source);
    if (detected.type === 'local-path' || detected.type === 'local-file' || detected.type === 'registry-url' || detected.type === 'npm-package') {
      this.gitRegistry.installFromSource(source, onlySkill).then((r: any) => {
        if (!r.success) console.error(r.message);
      });
      return `Installing from ${detected.type}: ${getSourceHint(detected.type)}`;
    }

    if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('git@')) {
      try {
        const { tmpDir, skills } = this.gitRegistry.discoverSkills(source);
        if (skills.length === 0) { this.cleanup(tmpDir); return 'No valid skills found in repository.'; }

        const results: string[] = [];
        const toInstall = installAll ? skills : skills.length === 1 ? skills : [];

        if (!installAll && skills.length > 1) {
          this.cleanup(tmpDir);
          const lines = [`Found ${skills.length} skills in repository:`];
          for (const s of skills) lines.push(`  - ${s.name} v${s.version}${s.description ? `: ${s.description}` : ''}`);
          lines.push('');
          lines.push('Use install_all: true to install all, or specify skill_id to install one.');
          return lines.join('\n');
        }

        const depResolver = new SkillDependencyResolver();

        for (const s of toInstall) {
          const depCheck = depResolver.checkDependencies(s.dir);
          if (!depCheck.allResolved && depCheck.missing.length > 0) {
            results.push(`  Dependencies for ${s.name}:`);
            for (const dep of depCheck.missing) {
              const status = dep.resolved ? 'auto-install' : 'not found';
              results.push(`    - ${dep.name} (${dep.constraint}) [${status}]`);
            }
            if (depCheck.circular.length > 0) {
              results.push(`  WARNING: Circular dependencies: ${depCheck.circular.join(', ')}`);
            }
            results.push('');
          }

          const security = scanSkillForSecurity(s.dir);
          const permissions = getSkillPermissions(s.dir);

          if (security.riskLevel === 'blocked' && !force) {
            const blocking = security.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ');
            results.push(`  BLOCKED: ${s.name} - ${blocking}`);
            results.push(`  Use force: true to override (NOT recommended).`);
            continue;
          }

          if (security.riskLevel === 'high' || security.riskLevel === 'medium') {
            results.push(`  SECURITY WARNING [${security.riskLevel}]: ${s.name}`);
            for (const issue of security.issues.filter((i) => i.severity === 'warn' || i.severity === 'error')) {
              results.push(`    - ${issue.message}`);
            }
            if (security.recommendations.length > 0) {
              results.push(`    Recommendation: ${security.recommendations[0]}`);
            }
            results.push(`    Permissions: ${permissions.join(', ') || 'read-only'}`);
            results.push(`    Install this skill? (user must confirm)`);
          }

          const r = this.gitRegistry.installSkillFromDir(s.dir, source, s.name);
          if (r.success) {
            results.push(`  Installed: ${r.message}`);
            recordAuditLog({ timestamp: new Date().toISOString(), action: 'install', skillId: s.name, version: s.version, source, riskLevel: security.riskLevel, issues: security.issues.length, user: 'agent', approved: true }, path.join(process.cwd(), 'data'));
          } else {
            results.push(`  Failed: ${r.message}`);
          }
        }

        this.cleanup(tmpDir);
        return [`Installed ${results.filter((r) => r.includes('Installed')).length} skill(s):`, '', ...results].join('\n');
      } catch (error: unknown) { const err = asErrorLike(error); return `Git clone failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    const entry = this.registry.getEntry(source);
    if (entry && entry.sourceUrl && entry.source === 'git') {
      const r = this.gitRegistry.installFromRepo(entry.sourceUrl, source);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    const targetDir = path.join(this.skillsDir, source);
    if (fs.existsSync(targetDir)) return `Skill "${source}" is already installed at skills/${source}/`;
    return `Skill "${source}" not found. Provide a Git URL or local path to install.`;
  }

  private publish(args: Record<string, unknown>): string {
    const skillDir = String(args.skill_dir || '').trim();
    const repoUrl = String(args.repo_url || '').trim() || undefined;
    if (!skillDir) return 'Error: "skill_dir" is required for publish.';

    const localPath = path.resolve(skillDir);
    if (!fs.existsSync(localPath)) return `Directory not found: ${skillDir}`;

    const validation = validateSkillPackage(localPath);
    if (!validation.valid || !validation.manifest) return `Cannot publish: ${validation.errors.join(', ')}`;

    if (repoUrl) {
      const r = this.gitRegistry.publishToRepo(localPath, repoUrl);
      return r.success ? r.message : `Error: ${r.message}`;
    }

    this.registry.addEntry(validation.manifest, 'local', null);
    return `Registered "${validation.manifest.name}" v${validation.manifest.version} in local marketplace.`;
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
    const id = String(args.skill_id || '').trim();
    if (!id) return 'Error: "skill_id" is required.';

    const targetDir = path.join(this.skillsDir, id);
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

  private auth(args: Record<string, unknown>): string {
    const action = String(args.action || '').trim();
    const host = String(args.host || args.skill_id || '').trim();
    const token = String(args.token || args.source || '').trim();
    if (!host) return 'Error: "host" is required.';
    if (action === 'remove') { removeAuthToken(process.cwd(), host); return `Removed auth for ${host}`; }
    setAuthToken(process.cwd(), host, token);
    return `Auth token set for ${host}`;
  }

  private bundle(args: Record<string, unknown>): string {
    const bundleManager = new SkillBundleManager();
    const action = String(args.action || 'list').trim();
    if (action === 'list') {
      const bundles = bundleManager.listBundles();
      if (bundles.length === 0) return 'No bundles created.';
      return bundles.map((b) => `${b.id} - ${b.name}: ${b.skills.join(', ')}`).join('\n');
    }
    if (action === 'create') {
      const id = String(args.skill_id || '').trim();
      const name = String(args.query || id).trim();
      const skills = String(args.source || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!id || skills.length === 0) return 'Error: "skill_id" (bundle id) and "source" (comma-separated skill names) required.';
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
    try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
