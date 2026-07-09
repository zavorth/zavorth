import fs from 'node:fs';
import path from 'node:path';
import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { formatCliSuccessEventCard } from './ZavorthCliEventCards.js';
import { SkillLocalRegistry } from '../skills/marketplace/SkillLocalRegistry.js';
import { SkillGitRegistry } from '../skills/marketplace/SkillGitRegistry.js';
import { validateSkillPackage } from '../skills/marketplace/SkillPackageValidator.js';
import { scanSkillForSecurity, recordAuditLog, getAuditLog, getSkillPermissions } from '../skills/marketplace/SkillMarketplaceSecurity.js';
import { SkillRollback } from '../skills/marketplace/SkillRollback.js';
import { SkillDependencyResolver } from '../skills/marketplace/SkillDependencyResolver.js';
import { detectSource, getSourceHint } from '../skills/marketplace/SkillSourceDetector.js';
import { SkillUpdateChecker } from '../skills/marketplace/SkillUpdateChecker.js';
import { detectConflicts } from '../skills/marketplace/SkillConflictDetector.js';
import { SkillBundleManager } from '../skills/marketplace/SkillBundle.js';
import { setAuthToken, removeAuthToken } from '../skills/marketplace/SkillAuth.js';
import { asErrorLike } from '../utils/errorLike';

function cleanup(dir: string): void {
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistrySkillsCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;

  if (commandName !== 'skill' && commandName !== 'skills') {
    return null;
  }

  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const subcommand = String(tokens[0] || '').trim().toLowerCase() || 'list';
  const rest = tokens.slice(1);
  const skillsDir = path.join(process.cwd(), 'skills');
  const registry = new SkillLocalRegistry();
  const gitRegistry = new SkillGitRegistry();

  if (subcommand === 'list') {
    return handleList(skillsDir, registry, writer);
  }
  if (subcommand === 'search') {
    return handleSearch(rest.join(' '), registry, writer);
  }
  if (subcommand === 'install') {
    return handleInstall(rest, skillsDir, registry, gitRegistry, writer);
  }
  if (subcommand === 'publish') {
    return handlePublish(rest, skillsDir, registry, gitRegistry, writer);
  }
  if (subcommand === 'info') {
    return handleInfo(rest, registry, writer);
  }
  if (subcommand === 'update') {
    return handleUpdate(rest, skillsDir, registry, gitRegistry, writer);
  }
  if (subcommand === 'rollback') {
    return handleRollback(rest, registry, writer);
  }
  if (subcommand === 'outdated') {
    return handleOutdated(writer);
  }
  if (subcommand === 'conflicts') {
    return handleConflicts(writer);
  }
  if (subcommand === 'auth') {
    return handleAuth(rest, writer);
  }
  if (subcommand === 'bundle') {
    return handleBundle(rest, writer);
  }
  if (subcommand === 'remove' || subcommand === 'uninstall') {
    return handleRemove(rest, skillsDir, registry, writer);
  }
  if (subcommand === 'audit') {
    return handleAudit(writer);
  }
  if (subcommand === 'browse') {
    return handleBrowse(rest, writer);
  }
  if (subcommand === 'scrape') {
    return handleScrape(rest, writer);
  }

  const helpText = [
    'Skills Marketplace:',
    '',
    '  zavorth skill list                          Installed skills',
    '  zavorth skill search <query>                Find skills',
    '  zavorth skill install <source>              Install from any source (URL, path, package)',
    '  zavorth skill install <url> --only <name>   Install one specific skill from repo',
    '  zavorth skill browse <query>                Browse skills from external sources',
    '  zavorth skill scrape <url>                  Scrape a webpage for skill info',
    '  zavorth skill publish <dir>                 Register local skill',
    '  zavorth skill info <id>                     Skill details',
    '  zavorth skill rollback <name>               Restore previous version',
    '  zavorth skill outdated                      Check for available updates',
    '  zavorth skill conflicts                     Detect conflicts between skills',
    '  zavorth skill auth <host> <token>           Set auth token for private repos',
    '  zavorth skill bundle list                   List skill bundles',
    '  zavorth skill bundle create <id> <name> <s> Create a bundle',
    '  zavorth skill remove <id>                   Uninstall',
    '  zavorth skill audit                         View security audit log',
  ].join('\n');
  writer.line(helpText);
  return { ok: true, handled: true, output: [helpText], error: null };
}

