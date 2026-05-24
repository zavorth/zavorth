import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export type ZavorthReleaseChannelId = 'stable' | 'beta' | 'nightly' | 'dev';

export type ZavorthReleaseChannel = {
  id: ZavorthReleaseChannelId;
  npmTag: string;
  label: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
  checksum: string;
  version?: string;
  packageSpec?: string;
  artifactUrl?: string;
  artifactSha256?: string;
};

export type ZavorthVersionSnapshot = {
  packageName: string;
  currentVersion: string;
  channel: ZavorthReleaseChannelId;
  manifestPath: string;
  manifestChecksum: string;
  channels: ZavorthReleaseChannel[];
};

export type ZavorthUpdatePlan = {
  ok: boolean;
  applied: boolean;
  channel: ZavorthReleaseChannel;
  packageSpec: string;
  command: string;
  requiresConfirmation: boolean;
  checksum: string;
  manifestSource: string;
  manifestChecksum: string;
  artifact?: {
    url: string;
    sha256: string;
    verified?: boolean;
    downloadedPath?: string;
  };
  message: string;
  stdout?: string;
  stderr?: string;
};

const CHANNELS: Array<Omit<ZavorthReleaseChannel, 'checksum'>> = [
  {
    id: 'stable',
    npmTag: 'latest',
    label: 'Stable',
    risk: 'low',
    description: 'Recommended daily channel. Receives releases after QA gates pass.',
  },
  {
    id: 'beta',
    npmTag: 'beta',
    label: 'Beta',
    risk: 'medium',
    description: 'Limited public testing channel. New product changes before stable.',
  },
  {
    id: 'nightly',
    npmTag: 'nightly',
    label: 'Nightly',
    risk: 'high',
    description: 'Automated preview channel for fast feedback. Expect breakage.',
  },
  {
    id: 'dev',
    npmTag: 'dev',
    label: 'Dev',
    risk: 'high',
    description: 'Developer channel for local/maintainer testing.',
  },
];

export class ZavorthReleaseChannelService {
  constructor(private readonly projectRoot = process.cwd()) {}

  listChannels(): ZavorthReleaseChannel[] {
    return CHANNELS.map((channel) => ({
      ...channel,
      checksum: sha256(JSON.stringify(channel)),
    }));
  }

  resolveChannel(raw?: string | null): ZavorthReleaseChannel {
    const normalized = String(raw || process.env.ZAVORTH_CHANNEL || 'stable').trim().toLowerCase();
    const alias = normalized === 'latest' ? 'stable' : normalized;
    const match = this.listChannels().find((channel) => channel.id === alias || channel.npmTag === alias);
    if (!match) {
      throw new Error(`Unknown Zavorth release channel '${raw}'. Expected stable, beta, nightly or dev.`);
    }
    return match;
  }

  buildVersionSnapshot(rawChannel?: string | null): ZavorthVersionSnapshot {
    const pkg = this.readPackageJson();
    const manifestPath = this.resolveManifestPath();
    return {
      packageName: String(pkg.name || 'zavorth'),
      currentVersion: String(pkg.version || '0.0.0'),
      channel: this.resolveChannel(rawChannel).id,
      manifestPath,
      manifestChecksum: this.manifestChecksum(),
      channels: this.listChannels(),
    };
  }

