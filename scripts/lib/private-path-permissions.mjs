import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SID_PATTERN = /\bS-1-(?:\d+-){1,14}\d+\b/u;

function fail(operation) {
  const error = new Error(`Private path protection failed during ${operation}.`);
  error.code = 'PRIVATE_PATH_PERMISSION_FAILED';
  throw error;
}

function run(executable, args, runNative) {
  const result = runNative(executable, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  return !result.error && result.status === 0 ? result : null;
}

export function protectPrivatePathSync(targetPath, options = {}) {
  let stat;
  try {
    stat = fs.lstatSync(targetPath);
  } catch {
    fail('inspect');
  }
  const kind = options.kind || (stat.isDirectory() ? 'directory' : 'file');
  if (stat.isSymbolicLink() || (kind === 'file' && !stat.isFile()) || (kind === 'directory' && !stat.isDirectory())) {
    fail('inspect');
  }
  if ((options.platform || process.platform) !== 'win32') {
    try {
      fs.chmodSync(targetPath, kind === 'directory' ? 0o700 : 0o600);
      return;
    } catch {
      fail('restrict');
    }
  }

  const systemRoot = String(options.systemRoot || process.env.SystemRoot || process.env.windir || '').trim();
  if (!path.win32.isAbsolute(systemRoot)
    || !['windows', 'winnt'].includes(path.win32.basename(systemRoot).toLowerCase())) {
    fail('identity');
  }
  const runNative = options.runNative || spawnSync;
  const system32 = path.win32.join(systemRoot, 'System32');
  const whoami = run(path.win32.join(system32, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], runNative);
  const sid = String(whoami?.stdout || '').match(SID_PATTERN)?.[0] || '';
  if (!sid) fail('identity');

  const icacls = path.win32.join(system32, 'icacls.exe');
  if (!run(icacls, [targetPath, '/reset', '/q'], runNative)) fail('reset');
  const permission = kind === 'directory' ? '(OI)(CI)F' : '(F)';
  if (!run(icacls, [
    targetPath,
    '/inheritance:r',
    '/grant:r',
    `*${sid}:${permission}`,
    `*S-1-5-18:${permission}`,
    `*S-1-5-32-544:${permission}`,
    '/q',
  ], runNative)) fail('restrict');
}

export function ensurePrivateDirectorySync(directoryPath) {
  const existed = fs.existsSync(directoryPath);
  try {
    fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
    protectPrivatePathSync(directoryPath, { kind: 'directory' });
  } catch (error) {
    if (!existed) {
      try { fs.rmSync(directoryPath, { recursive: true, force: true }); } catch {}
    }
    throw error;
  }
}

export function writePrivateFileAtomicSync(filePath, value) {
  const directory = path.dirname(filePath);
  ensurePrivateDirectorySync(directory);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, value, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    protectPrivatePathSync(temporary, { kind: 'file' });
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}
