import fs from 'fs';
import os from 'os';
import path from 'path';
import { listSafeEssentialArchives, pruneSafeEssentialArchives } from './essential-backup-safety.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-essential-safety-'));
const protectedFile = path.join(root, 'protected.txt');
const backups = path.join(root, 'backups');
fs.mkdirSync(backups);
fs.writeFileSync(protectedFile, 'keep');
for (const name of ['zavorth-essential-20260716-010101.zip', 'zavorth-essential-20260716-020202.zip']) {
  fs.writeFileSync(path.join(backups, name), name);
}
const archives = listSafeEssentialArchives(backups, {
  backups: [{ archivePath: protectedFile, createdAt: '2099-01-01T00:00:00.000Z' }],
});
if (archives.length !== 2 || archives.some((entry) => path.dirname(entry.archivePath) !== fs.realpathSync.native(backups))) {
  throw new Error('Essential backup archive discovery escaped its trusted root.');
}
const malicious = [archives[0], { archivePath: protectedFile }, ...archives.slice(1)];
pruneSafeEssentialArchives(backups, malicious, 1);
if (fs.readFileSync(protectedFile, 'utf8') !== 'keep') {
  throw new Error('Essential backup pruning removed an external file.');
}
console.log('Essential backup path safety check passed.');
