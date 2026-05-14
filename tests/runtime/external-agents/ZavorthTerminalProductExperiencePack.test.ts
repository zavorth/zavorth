import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_RUNTIME_ID,
  createZavorthTerminalProductExperiencePackFixture,
} from '../../../src/runtime/external-agents/index.js';
import { formatZavorthGoReport } from '../../../src/cli/ZavorthCliGoRenderer.js';
import { formatCliHelp } from '../../../src/cli/ZavorthCliSurfaceHelpers.js';
import type { RuntimeOfficialAccessReport } from '../../../src/runtime/access/RuntimeOfficialAccessService.js';

const DOC_278 = 'docs/278-zavorth-terminal-product-experience-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthTerminalProductExperiencePack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const CREATE_BIN = 'packages/create-zavorth/bin/create-zavorth.js';

const legacyLower = 'bas' + 'ilisk';
const legacyTitle = 'Bas' + 'ilisk';
const legacyUpper = 'BAS' + 'ILISK';
const legacyIdentityPattern = new RegExp(`${legacyTitle}|${legacyLower}|${legacyUpper}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

function makeAccessReport(ready: boolean): RuntimeOfficialAccessReport {
  return {
    generatedAt: '2026-05-02T00:00:00.000Z',
    summary: ready
      ? 'Zavorth pronto para uso local.'
      : 'O caminho oficial ainda precisa preparar o Zavorth.',
    tokenSource: 'env',
    journey: {} as any,
    manifest: {} as any,
    readiness: {} as any,
    local: {
      ready,
      appUrl: 'http://127.0.0.1:3000/control',
      trust: {
        attempted: false,
        applied: ready,
        statusCode: null,
        error: null,
      },
    },
    remote: {
      configured: false,
      appUrl: null,
      appProbe: null,
      authProbe: null,
      issues: [],
      ready: false,
    },
    nextSteps: [],
  };
}

describe('Zavorth terminal product experience pack', () => {
  const pack = createZavorthTerminalProductExperiencePackFixture();

  it('exports the pack 278 boundary and final ready state', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthTerminalProductExperiencePack/v1');
    expect(boundary).toContain('ZavorthTerminalVisualLanguage/v1');
    expect(index).toContain("from './ZavorthTerminalProductExperiencePack.js'");
    expect(pack.normalization.packId).toBe('278');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_TERMINAL_PRODUCT_EXPERIENCE_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-terminal-product-experience-ready');
    expect(pack.allRequiredCommandsPolished()).toBe(true);
  });

  it('models the polished terminal commands and blocked actions', () => {
    expect(pack.normalization.commandPolish.map((command) => command.command)).toEqual([
      'zavorth --help',
      'zavorth setup --help',
      'zavorth doctor --help',
      'zavorth go --dry-run --timeout-ms=1000 --poll-ms=250',
      'zavorth chat --help',
      'zavorth status --help',
      'create-zavorth --help',
    ]);
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      terminalProductPolishApplied: true,
      publicHelpZavorthOnly: true,
      setupHelpPolished: true,
      doctorHelpPolished: true,
      goDryRunPolished: true,
      createPackageHelpPolished: true,
      dangerousRuntimeStarted: false,
      npmPublishActuallyPerformed: false,
      stableRelease: false,
      runtimePersistentStartPerformed: false,
      globalInstallPerformed: false,
      providerExecutionPerformed: false,
      toolExecutionPerformed: false,
      messageSendPerformed: false,
      rawImportPerformed: false,
      oldIdentityPublicLeak: false,
      rawSecretSerialized: false,
    }));
    expect(pack.blockedActionPerformed()).toBe(false);
    assertNoRawSecret(JSON.stringify(pack.normalization));
  });

  it('renders product-first help without old identity leakage', () => {
    const rootHelp = formatCliHelp();
    const setupHelp = formatCliHelp('setup');
    const doctorHelp = formatCliHelp('doctor');

    expect(rootHelp).toContain('Zavorth');
    expect(rootHelp).toContain('A local-first agent runtime');
    expect(rootHelp).toContain('Start');
    expect(rootHelp).toContain('Work');
    expect(rootHelp).toContain('Inspect');
    expect(rootHelp).toContain('Safety');
    expect(rootHelp).toContain('New here? Run: zavorth setup');
    expect(setupHelp).toContain('Prepara o primeiro uso');
    expect(setupHelp).toContain('provider/modelo');
    expect(doctorHelp).toContain('Diagnostica o ambiente local');
    expect(doctorHelp).toContain('SecretRefs');
    expect(rootHelp).not.toMatch(legacyIdentityPattern);
    expect(setupHelp).not.toMatch(legacyIdentityPattern);
    expect(doctorHelp).not.toMatch(legacyIdentityPattern);
  });

  it('renders go dry-run as a safe product doorway', () => {
    const output = formatZavorthGoReport(makeAccessReport(false), { dryRun: true });

    expect(output).toContain('Zavorth');
    expect(output).toContain('Dry-run concluido; nada foi alterado');
    expect(output).toContain('Ajuste necessario');
    expect(output).toContain('Causa provavel');
    expect(output).toContain('> zavorth doctor');
    expect(output).toContain('> zavorth status');
    expect(output).toContain('dry-run: nada foi aplicado');
    expect(output).not.toContain('stack');
    expect(output).not.toMatch(legacyIdentityPattern);
  });

  it('keeps create-zavorth help and dry-run coherent and safe', () => {
    const createBin = path.join(process.cwd(), CREATE_BIN);
    const help = execFileSync(process.execPath, [createBin, '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const dryRun = execFileSync(process.execPath, [createBin, '--dry-run'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(help).toContain('Create Zavorth');
    expect(help).toContain('Safe by default');
    expect(help).toContain('no secrets are requested or stored');
    expect(dryRun).toContain('Create Zavorth dry-run');
    expect(dryRun).toContain('no files were written');
    expect(dryRun).toContain('no runtime was started');
    expect(dryRun).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(`${help}\n${dryRun}`);
  });

  it('documents the terminal polish gate without publish or dangerous actions', () => {
    const doc = read(DOC_278);

    expect(doc).toContain('Zavorth Terminal Product Experience Pack');
    expect(doc).toContain('zavorth-terminal-product-experience-ready');
    expect(doc).toContain('npmPublishActuallyPerformed=false');
    expect(doc).toContain('runtimePersistentStartPerformed=false');
    expect(doc).toContain('oldIdentityPublicLeak=false');
    expect(doc).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(doc);
  });
});
