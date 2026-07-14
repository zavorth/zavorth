import { logger } from '../logger.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { config } from '../config/index.js';
import { Database } from '../storage/Database.js';
import type { SkillCatalogEntry } from './SkillCatalogContract.js';
import { SkillCatalogService } from './SkillCatalogService.js';
export interface ArchivedSkillInfo {
  skillId: string;
  archivePath: string;
  archivedAt: string;
  sizeBytes: number;
  originalDirPath: string | null;
  sourceId: string | null;
}

type SkillArchiveManifest = {
  version: 1;
  skillId: string;
  archivedAt: string;
  originalDirPath: string;
  sourceId: string | null;
  sourceLabel: string | null;
};

export class SkillCurationService {
  private readonly catalogService: SkillCatalogService;

  constructor(catalogService?: SkillCatalogService) {
    this.catalogService = catalogService || new SkillCatalogService();
  }

  public getArchiveDir(): string {
    const archiveDir = path.join(config.dataDir, 'skills', 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    return archiveDir;
  }

  public async togglePin(skillId: string, pinned: boolean): Promise<void> {
    const normalizedSkillId = normalizeSkillId(skillId);
    const db = await Database.getInstance();
    db.run(`
      INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
      VALUES (?, 0, datetime('now'), 'active', ?)
      ON CONFLICT(skill_id) DO UPDATE SET
        pinned = ?
    `, [normalizedSkillId, pinned ? 1 : 0, pinned ? 1 : 0]);
    logger.info(`[SkillCurationService] Skill "${normalizedSkillId}" pin status atualizado para: ${pinned}`);
  }

  public async archiveSkill(skillId: string): Promise<void> {
    const normalizedSkillId = normalizeSkillId(skillId);
    const entries = this.catalogService.listEntries();
    const skill = entries.find((entry) => entry.name === normalizedSkillId);

    if (!skill) {
      throw new Error(`Skill with ID "${normalizedSkillId}" was not found in the active skills catalog.`);
    }

    if (skill.sourceId === 'zavorth-native') {
      throw new Error(`Nao e permitido arquivar a skill nativa do core "${normalizedSkillId}".`);
    }

    const sourceDir = path.resolve(skill.dirPath);
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Skill source directory does not exist: ${sourceDir}`);
    }
    if (!isPathAllowedForSkillMutation(sourceDir)) {
      throw new Error(`Diretorio de origem da skill esta fora dos roots gerenciados pelo Zavorth: ${sourceDir}`);
    }

    const zipPath = this.archivePathForSkill(normalizedSkillId);
    const manifestPath = this.manifestPathForSkill(normalizedSkillId);
    const manifest = this.buildArchiveManifest(normalizedSkillId, skill, sourceDir);

    logger.info(`[SkillCurationService] Compactando skill "${normalizedSkillId}" de ${sourceDir} para ${zipPath}...`);

    const zip = new JSZip();
    zip.file('.zavorth-skill-archive.json', JSON.stringify(manifest, null, 2));
    this.addDirectoryToZip(zip, sourceDir);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    fs.writeFileSync(zipPath, buffer);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    logger.info(`[SkillCurationService] Removendo pasta original da skill arquivada: ${sourceDir}`);
    fs.rmSync(sourceDir, { recursive: true, force: true });

    const db = await Database.getInstance();
    db.run(`
      INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
      VALUES (?, 0, datetime('now'), 'archived', 0)
      ON CONFLICT(skill_id) DO UPDATE SET
        status = 'archived'
    `, [normalizedSkillId]);

    logger.info(`[SkillCurationService] Skill "${normalizedSkillId}" archived successfully.`);
  }

  public async restoreSkill(skillId: string): Promise<void> {
    const normalizedSkillId = normalizeSkillId(skillId);
    const zipPath = this.archivePathForSkill(normalizedSkillId);

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Packaged skill file not found at: ${zipPath}`);
    }