  buildUpdatePlan(input: { channel?: string | null; yes?: boolean; manifest?: string | null; artifact?: boolean }): ZavorthUpdatePlan {
    const manifest = this.loadReleaseManifest(input.manifest || null);
    const channel = this.resolveChannelFromManifest(input.channel, manifest);
    const packageName = String(this.readPackageJson().name || 'zavorth');
    const packageSpec = channel.packageSpec || `${packageName}@${channel.npmTag}`;
    const command = `npm install -g ${packageSpec}`;
    const manifestChecksum = sha256(JSON.stringify(manifest.payload));
    const checksum = sha256(`${packageSpec}:${channel.checksum}:${manifestChecksum}`);
    const artifact = channel.artifactUrl && channel.artifactSha256
      ? { url: channel.artifactUrl, sha256: channel.artifactSha256 }
      : undefined;

    if (!input.yes) {
      return {
        ok: true,
        applied: false,
        channel,
        packageSpec,
        command,
        requiresConfirmation: true,
        checksum,
        manifestSource: manifest.source,
        manifestChecksum,
        artifact,
        message: `Preview only. Re-run with --yes to update through the ${channel.id} channel.`,
      };
    }

    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npmExecutable, ['install', '-g', packageSpec], {
      cwd: this.projectRoot,
      encoding: 'utf8',
      shell: false,
    });
    const ok = result.status === 0 && !result.error;
    return {
      ok,
      applied: ok,
      channel,
      packageSpec,
      command,
      requiresConfirmation: false,
      checksum,
      manifestSource: manifest.source,
      manifestChecksum,
      artifact,
      message: ok
        ? `Zavorth updated through the ${channel.id} channel.`
        : `Zavorth update failed through the ${channel.id} channel.`,
      stdout: String(result.stdout || '').slice(0, 4000),
      stderr: String(result.stderr || result.error?.message || '').slice(0, 4000),
    };
  }

  verifyArtifact(input: { url: string; sha256: string; outputDir?: string }): { ok: boolean; path: string; sha256: string; message: string } {
    const outputDir = input.outputDir || path.join(this.projectRoot, '.zavorth', 'updates');
    fs.mkdirSync(outputDir, { recursive: true });
    if (!/^file:\/\//iu.test(input.url) && !path.isAbsolute(input.url)) {
      return { ok: false, path: '', sha256: '', message: 'Only local file artifacts are verified by the offline updater. Use installer for remote binary downloads.' };
    }
    const sourcePath = input.url.startsWith('file://') ? new URL(input.url).pathname : input.url;
    const data = fs.readFileSync(sourcePath);
    const actual = sha256(data);
    const outputPath = path.join(outputDir, path.basename(sourcePath));
    if (actual !== input.sha256) return { ok: false, path: outputPath, sha256: actual, message: 'Artifact checksum mismatch.' };
    fs.writeFileSync(outputPath, data);
    return { ok: true, path: outputPath, sha256: actual, message: 'Artifact checksum verified and staged.' };
  }

  writeReleaseManifest(target = path.join(this.projectRoot, 'scripts', 'release-manifest.json')): string {
    const snapshot = this.buildVersionSnapshot();
    const manifest = {
      schemaVersion: 'zavorth-release-channels/1',
      generatedAt: new Date().toISOString(),
      packageName: snapshot.packageName,
      currentVersion: snapshot.currentVersion,
      channels: snapshot.channels,
      installer: {
        unix: 'ZAVORTH_CHANNEL=beta curl -fsSL https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.sh | bash',
        windows: '$env:ZAVORTH_CHANNEL="beta"; irm https://raw.githubusercontent.com/zavorth/zavorth-core/main/Zavorth/scripts/install.ps1 | iex',
      },
    };
    fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return target;
  }

  private readPackageJson(): Record<string, unknown> {
    const packagePath = path.join(this.projectRoot, 'package.json');
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as Record<string, unknown>;
  }

  private resolveManifestPath(): string {
    return path.join(this.projectRoot, 'scripts', 'release-manifest.json');
  }

  private manifestChecksum(): string {
    const manifestPath = this.resolveManifestPath();
    if (!fs.existsSync(manifestPath)) {
      return sha256(JSON.stringify(this.listChannels()));
    }
    return sha256(fs.readFileSync(manifestPath));
  }

  private loadReleaseManifest(source: string | null): { source: string; payload: Record<string, unknown> } {
    const selected = source || process.env.ZAVORTH_RELEASE_MANIFEST || this.resolveManifestPath();
    if (/^https?:\/\//iu.test(selected)) {
      throw new Error('Remote manifest verification is available through the installer. CLI self-update accepts local manifest paths for deterministic safety.');
    }
    if (!fs.existsSync(selected)) return { source: 'built-in', payload: { channels: this.listChannels() } };
    return { source: selected, payload: JSON.parse(fs.readFileSync(selected, 'utf8')) as Record<string, unknown> };
  }

  private resolveChannelFromManifest(raw: string | null | undefined, manifest: { payload: Record<string, unknown> }): ZavorthReleaseChannel {
    const fallback = this.resolveChannel(raw);
    const channels = Array.isArray(manifest.payload.channels) ? manifest.payload.channels as Array<Record<string, unknown>> : [];
    const normalized = String(raw || process.env.ZAVORTH_CHANNEL || 'stable').trim().toLowerCase();
    const alias = normalized === 'latest' ? 'stable' : normalized;
    const match = channels.find((entry) => String(entry.id || '').toLowerCase() === alias || String(entry.npmTag || '').toLowerCase() === alias);
    if (!match) return fallback;
    return {
      ...fallback,
      ...match,
      id: fallback.id,
      npmTag: String(match.npmTag || fallback.npmTag),
      label: String(match.label || fallback.label),
      risk: (['low', 'medium', 'high'].includes(String(match.risk)) ? String(match.risk) : fallback.risk) as ZavorthReleaseChannel['risk'],
      description: String(match.description || fallback.description),
      checksum: String(match.checksum || sha256(JSON.stringify(match))),
      version: match.version ? String(match.version) : undefined,
      packageSpec: match.packageSpec ? String(match.packageSpec) : undefined,
      artifactUrl: match.artifactUrl ? String(match.artifactUrl) : undefined,
      artifactSha256: match.artifactSha256 ? String(match.artifactSha256) : undefined,
    };
  }
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
