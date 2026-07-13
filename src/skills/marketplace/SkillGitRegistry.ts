import { execFileSync } from 'node:child_process';
import { asErrorLike } from '../../utils/errorLike';
import {
  MARKETPLACE_ALLOWED_BINARIES,
  safeExecFile,
} from '../../security/SafeProcessExec.js';

function safeExec(cmd: string, args: string[], opts: { stdio?: string; timeout?: number } = {}): void {
  // S3: execFile + binary allowlist + metachar rejection (never shell:true).
  safeExecFile(cmd, args, {
    stdio: (opts.stdio as 'pipe' | 'ignore' | 'inherit') || 'pipe',
    timeout: opts.timeout || 30000,
    allowedBinaries: MARKETPLACE_ALLOWED_BINARIES,
  });
}

function sanitizeSkillId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unnamed-skill';
}
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { safeFetch } from '../../security/SafeFetchService.js';
import { validateSkillPackage, computeSkillChecksum } from './SkillPackageValidator.js';
import { scanSkillForSecurity, recordAuditLog, type SecurityScanResult } from './SkillMarketplaceSecurity.js';
import { SkillRollback } from './SkillRollback.js';
import { SkillLocalRegistry } from './SkillLocalRegistry.js';
import { detectSource, getSourceHint, type SourceType } from './SkillSourceDetector.js';
import { buildGitCloneUrl, getGitPasswordEnv } from './SkillAuth.js';
import type { SkillInstallResult, SkillPublishResult } from './SkillPackageTypes.js';

const DEFAULT_TRUSTED_DOMAINS = ['github.com', 'gitlab.com', 'bitbucket.org', 'npmjs.org', 'npmjs.com'];
const MAX_SKILL_ARCHIVE_BYTES = 64 * 1024 * 1024;

/** Default + env extras: ZAVORTH_SKILL_TRUSTED_DOMAINS=host1,host2 */
export function getTrustedSkillGitDomains(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const extra = String(env.ZAVORTH_SKILL_TRUSTED_DOMAINS || '')
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_TRUSTED_DOMAINS, ...extra]));
}