    const manifest = this.readArchiveManifest(normalizedSkillId);
    const destDir = path.resolve(
      manifest?.originalDirPath && isPathAllowedForSkillMutation(manifest.originalDirPath)
        ? manifest.originalDirPath
        : path.join(config.projectRoot, 'skill-library', normalizedSkillId),
    );
    if (!isPathAllowedForSkillMutation(destDir)) {
      throw new Error(`Destino de restauracao da skill esta fora dos roots gerenciados pelo Zavorth: ${destDir}`);
    }
    if (fs.existsSync(destDir) && fs.readdirSync(destDir).length > 0) {
      throw new Error(`Restore destination already exists and is not empty: ${destDir}`);
    }

    logger.info(`[SkillCurationService] Restaurando skill "${normalizedSkillId}" extraindo ${zipPath} para ${destDir}...`);
    const zipData = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipData);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (relativePath === '.zavorth-skill-archive.json') {
        continue;
      }
      const safeRelativePath = normalizeZipEntryPath(relativePath);
      if (!safeRelativePath) {
        throw new Error(`Arquivo zip contem caminho inseguro: ${relativePath}`);
      }
      const filePath = safeResolveInside(destDir, safeRelativePath);
      if (file.dir) {
        fs.mkdirSync(filePath, { recursive: true });
      } else {
        const content = await file.async('nodebuffer');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
      }
    }

    fs.rmSync(zipPath, { force: true });
    fs.rmSync(this.manifestPathForSkill(normalizedSkillId), { force: true });

    const db = await Database.getInstance();
    db.run(`
      INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
      VALUES (?, 1, datetime('now'), 'active', 0)
      ON CONFLICT(skill_id) DO UPDATE SET
        status = 'active',
        last_executed_at = datetime('now')
    `, [normalizedSkillId]);

    logger.info(`[SkillCurationService] Skill "${normalizedSkillId}" restored successfully.`);
  }

  public async runAutoCuration(): Promise<{ archivedCount: number }> {
    if (!config.skillsCurationEnabled) {
      logger.info('[SkillCurationService] Auto-curadoria desabilitada globalmente nas configuracoes.');
      return { archivedCount: 0 };
    }

    const archiveDays = config.skillsCurationArchiveAfterDays || 30;
    const db = await Database.getInstance();

    const activeEntries = this.catalogService.listEntries();
    for (const entry of activeEntries) {
      if (entry.sourceId === 'zavorth-native') {
        continue;
      }
      db.run(`
        INSERT OR IGNORE INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
        VALUES (?, 0, datetime('now'), 'active', 0)
      `, [entry.name]);
    }

    const inactiveSkills = db.all<{ skill_id: string }>(`
      SELECT skill_id
      FROM zavorth_skills_telemetry
      WHERE status = 'active'
        AND (pinned IS NULL OR pinned = 0)
        AND datetime(last_executed_at) < datetime('now', ?)
    `, [`-${archiveDays} days`]);

    logger.info(`[SkillCurationService] Escaneando por inatividade (> ${archiveDays} dias). Encontradas ${inactiveSkills.length} skills candidatas.`);

    let archivedCount = 0;
    for (const row of inactiveSkills) {
      try {
        await this.archiveSkill(row.skill_id);
        archivedCount++;
      } catch (error: unknown) {logger.error(`[SkillCurationService] Falha ao arquivar automaticamente a skill "${row.skill_id}":`, error);
      }
    }

    if (archivedCount > 0) {
      logger.info(`[SkillCurationService] Auto-curadoria concluida. ${archivedCount} skills inativas foram arquivadas.`);
    }

    return { archivedCount };
  }

  public async listArchivedSkills(): Promise<ArchivedSkillInfo[]> {
    const archiveDir = this.getArchiveDir();
    if (!fs.existsSync(archiveDir)) {
      return [];
    }

    const zips = fs.readdirSync(archiveDir).filter((file) => file.endsWith('.zip'));
    const list: ArchivedSkillInfo[] = [];
    for (const zip of zips) {
      const zipPath = safeResolveInside(archiveDir, zip);
      const stat = fs.statSync(zipPath);
      const fallbackSkillId = path.basename(zip, '.zip');
      const manifest = this.readArchiveManifest(fallbackSkillId, zipPath);
      const skillId = manifest?.skillId || fallbackSkillId;

      list.push({
        skillId,
        archivePath: zipPath,
        archivedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        originalDirPath: manifest?.originalDirPath || null,
        sourceId: manifest?.sourceId || null,
      });
    }

    return list;
  }

  private archivePathForSkill(skillId: string): string {
    return safeResolveInside(this.getArchiveDir(), `${archiveFileStemForSkillId(skillId)}.zip`);
  }

  private manifestPathForSkill(skillId: string): string {
    return safeResolveInside(this.getArchiveDir(), `${archiveFileStemForSkillId(skillId)}.manifest.json`);
  }

  private buildArchiveManifest(skillId: string, skill: SkillCatalogEntry, sourceDir: string): SkillArchiveManifest {
    return {
      version: 1,
      skillId,
      archivedAt: new Date().toISOString(),
      originalDirPath: sourceDir,
      sourceId: skill.sourceId,
      sourceLabel: skill.sourceLabel,
    };
  }

  private readArchiveManifest(skillId: string, zipPath?: string): SkillArchiveManifest | null {
    const manifestPath = zipPath
      ? zipPath.replace(/\.zip$/i, '.manifest.json')
      : this.manifestPathForSkill(skillId);
    try {
      if (fs.existsSync(manifestPath)) {
        return parseArchiveManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
      }
    } catch (error: unknown) {return null;
    }
    return null;
  }

  private addDirectoryToZip(zip: JSZip, localPath: string, zipPath = ''): void {
    const files = fs.readdirSync(localPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(localPath, file.name);
      const currentZipPath = zipPath ? `${zipPath}/${file.name}` : file.name;

      if (file.isDirectory()) {
        this.addDirectoryToZip(zip, fullPath, currentZipPath);
      } else if (file.isFile()) {
        zip.file(currentZipPath, fs.readFileSync(fullPath));
      }
    }
  }
}

