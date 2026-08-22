import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

export type CompanionDistributionFileRole = 'runtime' | 'launcher' | 'package' | 'readme';

export type CompanionDistributionFileManifest = {
  path: string;
  role: CompanionDistributionFileRole;
  bytes: number;
  sha256: string;
};

export type CompanionDistributionManifest = {
  name: string;
  version: string;
  generatedAt: string;
  entry: string;
  runtimeEntry: string;
  recommendedCommand: string;
  requiredNodeVersion: string;
  updateChannel: 'local-stable';
  capabilities: string[];
  files: CompanionDistributionFileManifest[];
  sha256: string;
};

export type CompanionDistributionBundle = {
  bundleDir: string;
  manifestPath: string;
  launcherPs1Path: string;
  launcherCmdPath: string;
  readmePath: string;
  files: string[];
  manifest: CompanionDistributionManifest;
};

type CompanionDistributionRuntime = {
  projectRoot?: string;
  distEntry?: string;
  appEntry?: string;
  appPackageFile?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  copyFileSync?: typeof fs.copyFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  now?: () => Date;
};

export class CompanionDistributionService {
  private static readonly companionCapabilities = [
    'device.info',
    'system.run',
    'files.read',
    'files.write',
    'files.watch',
    'browser.proxy',
    'clipboard.read',
    'clipboard.write',
    'notifications.send',
    'screen.capture',
  ];

  private readonly projectRoot: string;
  private readonly distEntry: string;
  private readonly appEntry: string;
  private readonly appPackageFile: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly copyFileSync: typeof fs.copyFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly now: () => Date;

  constructor(runtime: CompanionDistributionRuntime = {}) {
    this.projectRoot = runtime.projectRoot || path.resolve(process.cwd());
    this.distEntry = runtime.distEntry || path.resolve(this.projectRoot, 'dist', 'companion.js');
    this.appEntry = runtime.appEntry || path.resolve(this.projectRoot, 'apps', 'zavorth-companion', 'index.js');
    this.appPackageFile = runtime.appPackageFile || path.resolve(this.projectRoot, 'apps', 'zavorth-companion', 'package.json');
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.copyFileSync = runtime.copyFileSync || fs.copyFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.now = runtime.now || (() => new Date());
  }

