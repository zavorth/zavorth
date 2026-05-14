import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  ZAVORTH_NPM_RESERVATION_PACK_RUNTIME_ID,
  createZavorthNpmReservationPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/287-zavorth-npm-reservation-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNpmReservationPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const NAMING_DECISION = 'NAMING_DECISION.md';
const ROOT_PACKAGE = 'package.json';
const ROOT_PLACEHOLDER = 'packages/zavorth-reservation/package.json';
const CREATE_PLACEHOLDER = 'packages/create-zavorth-reservation/package.json';
const ROOT_BIN = 'packages/zavorth-reservation/bin/zavorth.js';
const CREATE_BIN = 'packages/create-zavorth-reservation/bin/create-zavorth.js';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain(['_auth', 'Token'].join(''));
}

function assertSafePlaceholderOutput(output: string): void {
  expect(output).toContain('Zavorth');
  expect(output).toContain('reserves the public npm');
  expect(output).toContain('No runtime was started.');
  expect(output).toContain('No files were written.');
  expect(output).toContain('No secrets were requested.');
  expect(output).toContain('https://github.com/zavorth');
  expect(output).not.toMatch(/\bnpm publish\b/i);
  expect(output).not.toMatch(/\bnpm install\b/i);
  expect(output).not.toMatch(/\b(runtime|provider|tool|message send)\s+started\b/i);
  assertNoRawSecret(output);
}

describe('Zavorth npm reservation pack', () => {
  const pack = createZavorthNpmReservationPackFixture();

  it('exports the pack 287 boundary', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNpmReservationPack/v1');
    expect(boundary).toContain('ZavorthReservationPlaceholder/v1');
    expect(boundary).toContain('ZavorthReservationPublishCommand/v1');
    expect(index).toContain("from './ZavorthNpmReservationPack.js'");
    expect(pack.normalization.packId).toBe('287');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_NPM_RESERVATION_PACK_RUNTIME_ID);
  });

  it('records reconciled manual placeholder publication state without runtime execution', () => {
    expect(pack.normalization.decision).toBe('zavorth-npm-reservation-published');
    expect(pack.normalization.candidateName).toBe('Zavorth');
    expect(pack.normalization.activeProductName).toBe('Zavorth');
    expect(pack.normalization.reservationVersion).toBe('0.0.0-reserved.0');
    expect(pack.normalization.reservationTag).toBe('reserved');
    expect(pack.publishPerformed()).toBe(true);
    expect(pack.blockedActionPerformed()).toBe(false);
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      rootProductRenamePerformed: false,
      activeProductStillZavorth: true,
      zavorthPlaceholderPrepared: true,
      createZavorthPlaceholderPrepared: true,
      zavorthPublishPerformed: true,
      createZavorthPublishPerformed: true,
      latestTagChanged: false,
      alphaTagChanged: false,
      runtimeStarted: false,
      secretsRequested: false,
      npmTokenRead: false,
      npmTokenSerialized: false,
      externalActionLimitedToApprovedNpmPublish: true,
    }));
  });

  it('creates minimal placeholder packages with expected metadata', () => {
    const root = readJson<any>(ROOT_PLACEHOLDER);
    const create = readJson<any>(CREATE_PLACEHOLDER);

    expect(root).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '0.0.0-reserved.0',
      description: 'Reserved npm name for the upcoming Zavorth agent runtime.',
      license: 'MIT',
      homepage: 'https://github.com/zavorth',
    }));
    expect(root.bin).toEqual({ zavorth: 'bin/zavorth.js' });
    expect(root.files).toEqual(['README.md', 'bin/zavorth.js']);
    expect(create).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '0.0.0-reserved.0',
      description: 'Reserved npm create package name for the upcoming Zavorth agent runtime.',
      license: 'MIT',
      homepage: 'https://github.com/zavorth',
    }));
    expect(create.bin).toEqual({ 'create-zavorth': 'bin/create-zavorth.js' });
    expect(create.files).toEqual(['README.md', 'bin/create-zavorth.js']);
    expect(pack.placeholderPackageNames()).toEqual(['zavorth', 'create-zavorth']);
  });

  it('accepts the post-rename root package while preserving no public legacy alias', () => {
    const rootPackage = readJson<any>(ROOT_PACKAGE);

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.bin.zavorth).toBe('bin/zavorth.js');
    expect(Object.keys(rootPackage.bin)).toEqual(['zavorth']);
    expect(fs.existsSync(path.join(process.cwd(), 'bin/zavorth.js'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.ps1'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.sh'))).toBe(true);
    const oldName = ['ast', 'erlyn'].join('');
    expect(fs.existsSync(path.join(process.cwd(), 'bin', `${oldName}.js`))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts', `install-${oldName}.ps1`))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts', `install-${oldName}.sh`))).toBe(false);
  });

  it('placeholder bins are safe no-op output only', () => {
    const rootOutput = execFileSync(process.execPath, [ROOT_BIN], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const createOutput = execFileSync(process.execPath, [CREATE_BIN], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assertSafePlaceholderOutput(rootOutput);
    assertSafePlaceholderOutput(createOutput);
    expect(createOutput).toContain('npm create package name');
  });

  it('records placeholder publish commands as executed for the manually observed reservation', () => {
    expect(pack.normalization.publishCommands).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        prepared: true,
        executed: true,
        requiresExplicitOperatorApproval: true,
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        prepared: true,
        executed: true,
        requiresExplicitOperatorApproval: true,
      }),
    ]);
    expect(pack.normalization.publishCommands[0].command).toContain('npm publish --access public --tag reserved');
    expect(pack.normalization.publishCommands[1].command).toContain('npm publish --access public --tag reserved');
  });

  it('documents reservation behavior and no-op guarantees', () => {
    const doc = read(DOC);
    const namingDecision = read(NAMING_DECISION);
    const serialized = JSON.stringify(pack.normalization);

    expect(doc).toContain('287 - Zavorth NPM Reservation Pack');
    expect(doc).toContain('zavorth@0.0.0-reserved.0');
    expect(doc).toContain('create-zavorth@0.0.0-reserved.0');
    expect(doc).toContain('Publicacao Manual Observada');
    expect(doc).toContain('latest -> 0.0.0-reserved.0');
    expect(doc).toContain('Nao publique novamente `0.0.0-reserved.0`');
    expect(doc).toContain('latestTagChanged=false');
    expect(doc).toContain('alphaTagChanged=false');
    expect(doc).toContain('npmTokenRead=false');
    expect(namingDecision).toContain('The Zavorth npm reservation placeholders were manually published by the operator');
    expect(namingDecision).toContain('`latest` points at the reservation placeholder');
    assertNoRawSecret(`${doc}\n${namingDecision}\n${serialized}`);
  });
});
