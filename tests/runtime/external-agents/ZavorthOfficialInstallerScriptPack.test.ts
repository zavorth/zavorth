import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_RUNTIME_ID,
  createZavorthOfficialInstallerScriptPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const BOUNDARY = 'src/runtime/external-agents/ZavorthOfficialInstallerScriptPack.ts';
const INDEX = 'src/runtime/external-agents/index.release-packs.ts';
const POWERSHELL_INSTALLER = 'scripts/install-zavorth.ps1';
const BASH_INSTALLER = 'scripts/install-zavorth.sh';
const PUBLIC_DOCS = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/34-zavorth-cli.md',
];

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

describe('Zavorth official installer script pack', () => {
  const pack = createZavorthOfficialInstallerScriptPackFixture();

  it('exports the pack 280 boundary and final ready state', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthOfficialInstallerScriptPack/v1');
    expect(boundary).toContain('ZavorthInstallerDefinition/v1');
    expect(index).toContain("from './ZavorthOfficialInstallerScriptPack.js'");
    expect(pack.normalization.packId).toBe('280');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_OFFICIAL_INSTALLER_SCRIPT_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-official-installer-scripts-ready');
    expect(pack.allInstallersReady()).toBe(true);
  });

  it('models PowerShell and Bash installers with dry-run-first behavior', () => {
    expect(pack.normalization.installers.map((installer) => installer.shell)).toEqual(['powershell', 'bash']);
    expect(pack.normalization.powershellInstaller).toEqual(expect.objectContaining({
      path: POWERSHELL_INSTALLER,
      dryRunFlag: '-DryRun',
      tagFlag: '-Tag',
      defaultTag: 'latest',
      installCommand: 'npm install -g zavorth@latest',
      realInstallOnlyOutsideDryRun: true,
    }));
    expect(pack.normalization.bashInstaller).toEqual(expect.objectContaining({
      path: BASH_INSTALLER,
      dryRunFlag: '--dry-run',
      tagFlag: '--tag',
      defaultTag: 'latest',
      installCommand: 'npm install -g zavorth@latest',
      realInstallOnlyOutsideDryRun: true,
    }));
    expect(pack.normalization.dryRunBehavior).toEqual(expect.objectContaining({
      performsGlobalInstall: false,
      startsPersistentRuntime: false,
      writesSecrets: false,
      callsProviderToolCommandOrMessage: false,
      printsPlannedCommands: true,
    }));
  });

  it('creates installer scripts that check prerequisites and only install outside dry-run', () => {
    const ps = read(POWERSHELL_INSTALLER);
    const sh = read(BASH_INSTALLER);

    expect(ps).toContain('[switch]$DryRun');
    expect(ps).toContain("[string]$Tag = 'latest'");
    expect(ps).toContain('& $nodeExe --version');
    expect(ps).toContain('& $npmExe --version');
    expect(ps).toContain('Would run: npm install -g');
    expect(ps).toContain("@('install', '-g', $packageSpec)");
    expect(ps).toContain('zavorth help doctor');
    expect(ps.indexOf('if ($DryRun)')).toBeLessThan(ps.indexOf("@('install', '-g', $packageSpec)"));

    expect(sh).toContain('set -euo pipefail');
    expect(sh).toContain('tag="latest"');
    expect(sh).toContain('--dry-run');
    expect(sh).toContain('--tag');
    expect(sh).toContain('node --version');
    expect(sh).toContain('npm --version');
    expect(sh).toContain('Would run: npm install -g');
    expect(sh).toContain('npm install -g "$package_spec"');
    expect(sh).toContain('zavorth help doctor');
    expect(sh.indexOf('if [[ "$dry_run" -eq 1 ]]')).toBeLessThan(sh.indexOf('npm install -g "$package_spec"'));

    assertNoRawSecret(`${ps}\n${sh}`);
  });

  it('documents latest package install path in public docs', () => {
    const publicDocs = PUBLIC_DOCS.map(read).join('\n');

    expect(publicDocs).toContain('npm install -g zavorth@latest');
    expect(publicDocs).not.toContain('zavorth@alpha');
    expect(publicDocs).not.toContain('npm alpha');
    assertNoRawSecret(publicDocs);
  });

  it('keeps dangerous actions blocked', () => {
    expect(pack.blockedActionPerformed()).toBe(false);
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      powershellInstallerReady: true,
      bashInstallerReady: true,
      hostedInstallerPrepared: true,
      hostedInstallerActuallyDeployed: false,
      dryRunSupported: true,
      defaultInstallTag: 'latest',
      globalInstallPerformed: false,
      npmPublishActuallyPerformed: false,
      versionChanged: false,
      distTagChanged: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.blockedActions.map((action) => action.action)).toEqual(expect.arrayContaining([
      'npm-publish',
      'version-change',
      'npm-dist-tag-change',
      'global-install-during-tests',
      'runtime-persistent-start',
      'secret-write',
      'provider-execution',
      'tool-command-execution',
      'message-send',
      'raw-import',
      'domain-purchase',
      'dns-config',
      'github-release-create',
    ]));
    assertNoRawSecret(JSON.stringify(pack.normalization));
  });
});