  public buildBundle(outputRoot?: string): CompanionDistributionBundle {
    if (!this.existsSync(this.distEntry)) {
      throw new Error('Companion build missing. Run `npm run build` before empacotar o companion.');
    }
    if (!this.existsSync(this.appEntry) || !this.existsSync(this.appPackageFile)) {
      throw new Error('Companion app files not found.');
    }

    const bundleDir = path.resolve(outputRoot || path.join(this.projectRoot, 'output', 'distribution', 'zavorth-companion'));
    const runtimeDir = path.join(bundleDir, 'runtime');
    this.mkdirSync(bundleDir, { recursive: true });
    this.mkdirSync(runtimeDir, { recursive: true });

    const files: string[] = [];
    const copy = (source: string, target: string) => {
      this.mkdirSync(path.dirname(target), { recursive: true });
      this.copyFileSync(source, target);
      files.push(target);
    };

    const runtimeEntry = path.join(runtimeDir, 'companion.js');
    const launcherEntry = path.join(bundleDir, 'index.js');
    const packageFile = path.join(bundleDir, 'package.json');
    copy(this.distEntry, runtimeEntry);
    copy(this.appEntry, launcherEntry);
    copy(this.appPackageFile, packageFile);

    const manifestPath = path.join(bundleDir, 'distribution-manifest.json');
    const launcherPs1Path = path.join(bundleDir, 'companion-start.ps1');
    const launcherCmdPath = path.join(bundleDir, 'companion-start.cmd');
    const readmePath = path.join(bundleDir, 'README.txt');

    const appPackage = JSON.parse(String(this.readFileSync(this.appPackageFile, 'utf8') || '{}')) as Record<string, unknown>;
    this.writeFileSync(
      launcherPs1Path,
      [
        'param(',
        '  [string]$Passcode = "",',
        '  [string]$BaseUrl = "http://127.0.0.1:33333",',
        '  [string]$NodeId = ""',
        ')',
        '$ErrorActionPreference = "Stop"',
        '$argsList = @("index.js")',
        'if ($Passcode) { $argsList += @("--passcode", $Passcode) }',
        'if ($BaseUrl) { $argsList += @("--base-url", $BaseUrl) }',
        'if ($NodeId) { $argsList += @("--node-id", $NodeId) }',
        'node @argsList',
      ].join('\n'),
      'utf8',
    );
    files.push(launcherPs1Path);

    this.writeFileSync(
      launcherCmdPath,
      [
        '@echo off',
        'setlocal',
        'node index.js %*',
      ].join('\r\n'),
      'utf8',
    );
    files.push(launcherCmdPath);

    this.writeFileSync(
      readmePath,
      [
        'Zavorth Desktop Companion Bundle',
        '',
        'Quick flow:',
        '1. Gere um pairing draft no host com `npm run cli:fast -- nodepair desktop MeuDesktop`.',
        '2. Copy this folder to the operator device.',
        '3. Execute `companion-start.ps1 -Passcode "<nodeId:pairingCode>" -BaseUrl "http://127.0.0.1:33333"`.',
        '',
        'Main files:',
        '- index.js',
        '- runtime\\companion.js',
        '- companion-start.ps1',
        '- companion-start.cmd',
        '- distribution-manifest.json',
        '',
        'Troubleshooting:',
        '- Se o pairing expirar, gere um draft novo no host.',
        '- Se o host web mudar de address, ajuste -BaseUrl.',
        '- Review distribution-manifest.json for hashes and published capabilities.',
      ].join('\n'),
      'utf8',
    );
    files.push(readmePath);

    const manifest = this.buildManifest(appPackage, [
      this.buildFileManifestEntry(launcherEntry, 'index.js', 'launcher'),
      this.buildFileManifestEntry(packageFile, 'package.json', 'package'),
      this.buildFileManifestEntry(runtimeEntry, 'runtime/companion.js', 'runtime'),
      this.buildFileManifestEntry(launcherPs1Path, 'companion-start.ps1', 'launcher'),
      this.buildFileManifestEntry(launcherCmdPath, 'companion-start.cmd', 'launcher'),
      this.buildFileManifestEntry(readmePath, 'README.txt', 'readme'),
    ]);
    this.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    files.push(manifestPath);

    return {
      bundleDir,
      manifestPath,
      launcherPs1Path,
      launcherCmdPath,
      readmePath,
      files,
      manifest,
    };
  }

  public buildLauncherDownload(outputRoot?: string): {
    bundle: CompanionDistributionBundle;
    fileName: string;
    contentType: string;
    body: string;
  } {
    const bundle = this.buildBundle(outputRoot);
    return {
      bundle,
      fileName: 'zavorth-companion-start.ps1',
      contentType: 'text/plain; charset=utf-8',
      body: String(this.readFileSync(bundle.launcherPs1Path, 'utf8')),
    };
  }

  private buildManifest(
    appPackage: Record<string, unknown>,
    files: CompanionDistributionFileManifest[],
  ): CompanionDistributionManifest {
    const manifestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(files.map((entry) => [entry.path, entry.bytes, entry.sha256])))
      .digest('hex');

    return {
      name: String(appPackage.name || 'zavorth-companion'),
      version: String(appPackage.version || '1.0.0'),
      generatedAt: this.now().toISOString(),
      entry: 'index.js',
      runtimeEntry: 'runtime/companion.js',
      recommendedCommand: 'node index.js --passcode "<nodeId:pairingCode>" --base-url http://127.0.0.1:33333',
      requiredNodeVersion: '>=18.17.0',
      updateChannel: 'local-stable',
      capabilities: CompanionDistributionService.companionCapabilities,
      files,
      sha256: manifestHash,
    };
  }

  private buildFileManifestEntry(
    absolutePath: string,
    relativePath: string,
    role: CompanionDistributionFileRole,
  ): CompanionDistributionFileManifest {
    const raw = this.readFileSync(absolutePath);
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
    return {
      path: relativePath,
      role,
      bytes: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    };
  }
}
