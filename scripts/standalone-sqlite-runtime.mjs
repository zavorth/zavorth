#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(path.dirname(modulePath), '..');
const driverPackages = ['better-sqlite3', 'better-sqlite3-multiple-ciphers'];
const supportPackages = ['bindings', 'file-uri-to-path'];

function copyFile(source, destination) {
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Required standalone SQLite file is missing: ${source}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Required standalone SQLite directory is missing: ${source}`);
  }
  fs.cpSync(source, destination, { recursive: true, force: true, dereference: false });
}

function packageVersion(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function copyDriverPackage(projectRoot, nativeRoot, packageName) {
  const source = path.join(projectRoot, 'node_modules', packageName);
  const destination = path.join(nativeRoot, 'node_modules', packageName);
  fs.rmSync(destination, { recursive: true, force: true });
  copyFile(path.join(source, 'package.json'), path.join(destination, 'package.json'));
  for (const license of ['LICENSE', 'LICENSE.md']) {
    if (fs.existsSync(path.join(source, license))) {
      copyFile(path.join(source, license), path.join(destination, license));
    }
  }
  copyDirectory(path.join(source, 'lib'), path.join(destination, 'lib'));
  const addonSource = path.join(source, 'build', 'Release', 'better_sqlite3.node');
  const addonDestination = path.join(destination, 'build', 'Release', 'better_sqlite3.node');
  copyFile(addonSource, addonDestination);
  return {
    package: packageName,
    version: packageVersion(source),
    addon: path.relative(nativeRoot, addonDestination).replace(/\\/g, '/'),
    sha256: sha256(addonDestination),
  };
}

function copySupportPackage(projectRoot, nativeRoot, packageName) {
  const source = path.join(projectRoot, 'node_modules', packageName);
  const destination = path.join(nativeRoot, 'node_modules', packageName);
  fs.rmSync(destination, { recursive: true, force: true });
  copyFile(path.join(source, 'package.json'), path.join(destination, 'package.json'));
  for (const file of ['bindings.js', 'index.js', 'index.d.ts', 'LICENSE', 'LICENSE.md']) {
    if (fs.existsSync(path.join(source, file))) {
      copyFile(path.join(source, file), path.join(destination, file));
    }
  }
  return { package: packageName, version: packageVersion(source) };
}

export function prepareStandaloneSqliteRuntime(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || defaultProjectRoot);
  const outputRoot = path.resolve(options.outputRoot || path.join(projectRoot, 'dist-standalone'));
  const nativeRoot = path.join(outputRoot, 'native');
  fs.mkdirSync(nativeRoot, { recursive: true });
  fs.writeFileSync(path.join(nativeRoot, 'runtime-loader.cjs'), "'use strict';\n", 'utf8');

  const drivers = driverPackages.map((packageName) => copyDriverPackage(projectRoot, nativeRoot, packageName));
  const support = supportPackages.map((packageName) => copySupportPackage(projectRoot, nativeRoot, packageName));
  const manifest = {
    schemaVersion: 'zavorth-standalone-sqlite-runtime/1',
    platform: process.platform,
    architecture: process.arch,
    nodeAbi: process.versions.modules,
    drivers,
    support,
  };
  fs.writeFileSync(
    path.join(nativeRoot, 'sqlite-runtime-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return { outputRoot, nativeRoot, manifest };
}

export function smokeTestStandaloneSqliteRuntime(nativeRoot) {
  const resolvedNativeRoot = path.resolve(nativeRoot);
  const load = createRequire(path.join(resolvedNativeRoot, 'runtime-loader.cjs'));
  const PlainDatabase = load('better-sqlite3');
  const CipherDatabase = load('better-sqlite3-multiple-ciphers');
  const databasePath = path.join(resolvedNativeRoot, `.sqlite-smoke-${process.pid}-${crypto.randomUUID()}.db`);
  const key = crypto.randomBytes(32).toString('hex');
  let plainRejected = false;

  try {
    let encrypted = new CipherDatabase(databasePath);
    encrypted.pragma(`key = "x'${key}'"`);
    encrypted.exec('CREATE TABLE encrypted_smoke (value TEXT NOT NULL); INSERT INTO encrypted_smoke VALUES (\'ok\');');
    encrypted.close();

    try {
      const plain = new PlainDatabase(databasePath, { readonly: true });
      try {
        plain.prepare('SELECT value FROM encrypted_smoke').get();
      } finally {
        plain.close();
      }
    } catch {
      plainRejected = true;
    }
    if (!plainRejected) {
      throw new Error('Packaged SQLite database was readable without its encryption key.');
    }

    encrypted = new CipherDatabase(databasePath, { readonly: true });
    try {
      encrypted.pragma(`key = "x'${key}'"`);
      const row = encrypted.prepare('SELECT value FROM encrypted_smoke').get();
      if (!row || row.value !== 'ok') {
        throw new Error('Packaged SQLCipher driver could not read its encrypted database.');
      }
    } finally {
      encrypted.close();
    }
    return { encryptedRoundTrip: true, plaintextRejected: true };
  } finally {
    for (const suffix of ['', '-shm', '-wal']) {
      fs.rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (path.resolve(process.argv[1] || '') === modulePath) {
  try {
    const prepared = prepareStandaloneSqliteRuntime({ outputRoot: argumentValue('--output') });
    const smoke = smokeTestStandaloneSqliteRuntime(prepared.nativeRoot);
    const result = { ok: true, nativeRoot: prepared.nativeRoot, manifest: prepared.manifest, smoke };
    process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : '[standalone-sqlite] encrypted runtime verified\n');
  } catch (error) {
    process.stderr.write(`[standalone-sqlite] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