function normalizeSkillId(skillId: string): string {
  const normalized = String(skillId || '').trim();
  if (!normalized) {
    throw new Error('skillId e obrigatorio.');
  }
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error('skillId contem caracteres de controle invalidos.');
  }
  return normalized;
}

function archiveFileStemForSkillId(skillId: string): string {
  if (/^[A-Za-z0-9_.:-]+$/.test(skillId)) {
    return skillId;
  }
  return `skill-${crypto.createHash('sha256').update(skillId).digest('hex').slice(0, 16)}`;
}

function normalizeZipEntryPath(relativePath: string): string | null {
  const normalizedInput = String(relativePath || '').replace(/\\/g, '/');
  if (!normalizedInput || normalizedInput.startsWith('/') || /^[A-Za-z]:\//.test(normalizedInput)) {
    return null;
  }
  const segments = normalizedInput.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) {
    return null;
  }
  const normalized = path.posix.normalize(segments.join('/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    return null;
  }
  return normalized;
}

function safeResolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Caminho escaparia do diretorio permitido: ${relativePath}`);
  }
  return resolvedPath;
}

function isPathAllowedForSkillMutation(candidatePath: string): boolean {
  const candidate = path.resolve(candidatePath);
  const roots = [
    config.projectRoot,
    config.skillsDir,
    (config as unknown as { zavorthHomeRoot?: string }).zavorthHomeRoot,
    path.join(config.projectRoot, 'skill-library'),
    path.join(config.projectRoot, '.agents', 'skills'),
  ].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);

  return roots.some((root) => {
    const resolvedRoot = path.resolve(root);
    return candidate === resolvedRoot || candidate.startsWith(`${resolvedRoot}${path.sep}`);
  });
}

function parseArchiveManifest(value: unknown): SkillArchiveManifest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const skillId = typeof record.skillId === 'string' ? record.skillId.trim() : '';
  const originalDirPath = typeof record.originalDirPath === 'string' ? record.originalDirPath.trim() : '';
  if (!skillId || !originalDirPath) {
    return null;
  }
  return {
    version: 1,
    skillId,
    archivedAt: typeof record.archivedAt === 'string' ? record.archivedAt : '',
    originalDirPath,
    sourceId: typeof record.sourceId === 'string' ? record.sourceId : null,
    sourceLabel: typeof record.sourceLabel === 'string' ? record.sourceLabel : null,
  };
}