/** Shared host policy for all git clone / registry fetch paths. */
export function assertTrustedGitSource(
  repoUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; message: string } {
  const trusted = getTrustedSkillGitDomains(env);
  const raw = String(repoUrl || '').trim();
  if (!raw) return { ok: false, message: 'Rejected: empty git source.' };
  const sshMatch = raw.match(/^git@([^:]+):/);
  if (sshMatch) {
    const host = sshMatch[1].replace(/^www\./, '').toLowerCase();
    if (!trusted.includes(host)) {
      return {
        ok: false,
        message: `Rejected: host "${host}" is not in the trusted domains list (${trusted.join(', ')})`,
      };
    }
    return { ok: true };
  }
  try {
    const parsedUrl = new URL(raw);
    if (parsedUrl.protocol !== 'https:') {
      return {
        ok: false,
        message: `Rejected: only HTTPS URLs are allowed. Got ${parsedUrl.protocol}//`,
      };
    }
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
    if (!trusted.includes(host)) {
      return {
        ok: false,
        message: `Rejected: host "${host}" is not in the trusted domains list (${trusted.join(', ')})`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: `Rejected: invalid git/registry URL: ${raw}` };
  }
}

function validateArchiveBeforeExtraction(archivePath: string): void {
  const listing = execFileSync('tar', ['-tf', archivePath], { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
  const entries = listing.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0 || entries.length > 5_000) throw new Error('Unsafe or oversized skill archive index');
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)
      || normalized.split('/').some((segment) => segment === '..')) {
      throw new Error(`Unsafe skill archive entry: ${entry}`);
    }
  }
  const verbose = execFileSync('tar', ['-tvf', archivePath], { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
  if (verbose.split(/\r?\n/).some((line) => /^[lh]/.test(line.trim()))) {
    throw new Error('Skill archives containing links are not allowed');
  }
}

export class SkillGitRegistry {
  private readonly registry: SkillLocalRegistry;

  constructor(options?: { dataDir?: string }) {
    this.registry = new SkillLocalRegistry(options);
  }

  discoverSkills(repoUrl: string): { tmpDir: string; skills: Array<{ dir: string; name: string; version: string; description: string }> } {
    const trust = assertTrustedGitSource(repoUrl);
    if (!trust.ok) {
      throw new Error(trust.message);
    }
    const tmpDir = path.join(os.tmpdir(), `zavorth-skill-${Date.now()}`);
    safeExec('git', ['clone', '--depth', '1', repoUrl, tmpDir]);
    const skills = this.findAllSkills(tmpDir);
    return { tmpDir, skills };
  }

  installSkillFromDir(skillDir: string, repoUrl: string, targetName?: string): SkillInstallResult {
    try {
      const validation = validateSkillPackage(skillDir);
      if (!validation.valid) {
        return { success: false, skillId: '', installedPath: '', message: `Invalid skill package: ${validation.errors.join(', ')}` };
      }

      const security = scanSkillForSecurity(skillDir);
      if (security.riskLevel === 'blocked') {
        const blocking = security.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ');
        const dataDir = path.join(process.cwd(), 'data', 'runtime', 'skill-marketplace');
        recordAuditLog({
          timestamp: new Date().toISOString(),
          action: 'install',
          skillId: sanitizeSkillId(targetName || validation.manifest!.name),
          version: validation.manifest!.version,
          source: repoUrl,
          riskLevel: security.riskLevel,
          issues: security.issues.length,
          user: process.env.USER || process.env.USERNAME || 'unknown',
          approved: false,
        }, dataDir);
        return { success: false, skillId: '', installedPath: '', message: `Security check blocked: ${blocking}` };
      }

      const skillId = sanitizeSkillId(targetName || validation.manifest!.name);
      const targetDir = path.join(process.cwd(), 'skills', skillId);

      const resolvedTarget = path.resolve(targetDir);
      const skillsRoot = path.resolve(path.join(process.cwd(), 'skills'));
      if (!resolvedTarget.startsWith(skillsRoot + path.sep) && resolvedTarget !== skillsRoot) {
        return { success: false, skillId: '', installedPath: '', message: `Path traversal detected in skill name "${skillId}".` };
      }

      if (fs.existsSync(targetDir)) {
        const rollback = new SkillRollback();
        rollback.createBackup(targetDir, skillId, 'previous');
      }

      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.cpSync(skillDir, targetDir, { recursive: true });

      this.registry.addEntry(validation.manifest!, 'git', repoUrl);
      this.registry.markInstalled(skillId);

      const dataDir = path.join(process.cwd(), 'data', 'runtime', 'skill-marketplace');
      recordAuditLog({
        timestamp: new Date().toISOString(),
        action: 'install',
        skillId,
        version: validation.manifest!.version,
        source: repoUrl,
        riskLevel: security.riskLevel,
        issues: security.issues.length,
        user: process.env.USER || process.env.USERNAME || 'unknown',
        approved: true,
      }, dataDir);

      return { success: true, skillId, installedPath: targetDir, message: `Installed "${skillId}" v${validation.manifest!.version} from ${repoUrl}` };
    } catch (error: unknown) { const err = asErrorLike(error); return { success: false, skillId: '', installedPath: '', message: `Install failed: ${err.message}` };
    }
  }

  installFromRepo(repoUrl: string, targetName?: string): SkillInstallResult {
    const tmpDir = path.join(os.tmpdir(), `zavorth-skill-${Date.now()}`);
    const trust = assertTrustedGitSource(repoUrl);
    if (!trust.ok) {
      return { success: false, skillId: '', installedPath: '', message: trust.message };
    }

    try {
      const cleanUrl = buildGitCloneUrl(repoUrl, process.cwd());
      const gitPassword = getGitPasswordEnv(repoUrl, process.cwd());
      const env = gitPassword ? { ...process.env, GIT_PASSWORD: gitPassword } : undefined;
      execFileSync('git', ['clone', '--depth', '1', cleanUrl, tmpDir], { stdio: 'pipe', timeout: 30000, env });

      const skills = this.findAllSkills(tmpDir);
      if (skills.length === 0) {
        return { success: false, skillId: '', installedPath: '', message: 'No valid skills found in repository (missing SKILL.md or manifest.json)' };
      }

      const skillDir = targetName ? skills.find((s) => s.name === targetName)?.dir || skills[0].dir : skills[0].dir;
      return this.installSkillFromDir(skillDir, repoUrl, targetName);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return { success: false, skillId: '', installedPath: '', message: `Git clone failed: ${err.message}` };
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  async installFromSource(source: string, targetName?: string): Promise<SkillInstallResult> {
    const detected = detectSource(source);
    const hint = getSourceHint(detected.type);

    switch (detected.type) {
      case 'git-repo':
      case 'git-url':
        return this.installFromRepo(detected.resolved, targetName);

      case 'zip-url':
      case 'tarball-url':
        return this.installFromUrl(detected.resolved);

      case 'local-path':
        return this.installFromLocalPath(detected.resolved, targetName);

      case 'local-file':
        return await this.installFromLocalFile(detected.resolved, targetName);

      case 'registry-url':
        return this.installFromRegistryUrl(detected.original, targetName);

      case 'npm-package':
        return this.installFromNpm(detected.original, targetName);

      default:
        try {
          return this.installFromRepo(detected.original, targetName);
        } catch {
          return { success: false, skillId: '', installedPath: '', message: `Cannot install from "${source}". ${hint}` };
        }
    }
  }

  private installFromLocalPath(sourcePath: string, targetName?: string): SkillInstallResult {
    const resolved = path.resolve(sourcePath);
    if (!fs.existsSync(resolved)) {
      return { success: false, skillId: '', installedPath: '', message: `Path not found: ${sourcePath}` };
    }

    const skills = this.findAllSkills(resolved);
    if (skills.length === 0) {
      return { success: false, skillId: '', installedPath: '', message: 'No valid skills found in directory' };
    }

    const skillDir = targetName ? skills.find((s) => s.name === targetName)?.dir || skills[0].dir : skills[0].dir;
    return this.installSkillFromDir(skillDir, `local:${sourcePath}`, targetName);
  }

  private async installFromLocalFile(filePath: string, targetName?: string): Promise<SkillInstallResult> {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return { success: false, skillId: '', installedPath: '', message: `File not found: ${filePath}` };
    }

    const ext = path.extname(resolved).toLowerCase();
    if (ext === '.zip' || ext === '.gz' || ext === '.tgz') {
      return await this.installFromUrl(`file://${resolved}`);
    }

    const dir = path.dirname(resolved);
    return this.installFromLocalPath(dir, targetName);
  }

  private async installFromRegistryUrl(url: string, targetName?: string): Promise<SkillInstallResult> {
    const slug = url.match(/\/skills\/([^/?]+)/)?.[1] || url.match(/\/registry\/([^/?]+)/)?.[1] || path.basename(url);
    if (!slug) {
      return { success: false, skillId: '', installedPath: '', message: `Cannot parse registry URL: ${url}` };
    }

    const pageTrust = assertTrustedGitSource(url.startsWith('http') ? url : `https://${url}`);
    if (!pageTrust.ok) {
      return { success: false, skillId: '', installedPath: '', message: pageTrust.message };
    }

    const tmpDir = path.join(os.tmpdir(), `zavorth-registry-${Date.now()}`);
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') {
        return {
          success: false,
          skillId: '',
          installedPath: '',
          message: `Rejected: only HTTPS registry URLs are allowed. Got ${parsedUrl.protocol}//`,
        };
      }
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const repoUrl = `${baseUrl}/${slug}.git`;
      const repoTrust = assertTrustedGitSource(repoUrl);
      if (!repoTrust.ok) {
        return { success: false, skillId: '', installedPath: '', message: repoTrust.message };
      }

      safeExec('git', ['clone', '--depth', '1', repoUrl, tmpDir]);

      const skills = this.findAllSkills(tmpDir);
      if (skills.length === 0) {
        return { success: false, skillId: '', installedPath: '', message: `No skills found in registry package "${slug}"` };
      }

      const skillDir = targetName ? skills.find((s) => s.name === targetName)?.dir || skills[0].dir : skills[0].dir;
      return this.installSkillFromDir(skillDir, url, targetName);
    } catch {
      // Fallback download also must stay on trusted host
      const fallbackUrl = `${url.replace(/\/$/, '')}/download`;
      const fbTrust = assertTrustedGitSource(fallbackUrl.startsWith('http') ? fallbackUrl : url);
      if (!fbTrust.ok) {
        return { success: false, skillId: '', installedPath: '', message: fbTrust.message };
      }
      return this.installFromUrl(fallbackUrl);
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private async installFromNpm(packageName: string, targetName?: string): Promise<SkillInstallResult> {
    const tmpDir = path.join(os.tmpdir(), `zavorth-npm-${Date.now()}`);
    try {
      const name = packageName.replace(/^https?:\/\/[^/]+\//, '').replace(/@[^@]+$/, '');
      safeExec('npm', ['pack', name, '--pack-destination', tmpDir]);

      const tgz = fs.readdirSync(tmpDir).find((f) => f.endsWith('.tgz'));
      if (!tgz) {
        return { success: false, skillId: '', installedPath: '', message: `No package found for "${name}"` };
      }

      const npmArchive = path.join(tmpDir, tgz);
      validateArchiveBeforeExtraction(npmArchive);
      safeExec('tar', ['-xzf', npmArchive, '-C', tmpDir]);
      const extracted = fs.readdirSync(tmpDir).find((d) => d.startsWith('package'));
      const packageDir = extracted ? path.join(tmpDir, extracted) : tmpDir;

      const skills = this.findAllSkills(packageDir);
      if (skills.length === 0) {
        return { success: false, skillId: '', installedPath: '', message: `No skills found in npm package "${name}"` };
      }

      const skillDir = targetName ? skills.find((s) => s.name === targetName)?.dir || skills[0].dir : skills[0].dir;
      return this.installSkillFromDir(skillDir, packageName, targetName);
    } catch (error: unknown) { const err = asErrorLike(error); return { success: false, skillId: '', installedPath: '', message: `npm install failed: ${err.message}` };
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  async installFromUrl(url: string): Promise<SkillInstallResult> {
    const tmpDir = path.join(os.tmpdir(), `zavorth-skill-url-${Date.now()}`);
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      const isZip = url.endsWith('.zip');
      const isTar = url.endsWith('.tar.gz') || url.endsWith('.tgz');
      const archivePath = path.join(tmpDir, isZip ? 'archive.zip' : 'archive.tar.gz');

      const res = await safeFetch(url, { signal: AbortSignal.timeout(30000) }, {
        serviceName: 'Skill marketplace archive download',
      });
      if (!res.ok) return { success: false, skillId: '', installedPath: '', message: `Download failed: HTTP ${res.status}` };

      const contentLength = Number(res.headers.get('content-length') || 0);
      if (contentLength > MAX_SKILL_ARCHIVE_BYTES) {
        return { success: false, skillId: '', installedPath: '', message: 'Download failed: skill archive exceeds 64 MiB' };
      }

      const fileStream = createWriteStream(archivePath);
      let downloadedBytes = 0;
      const limiter = new Transform({
        transform(chunk, _encoding, callback) {
          downloadedBytes += Buffer.byteLength(chunk);
          callback(downloadedBytes > MAX_SKILL_ARCHIVE_BYTES
            ? new Error('Skill archive exceeds 64 MiB')
            : null, chunk);
        },
      });
      await pipeline(res.body as any, limiter, fileStream);
      validateArchiveBeforeExtraction(archivePath);

      if (isZip) {
        safeExec('tar', ['-xf', path.join(tmpDir, 'archive.zip')], { stdio: 'pipe' });
      } else if (isTar) {
        safeExec('tar', ['-xzf', path.join(tmpDir, 'archive.tar.gz')], { stdio: 'pipe' });
      } else {
        return { success: false, skillId: '', installedPath: '', message: 'Unsupported archive format. Use .zip or .tar.gz' };
      }

      const extractedDirs = fs.readdirSync(tmpDir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'node_modules');
      const searchDir = extractedDirs.length === 1 ? path.join(tmpDir, extractedDirs[0].name) : tmpDir;

      const skills = this.findAllSkills(searchDir);
      if (skills.length === 0) {
        return { success: false, skillId: '', installedPath: '', message: 'No valid skills found in archive' };
      }

      const skillDir = skills[0].dir;
      const r = this.installSkillFromDir(skillDir, url);
      return r;
    } catch (error: unknown) { const err = asErrorLike(error); return { success: false, skillId: '', installedPath: '', message: `Download failed: ${err.message}` };
    } finally {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  publishToRepo(localSkillDir: string, repoUrl: string): SkillPublishResult {
    const validation = validateSkillPackage(localSkillDir);
    if (!validation.valid || !validation.manifest) {
      return { success: false, skillId: '', version: '', location: 'git', message: `Invalid skill: ${validation.errors.join(', ')}` };
    }

    const trust = assertTrustedGitSource(repoUrl);
    if (!trust.ok) {
      return { success: false, skillId: '', version: '', location: 'git', message: trust.message };
    }

    try {
      const tmpDir = path.join(os.tmpdir(), `zavorth-publish-${Date.now()}`);
      safeExec('git', ['clone', repoUrl, tmpDir]);

      const skillId = sanitizeSkillId(validation.manifest.name);
      const targetDir = path.join(tmpDir, skillId);
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
      fs.cpSync(localSkillDir, targetDir, { recursive: true });

      validation.manifest.checksum = computeSkillChecksum(localSkillDir);
      validation.manifest.publishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(validation.manifest, null, 2), 'utf-8');

      safeExec('git', ['-C', tmpDir, 'add', '-A']);
      safeExec('git', ['-C', tmpDir, 'commit', '-m', `Publish ${skillId} v${validation.manifest.version}`]);
      safeExec('git', ['-C', tmpDir, 'push']);

      this.registry.addEntry(validation.manifest, 'git', repoUrl);
      fs.rmSync(tmpDir, { recursive: true, force: true });

      return { success: true, skillId, version: validation.manifest.version, location: 'git', message: `Published "${skillId}" v${validation.manifest.version} to ${repoUrl}` };
    } catch (error: unknown) { const err = asErrorLike(error); return { success: false, skillId: '', version: '', location: 'git', message: `Publish failed: ${err.message}` };
    }
  }

  private findAllSkills(dir: string): Array<{ dir: string; name: string; version: string; description: string }> {
    const skills: Array<{ dir: string; name: string; version: string; description: string }> = [];
    const visited = new Set<string>();
    const MD_PATTERNS = ['SKILL.md', 'skill.md', 'README.md', 'readme.md', 'DOCS.md', 'docs.md', 'INSTRUCTIONS.md', 'instructions.md'];
    const JSON_PATTERNS = ['manifest.json', 'package.json', 'info.json', 'skill.json', 'config.json', 'meta.json'];

    const scan = (currentDir: string, depth: number) => {
      if (depth > 5 || visited.has(currentDir)) return;
      visited.add(currentDir);

      const mdFile = MD_PATTERNS.find((f) => fs.existsSync(path.join(currentDir, f)));
      const jsonFile = JSON_PATTERNS.find((f) => fs.existsSync(path.join(currentDir, f)));

      if (mdFile) {
        const mdPath = path.join(currentDir, mdFile);
        const mdContent = fs.readFileSync(mdPath, 'utf-8');
        let name = path.basename(currentDir);
        let version = '0.0.0';
        let description = '';

        if (jsonFile) {
          try {
            const manifest = JSON.parse(fs.readFileSync(path.join(currentDir, jsonFile), 'utf-8'));
            if (manifest.name) name = manifest.name;
            if (manifest.version) version = manifest.version;
            if (manifest.description) description = manifest.description;
          } catch { /* skip */ }
        }

        if (!description) {
          const frontmatterMatch = mdContent.match(/^---\s*\n([\s\S]*?)\n---/);
          if (frontmatterMatch) {
            const fm = frontmatterMatch[1];
            const descMatch = fm.match(/description:\s*["']?(.+?)["']?\s*$/m);
            if (descMatch) description = descMatch[1].trim();
            const nameMatch = fm.match(/name:\s*["']?(.+?)["']?\s*$/m);
            if (nameMatch) name = nameMatch[1].trim();
            const versionMatch = fm.match(/version:\s*["']?(.+?)["']?\s*$/m);
            if (versionMatch) version = versionMatch[1].trim();
          }
        }

        if (!description) {
          const firstParagraph = mdContent.replace(/^#[^\n]*\n/, '').split('\n\n')[0]?.trim() || '';
          description = firstParagraph.slice(0, 120);
        }

        skills.push({ dir: currentDir, name, version, description });
        return;
      }

      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'build') {
            scan(path.join(currentDir, entry.name), depth + 1);
          }
        }
      } catch { /* skip */ }
    };

    scan(dir, 0);
    return skills;
  }
}
