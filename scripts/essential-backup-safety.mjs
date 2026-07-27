import fs from 'fs';
import path from 'path';

const ARCHIVE_NAME = /^zavorth-essential-\d{8}-\d{6}\.zip$/;

function normalizedStoredEntries(storedManifest) {
  const entries = Array.isArray(storedManifest?.backups) ? storedManifest.backups : [];
  const byName = new Map();
  for (const entry of entries) {
    const archiveName = path.basename(String(entry?.archivePath || ''));
    if (!ARCHIVE_NAME.test(archiveName) || byName.has(archiveName)) continue;
    byName.set(archiveName, entry);
  }
  return byName;
}

export function listSafeEssentialArchives(backupRoot, storedManifest = {}) {
  const trustedRoot = fs.realpathSync.native(path.resolve(backupRoot));
  const storedByName = normalizedStoredEntries(storedManifest);
  const archives = [];
  for (const entry of fs.readdirSync(trustedRoot, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !ARCHIVE_NAME.test(entry.name)) continue;
    const archivePath = path.join(trustedRoot, entry.name);
    const stat = fs.lstatSync(archivePath);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    const stored = storedByName.get(entry.name) || {};
    const storedDate = Date.parse(String(stored.createdAt || ''));
    archives.push({
      archivePath,
      createdAt: Number.isFinite(storedDate) ? new Date(storedDate).toISOString() : stat.mtime.toISOString(),
      branch: typeof stored.branch === 'string' ? stored.branch : '',
      commit: typeof stored.commit === 'string' ? stored.commit : '',
      files: Number.isSafeInteger(stored.files) && stored.files >= 0 ? stored.files : 0,
      bytes: stat.size,
    });
  }
  return archives.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
      || path.basename(right.archivePath).localeCompare(path.basename(left.archivePath)));
}

export function pruneSafeEssentialArchives(backupRoot, archives, keepCount) {
  const trustedRoot = fs.realpathSync.native(path.resolve(backupRoot));
  let removed = 0;
  for (const archive of archives.slice(Math.max(0, keepCount))) {
    const archiveName = path.basename(String(archive?.archivePath || ''));
    if (!ARCHIVE_NAME.test(archiveName)) continue;
    const candidate = path.join(trustedRoot, archiveName);
    if (path.dirname(candidate) !== trustedRoot || !fs.existsSync(candidate)) continue;
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    fs.rmSync(candidate, { force: true });
    removed += 1;
  }
  return removed;
}