function handleList(skillsDir: string, registry: SkillLocalRegistry, writer: CliWriter): CliExecutionResult {
  const lines: string[] = [];

  const localSkills: string[] = [];
  if (fs.existsSync(skillsDir)) {
    for (const dir of fs.readdirSync(skillsDir)) {
      const fullPath = path.join(skillsDir, dir);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'SKILL.md'))) {
        localSkills.push(dir);
      }
    }
  }

  if (localSkills.length === 0 && registry.listInstalled().length === 0) {
    lines.push('No skills installed.');
    lines.push('');
    lines.push('Install a skill:  zavorth skill install <id>');
    lines.push('Browse available: zavorth skill search <query>');
    const body = lines.join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (localSkills.length > 0) {
    lines.push('Installed Skills:');
    lines.push('');
    for (const dir of localSkills) {
      try {
        const skillPath = path.join(skillsDir, dir, 'SKILL.md');
        const content = fs.readFileSync(skillPath, 'utf-8');
        const descMatch = content.match(/description:\s*(.+)/i);
        const description = descMatch ? descMatch[1].trim().replace(/['"]/g, '') : '';
        const manifestPath = path.join(skillsDir, dir, 'manifest.json');
        let version = '';
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          version = manifest.version ? ` v${manifest.version}` : '';
        }
        lines.push(`  ${dir}${version}${description ? ` - ${description}` : ''}`);
      } catch {
        lines.push(`  ${dir}`);
      }
    }
  }

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function trustIcon(level: string): string {
  switch (level) {
    case 'verified': return '\u2713';
    case 'trusted': return '\u25cb';
    case 'unknown': return '?';
    case 'suspicious': return '\u2717';
    default: return '?';
  }
}

function handleSearch(query: string, registry: SkillLocalRegistry, writer: CliWriter): CliExecutionResult {
  if (!query) {
    writer.error('Usage: zavorth skill search <query>');
    return { ok: false, handled: true, output: [], error: 'Missing query' };
  }

  const results = registry.search(query);
  const trustSummary = registry.getTrustSummary();
  const lines: string[] = [];

  if (results.length === 0) {
    lines.push(`No skills found for "${query}".`);
    lines.push('');
    lines.push('Try a different search term, or browse: zavorth skill search .');
  } else {
    lines.push(`Found ${results.length} skill(s) for "${query}" (${trustSummary.verified} verified, ${trustSummary.trusted} trusted):`);
    lines.push('');
    for (const s of results) {
      const installed = s.installedAt ? ' [installed]' : '';
      const trust = trustIcon(s.trustLevel);
      lines.push(`  ${trust} ${s.id} v${s.version} by ${s.author}${installed}`);
      lines.push(`    ${s.description}`);
      lines.push(`    Category: ${s.category} | Downloads: ${s.downloads} | Rating: ${s.rating.toFixed(1)} | Trust: ${s.trustLevel}`);
      lines.push('');
    }
  }

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

async function handleInstall(rest: string[], skillsDir: string, registry: SkillLocalRegistry, gitRegistry: SkillGitRegistry, writer: CliWriter): Promise<CliExecutionResult> {
  if (rest.length === 0) {
    writer.error('Usage: zavorth skill install <id|git-url|file-path> [skill-name]');
    return { ok: false, handled: true, output: [], error: 'Missing skill source' };
  }

  const source = rest[0];
  const installAll = rest.includes('--all');
  const specificSkill = rest.find((a) => !a.startsWith('--') && a !== source) || undefined;

  if (source.endsWith('.zip') || source.endsWith('.tar.gz') || source.endsWith('.tgz')) {
    const result = await gitRegistry.installFromUrl(source);
    if (result.success) {
      writer.line(formatCliSuccessEventCard({ title: 'Installed', body: result.message }));
      return { ok: true, handled: true, output: [result.message], error: null };
    }
    writer.error(result.message);
    return { ok: false, handled: true, output: [], error: result.message };
  }

  if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('git@') || source.startsWith('npm:')) {
    try {
      const { tmpDir, skills } = gitRegistry.discoverSkills(source);

      if (skills.length === 0) {
        cleanup(tmpDir);
        writer.error('No valid skills found in repository (missing SKILL.md or manifest.json)');
        return { ok: false, handled: true, output: [], error: 'No skills found' };
      }

      const onlySkill = rest.find((a) => a.startsWith('--only='))?.split('=')[1]
        || (rest.includes('--only') ? rest[rest.indexOf('--only') + 1] : undefined);

      const toInstall = onlySkill ? skills.filter((s) => s.name === onlySkill) : skills;
      if (toInstall.length === 0) {
        cleanup(tmpDir);
        writer.error(`Skill "${onlySkill}" not found in repository`);
        return { ok: false, handled: true, output: [], error: `Not found: ${onlySkill}` };
      }

      const depResolver = new SkillDependencyResolver();
      const lines: string[] = [];
      const dataDir = path.join(process.cwd(), 'data');

      if (installAll) {
        for (const s of toInstall) {
        const depCheck = depResolver.checkDependencies(s.dir);
        if (!depCheck.allResolved && depCheck.missing.length > 0) {
          lines.push(`  Dependencies for ${s.name}:`);
          for (const dep of depCheck.missing) {
            const status = dep.resolved ? 'auto-install' : 'not found';
            lines.push(`    - ${dep.name} (${dep.constraint}) [${status}]`);
          }
          if (depCheck.circular.length > 0) {
            lines.push(`  WARNING: Circular dependencies detected: ${depCheck.circular.join(', ')}`);
          }
          lines.push('');
        }

        const security = scanSkillForSecurity(s.dir);
        const permissions = getSkillPermissions(s.dir);

        if (security.riskLevel === 'blocked') {
          const blocking = security.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ');
          lines.push(`  BLOCKED: ${s.name} - ${blocking}`);
          recordAuditLog({ timestamp: new Date().toISOString(), action: 'install', skillId: s.name, version: s.version, source, riskLevel: security.riskLevel, issues: security.issues.length, user: 'cli', approved: false }, dataDir);
          continue;
        }

        if (security.riskLevel === 'high' || security.riskLevel === 'medium') {
          lines.push(`  WARNING [${security.riskLevel}]: ${s.name}`);
          for (const issue of security.issues.filter((i) => i.severity === 'warn' || i.severity === 'error')) {
            lines.push(`    - ${issue.message}`);
          }
          if (security.recommendations.length > 0) {
            lines.push(`    Recommendation: ${security.recommendations[0]}`);
          }
        }

        lines.push(`  Permissions: ${permissions.join(', ') || 'read-only'}`);
        lines.push(`  GPG verified: ${security.gpgVerified ? 'yes' : 'no'}`);

        const result = gitRegistry.installSkillFromDir(s.dir, source, s.name);
        if (result.success) {
          lines.push(`  ${result.message}`);
          recordAuditLog({ timestamp: new Date().toISOString(), action: 'install', skillId: s.name, version: s.version, source, riskLevel: security.riskLevel, issues: security.issues.length, user: 'cli', approved: true }, dataDir);
        } else {
          lines.push(`  Failed: ${s.name} - ${result.message}`);
          recordAuditLog({ timestamp: new Date().toISOString(), action: 'install', skillId: s.name, version: s.version, source, riskLevel: security.riskLevel, issues: security.issues.length, user: 'cli', approved: false }, dataDir);
        }
      }
        cleanup(tmpDir);
        const body = [`Installed ${lines.filter((r) => r.startsWith('  ')).length} skill(s):`, '', ...lines].join('\n');
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }

      if (skills.length === 1 || specificSkill) {
        const skillDir = specificSkill ? skills.find((s) => s.name === specificSkill)?.dir || skills[0].dir : skills[0].dir;
        const result = gitRegistry.installSkillFromDir(skillDir, source, specificSkill);
        cleanup(tmpDir);
        if (result.success) {
          writer.line(formatCliSuccessEventCard({ title: 'Installed', body: result.message }));
          return { ok: true, handled: true, output: [result.message], error: null };
        }
        writer.error(result.message);
        return { ok: false, handled: true, output: [], error: result.message };
      }

      lines.length = 0;
      lines.push(`Found ${skills.length} skills in repository:`);
      lines.push('');
      skills.forEach((s, i) => {
        lines.push(`  ${i + 1}. ${s.name} v${s.version}${s.description ? ` - ${s.description}` : ''}`);
      });
      lines.push('');
      lines.push('Install all:  zavorth skill install <url> --all');
      lines.push('Install one:  zavorth skill install <url> <skill-name>');
      lines.push('');
      lines.push('To install a specific skill, run:');
      for (const s of skills) {
        lines.push(`  zavorth skill install ${source} ${s.name}`);
      }

      cleanup(tmpDir);
      const body = lines.join('\n');
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    } catch (error: unknown) { const err = asErrorLike(error); const msg = `Git clone failed: ${err instanceof Error ? err.message : String(err)}`;
      writer.error(msg);
      return { ok: false, handled: true, output: [], error: msg };
    }
  }

  if (path.isAbsolute(source) || source.includes('/') || source.includes('\\')) {
    if (!fs.existsSync(source)) {
      writer.error(`Path not found: ${source}`);
      return { ok: false, handled: true, output: [], error: `Path not found: ${source}` };
    }
    const validation = validateSkillPackage(source);
    if (!validation.valid) {
      writer.error(`Invalid skill package: ${validation.errors.join(', ')}`);
      return { ok: false, handled: true, output: [], error: validation.errors.join(', ') };
    }
    const skillId = validation.manifest!.name;
    const targetDir = path.join(skillsDir, skillId);
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(source, targetDir, { recursive: true });
    registry.addEntry(validation.manifest!, 'file', source);
    registry.markInstalled(skillId);
    const msg = `Installed "${skillId}" v${validation.manifest!.version} from local path`;
    writer.line(formatCliSuccessEventCard({ title: 'Installed', body: msg }));
    return { ok: true, handled: true, output: [msg], error: null };
  }

  const entry = registry.getEntry(source);
  if (entry && entry.sourceUrl && entry.source === 'git') {
    const result = gitRegistry.installFromRepo(entry.sourceUrl, source);
    if (result.success) {
      writer.line(formatCliSuccessEventCard({ title: 'Installed', body: result.message }));
      return { ok: true, handled: true, output: [result.message], error: null };
    }
    writer.error(result.message);
    return { ok: false, handled: true, output: [], error: result.message };
  }

  const targetDir = path.join(skillsDir, source);
  if (fs.existsSync(targetDir)) {
    const msg = `Skill "${source}" is already installed at skills/${source}/`;
    writer.line(msg);
    return { ok: true, handled: true, output: [msg], error: null };
  }

  writer.error(`Skill "${source}" not found in registry. Install from a Git URL or local path.`);
  writer.line('  zavorth skill install https://github.com/user/repo');
  writer.line('  zavorth skill install /path/to/skill');
  return { ok: false, handled: true, output: [], error: `Unknown skill: ${source}` };
}

function handlePublish(rest: string[], skillsDir: string, registry: SkillLocalRegistry, gitRegistry: SkillGitRegistry, writer: CliWriter): CliExecutionResult {
  if (rest.length === 0) {
    writer.error('Usage: zavorth skill publish <skill-dir> [--repo <url>] [--output <dir>]');
    return { ok: false, handled: true, output: [], error: 'Missing skill directory' };
  }

  const skillDirName = rest[0];
  const repoIdx = rest.indexOf('--repo');
  const repoUrl = repoIdx >= 0 ? rest[repoIdx + 1] : undefined;
  const outputIdx = rest.indexOf('--output');
  const outputDir = outputIdx >= 0 ? rest[outputIdx + 1] : undefined;

  const localPath = path.join(skillsDir, skillDirName);
  if (!fs.existsSync(localPath)) {
    writer.error(`Skill directory not found: skills/${skillDirName}/`);
    return { ok: false, handled: true, output: [], error: `Not found: ${skillDirName}` };
  }

  const validation = validateSkillPackage(localPath);
  if (!validation.valid) {
    writer.error(`Cannot publish: ${validation.errors.join(', ')}`);
    return { ok: false, handled: true, output: [], error: validation.errors.join(', ') };
  }

  for (const warning of validation.warnings) {
    writer.line(`Warning: ${warning}`);
  }

  if (repoUrl) {
    const result = gitRegistry.publishToRepo(localPath, repoUrl);
    if (result.success) {
      writer.line(formatCliSuccessEventCard({ title: 'Published', body: result.message }));
      return { ok: true, handled: true, output: [result.message], error: null };
    }
    writer.error(result.message);
    return { ok: false, handled: true, output: [], error: result.message };
  }

  if (outputDir) {
    const targetDir = path.join(outputDir, validation.manifest!.name);
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(localPath, targetDir, { recursive: true });
    const msg = `Exported "${validation.manifest!.name}" v${validation.manifest!.version} to ${targetDir}`;
    writer.line(formatCliSuccessEventCard({ title: 'Exported', body: msg }));
    return { ok: true, handled: true, output: [msg], error: null };
  }

  registry.addEntry(validation.manifest!, 'local', null);
  const msg = `Registered "${validation.manifest!.name}" v${validation.manifest!.version} in local marketplace`;
  writer.line(formatCliSuccessEventCard({ title: 'Published', body: msg }));
  return { ok: true, handled: true, output: [msg], error: null };
}

function handleInfo(rest: string[], registry: SkillLocalRegistry, writer: CliWriter): CliExecutionResult {
  if (rest.length === 0) {
    writer.error('Usage: zavorth skill info <skill-id>');
    return { ok: false, handled: true, output: [], error: 'Missing skill id' };
  }

  const entry = registry.getEntry(rest[0]);
  if (!entry) {
    writer.error(`Skill "${rest[0]}" not found in marketplace.`);
    return { ok: false, handled: true, output: [], error: `Not found: ${rest[0]}` };
  }

  const depResolver = new SkillDependencyResolver();
  const installedDir = path.join(process.cwd(), 'skills', entry.id);
  const depCheck = fs.existsSync(installedDir) ? depResolver.checkDependencies(installedDir) : null;

  const lines = [
    `  Name:        ${entry.name}`,
    `  Version:     ${entry.version}`,
    `  Author:      ${entry.author}`,
    `  Description: ${entry.description}`,
    `  Category:    ${entry.category}`,
    `  Tags:        ${entry.tags.join(', ') || 'none'}`,
    `  Source:      ${entry.source}${entry.sourceUrl ? ` (${entry.sourceUrl})` : ''}`,
    `  Installed:   ${entry.installedAt || 'no'}`,
    `  Trust:       ${entry.trustLevel}`,
    depCheck ? `  Dependencies: ${depCheck.installed.length} installed, ${depCheck.missing.length} missing` : null,
    `  Downloads:   ${entry.downloads}`,
    `  Rating:      ${entry.rating.toFixed(1)}`,
    `  Checksum:    ${entry.checksum}`,
  ];

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function handleUpdate(rest: string[], skillsDir: string, registry: SkillLocalRegistry, gitRegistry: SkillGitRegistry, writer: CliWriter): CliExecutionResult {
  if (rest.length === 0) {
    writer.error('Usage: zavorth skill update <skill-id>');
    return { ok: false, handled: true, output: [], error: 'Missing skill id' };
  }

  const entry = registry.getEntry(rest[0]);
  if (!entry) {
    writer.error(`Skill "${rest[0]}" not found in marketplace.`);
    return { ok: false, handled: true, output: [], error: `Not found: ${rest[0]}` };
  }

  if (!entry.installedAt) {
    writer.error(`Skill "${rest[0]}" is not installed.`);
    return { ok: false, handled: true, output: [], error: 'Not installed' };
  }

  if (entry.source === 'git' && entry.sourceUrl) {
    const result = gitRegistry.installFromRepo(entry.sourceUrl, entry.id);
    if (result.success) {
      writer.line(formatCliSuccessEventCard({ title: 'Updated', body: result.message }));
      return { ok: true, handled: true, output: [result.message], error: null };
    }
    writer.error(result.message);
    return { ok: false, handled: true, output: [], error: result.message };
  }

  const msg = `Skill "${entry.id}" is a local skill. Update manually by re-running: zavorth skill publish ${entry.id}`;
  writer.line(msg);
  return { ok: true, handled: true, output: [msg], error: null };
}

function handleOutdated(writer: CliWriter): CliExecutionResult {
  const checker = new SkillUpdateChecker();
  const outdated = checker.findOutdated();

  if (outdated.length === 0) {
    writer.line('All installed skills are up to date.');
    return { ok: true, handled: true, output: ['All up to date.'], error: null };
  }

  const lines = [`${outdated.length} skill(s) have updates available:`];
  lines.push('');
  for (const s of outdated) {
    lines.push(`  ${s.id}: ${s.installedVersion} -> ${s.availableVersion}`);
    lines.push(`    Update: zavorth skill update ${s.id}`);
  }

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function handleConflicts(writer: CliWriter): CliExecutionResult {
  const skillsDir = path.join(process.cwd(), 'skills');
  if (!fs.existsSync(skillsDir)) {
    writer.line('No skills directory found.');
    return { ok: true, handled: true, output: ['No skills.'], error: null };
  }

  const result = detectConflicts(skillsDir);
  if (!result.hasConflicts) {
    writer.line('No conflicts detected between installed skills.');
    return { ok: true, handled: true, output: ['No conflicts.'], error: null };
  }

  const lines = [`${result.conflicts.length} conflict(s) detected:`];
  lines.push('');
  for (const c of result.conflicts) {
    const icon = c.severity === 'error' ? '\u2717' : '\u26a0';
    lines.push(`  ${icon} ${c.type}: ${c.skill1} <-> ${c.skill2}`);
    lines.push(`    ${c.detail}`);
  }

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function handleAuth(rest: string[], writer: CliWriter): CliExecutionResult {
  if (rest.length < 2) {
    writer.error('Usage: zavorth skill auth <host> <token> | zavorth skill auth remove <host>');
    return { ok: false, handled: true, output: [], error: 'Missing arguments' };
  }

  const action = rest[0];
  const host = rest[1];

  if (action === 'remove') {
    removeAuthToken(process.cwd(), host);
    writer.line(`Removed auth token for ${host}`);
    return { ok: true, handled: true, output: [`Removed auth for ${host}`], error: null };
  }

  setAuthToken(process.cwd(), host, rest[2] || '');
  writer.line(`Auth token set for ${host}`);
  return { ok: true, handled: true, output: [`Auth set for ${host}`], error: null };
}

function handleBundle(rest: string[], writer: CliWriter): CliExecutionResult {
  const bundleManager = new SkillBundleManager();
  const action = rest[0] || 'list';

  if (action === 'list') {
    const bundles = bundleManager.listBundles();
    if (bundles.length === 0) {
      writer.line('No bundles created yet.');
      writer.line('Create one: zavorth skill bundle create <id> <name> <skill1,skill2,...>');
      return { ok: true, handled: true, output: ['No bundles.'], error: null };
    }
    const lines = ['Bundles:'];
    for (const b of bundles) {
      lines.push(`  ${b.id} - ${b.name}: ${b.skills.join(', ')}`);
    }
    const body = lines.join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (action === 'create' && rest.length >= 3) {
    const id = rest[1];
    const name = rest[2];
    const skillIds = rest[3]?.split(',') || [];
    const bundle = bundleManager.createBundle(id, name, '', skillIds);
    writer.line(`Bundle "${bundle.id}" created with ${bundle.skills.length} skill(s)`);
    return { ok: true, handled: true, output: [`Bundle created: ${bundle.id}`], error: null };
  }

  if (action === 'show' && rest[1]) {
    const bundle = bundleManager.getBundle(rest[1]);
    if (!bundle) {
      writer.error(`Bundle "${rest[1]}" not found.`);
      return { ok: false, handled: true, output: [], error: `Not found: ${rest[1]}` };
    }
    const lines = [`Bundle: ${bundle.name} (${bundle.id})`, `Skills: ${bundle.skills.join(', ')}`];
    const body = lines.join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  writer.error('Usage: zavorth skill bundle list | create <id> <name> <skills> | show <id>');
  return { ok: false, handled: true, output: [], error: 'Invalid bundle command' };
}

function handleAudit(writer: CliWriter): CliExecutionResult {
  const dataDir = path.join(process.cwd(), 'data');
  const entries = getAuditLog(dataDir, 20);

  if (entries.length === 0) {
    writer.line('No audit entries yet. Install some skills first.');
    return { ok: true, handled: true, output: ['No audit entries.'], error: null };
  }

  const lines = [`Last ${entries.length} audit entries:`];
  lines.push('');
  for (const e of entries.reverse()) {
    const status = e.approved ? '\u2713' : '\u2717';
    lines.push(`  ${status} [${e.timestamp}] ${e.action} "${e.skillId}" v${e.version}`);
    lines.push(`    Source: ${e.source} | Risk: ${e.riskLevel} | Issues: ${e.issues}`);
  }

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function handleRollback(rest: string[], registry: SkillLocalRegistry, writer: CliWriter): CliExecutionResult {
  if (rest.length === 0) {
    const rollback = new SkillRollback();
    const backups = rollback.listBackups();
    if (backups.length === 0) {
      writer.line('No backups available for rollback.');
      return { ok: true, handled: true, output: ['No backups.'], error: null };
    }
    const lines = ['Available backups:'];
    for (const b of backups) {
      lines.push(`  ${b.skillId} v${b.version} (${b.backedUpAt})`);
    }
    lines.push('');
    lines.push('Usage: zavorth skill rollback <skill-name>');
    lines.push('       zavorth skill rollback <skill-name> --version <version>');
    const body = lines.join('\n');
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const rollback = new SkillRollback();
  const query = rest[0];
  const versionFlag = rest.indexOf('--version');
  const targetVersion = versionFlag >= 0 ? rest[versionFlag + 1] : undefined;

  const skillId = rollback.findSkillByName(query) || registry.getEntry(query)?.id || query;

  if (targetVersion) {
    const result = rollback.rollbackToVersion(skillId, targetVersion);
    if (result.success) {
      writer.line(formatCliSuccessEventCard({ title: 'Rolled back', body: result.message }));
      return { ok: true, handled: true, output: [result.message], error: null };
    }
    writer.error(result.message);
    return { ok: false, handled: true, output: [], error: result.message };
  }

  const backups = rollback.getBackupsForSkill(skillId);
  if (backups.length === 0) {
    writer.error(`No backups found for "${skillId}".`);
    return { ok: false, handled: true, output: [], error: `No backups: ${skillId}` };
  }

  if (backups.length === 1) {
    const result = rollback.rollback(skillId);
    if (result.success) {
      writer.line(formatCliSuccessEventCard({ title: 'Rolled back', body: result.message }));
      return { ok: true, handled: true, output: [result.message], error: null };
    }
    writer.error(result.message);
    return { ok: false, handled: true, output: [], error: result.message };
  }

  const lines = [`Multiple versions available for "${skillId}":`];
  lines.push('');
  backups.forEach((b, i) => {
    lines.push(`  ${i + 1}. v${b.version} (${b.backedUpAt})`);
  });
  lines.push('');
  lines.push('Pick a version:');
  for (const b of backups) {
    lines.push(`  zavorth skill rollback ${skillId} --version ${b.version}`);
  }

  const body = lines.join('\n');
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function handleRemove(rest: string[], skillsDir: string, registry: SkillLocalRegistry, writer: CliWriter): CliExecutionResult {
  if (rest.length === 0) {
    writer.error('Usage: zavorth skill remove <skill-id>');
    return { ok: false, handled: true, output: [], error: 'Missing skill id' };
  }

  const skillId = rest[0];
  const resolvedSkillsDir = path.resolve(skillsDir);
  const targetDir = path.resolve(path.join(skillsDir, skillId));
  if (!targetDir.startsWith(resolvedSkillsDir + path.sep) && targetDir !== resolvedSkillsDir) {
    writer.error(`Refusing to remove path outside skills directory: ${skillId}`);
    return { ok: false, handled: true, output: [], error: 'Path traversal blocked' };
  }
  if (!fs.existsSync(targetDir)) {
    writer.error(`Skill "${skillId}" is not installed.`);
    return { ok: false, handled: true, output: [], error: 'Not installed' };
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  registry.markUninstalled(skillId);
  const msg = `Removed "${skillId}" from skills/`;
  writer.line(formatCliSuccessEventCard({ title: 'Removed', body: msg }));
  return { ok: true, handled: true, output: [msg], error: null };
}

async function handleBrowse(rest: string[], writer: CliWriter): Promise<CliExecutionResult> {
  const query = rest.join(' ').trim();
  if (!query) {
    writer.error('Usage: zavorth skill browse <query>');
    writer.line('');
    writer.line('Examples:');
    writer.line('  zavorth skill browse obsidian');
    writer.line('  zavorth skill browse "data analysis tool"');
    writer.line('  zavorth skill browse web scraping');
    return { ok: false, handled: true, output: [], error: 'Missing query' };
  }

  const { SkillBrowserService } = await import('../skills/marketplace/SkillBrowserService.js');
  const { SkillAutoApproval } = await import('../skills/marketplace/SkillAutoApproval.js');

  const dataDir = path.join(process.cwd(), 'data', 'runtime', 'skill-browser');
  const browser = new SkillBrowserService({ dataDir });
  const autoApproval = new SkillAutoApproval({ dataDir: path.join(process.cwd(), 'data', 'runtime', 'skill-approval') });

  // Add default sources
  browser.addSource({
    id: 'github-zavorth-skills',
    name: 'GitHub Zavorth Skills',
    type: 'github-topic',
    baseUrl: 'https://api.github.com',
    config: { topic: 'zavorth-skill' },
    enabled: true,
    priority: 1,
  });

  browser.addSource({
    id: 'npm-zavorth-skills',
    name: 'npm Zavorth Skills',
    type: 'npm-registry',
    baseUrl: 'https://registry.npmjs.org',
    enabled: true,
    priority: 2,
  });

  writer.line(`Browsing skills for: "${query}"`);

  const result = await browser.search({
    query,
    useSemanticMatch: true,
    totalLimit: 20,
  });

  if (result.entries.length === 0) {
    writer.line('No skills found.');
    if (result.sourcesFailed.length > 0) {
      writer.line('');
      writer.line('Sources that failed:');
      for (const failed of result.sourcesFailed) {
        writer.line(`  - ${failed.sourceId}: ${failed.error}`);
      }
    }
    return { ok: true, handled: true, output: ['No skills found'], error: null };
  }

  writer.line('');
  writer.line(`Found ${result.entries.length} skills (${result.durationMs}ms):`);
  writer.line('');

  for (const entry of result.entries.slice(0, 10)) {
    const approval = autoApproval.evaluateApproval({
      id: entry.id,
      sourceUrl: entry.installUrl,
      publisher: entry.author,
    });

    const statusIcon = approval.autoApproved ? '✅' : '⏳';
    writer.line(`  ${statusIcon} ${entry.name} v${entry.version}`);
    writer.line(`     ${entry.description.slice(0, 80)}${entry.description.length > 80 ? '...' : ''}`);
    writer.line(`     Author: ${entry.author} | Tags: ${entry.tags.slice(0, 3).join(', ')}`);
    writer.line(`     Install: ${entry.installUrl}`);
    if (approval.autoApproved) {
      writer.line(`     Auto-approved: ${approval.reason}`);
    } else {
      writer.line(`     Requires approval: ${approval.reason}`);
    }
    writer.line('');
  }

  if (result.entries.length > 10) {
    writer.line(`... and ${result.entries.length - 10} more skills.`);
  }

  return { ok: true, handled: true, output: [`${result.entries.length} skills found`], error: null };
}

async function handleScrape(rest: string[], writer: CliWriter): Promise<CliExecutionResult> {
  const url = rest[0]?.trim();
  if (!url) {
    writer.error('Usage: zavorth skill scrape <url>');
    writer.line('');
    writer.line('Examples:');
    writer.line('  zavorth skill scrape https://skillsmp.com/pt/creators/openclaw/openclaw/skills-obsidian');
    writer.line('  zavorth skill scrape https://github.com/user/repo');
    return { ok: false, handled: true, output: [], error: 'Missing URL' };
  }

  const { SkillWebScraper } = await import('../skills/marketplace/SkillWebScraper.js');
  const { SkillAutoApproval } = await import('../skills/marketplace/SkillAutoApproval.js');

  const scraper = new SkillWebScraper();
  const autoApproval = new SkillAutoApproval({ dataDir: path.join(process.cwd(), 'data', 'runtime', 'skill-approval') });

  writer.line(`Scraping: ${url}`);

  const result = await scraper.scrape(url);

  if (!result.success) {
    writer.error(`Scraping failed: ${result.error}`);
    return { ok: false, handled: true, output: [], error: result.error || 'Scraping failed' };
  }

  const skill = result.skill;
  if (!skill) {
    writer.line('No skill information found on this page.');
    return { ok: true, handled: true, output: ['No skill info found'], error: null };
  }

  writer.line('');
  writer.line('=== Scraped Skill Information ===');
  writer.line('');
  writer.line(`Name: ${skill.name}`);
  writer.line(`Description: ${skill.description || 'N/A'}`);
  writer.line(`Author: ${skill.author}`);
  writer.line(`Tags: ${skill.tags.join(', ') || 'N/A'}`);
  writer.line(`Source: ${skill.sourceUrl}`);

  if (skill.installUrls.length > 0) {
    writer.line('');
    writer.line('Install URLs found:');
    for (const installUrl of skill.installUrls) {
      const approval = autoApproval.evaluateApproval({
        id: skill.name.toLowerCase().replace(/\s+/g, '-'),
        sourceUrl: installUrl.url,
        publisher: skill.author,
      });

      const statusIcon = approval.autoApproved ? '✅' : '⏳';
      writer.line(`  ${statusIcon} [${installUrl.type}] ${installUrl.label}`);
      writer.line(`     URL: ${installUrl.url}`);
      if (approval.autoApproved) {
        writer.line(`     Auto-approved: ${approval.reason}`);
      } else {
        writer.line(`     Requires approval: ${approval.reason}`);
      }
    }
  }

  if (Object.keys(skill.metadata).length > 0) {
    writer.line('');
    writer.line('Metadata:');
    for (const [key, value] of Object.entries(skill.metadata)) {
      writer.line(`  ${key}: ${value}`);
    }
  }

  writer.line('');
  writer.line('To install, use: zavorth skill install <install-url>');

  return { ok: true, handled: true, output: [JSON.stringify(skill)], error: null };
}
