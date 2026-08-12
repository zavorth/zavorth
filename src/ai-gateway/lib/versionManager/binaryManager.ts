import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { getChecksums, getReleaseByVersion } from "./releaseChecker.ts";
import { safeFetch } from "../../../security/SafeFetchService.js";
import { logger } from '../../shared/utils/logger.js';
import { asErrorLike } from '../../../utils/errorLike';

const execFileAsync = promisify(execFile);
const DEFAULT_DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), ".ZavorthGateway");

type Platform = "linux" | "darwin" | "windows" | "freebsd";
type Arch = "amd64" | "arm64";

function assertSafeVersion(version: string): string {
  const normalized = String(version || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(normalized) || normalized.includes("..")) {
    throw new Error("Invalid release version");
  }
  return normalized;
}

function detectPlatform(): Platform {
  const p = process.platform;
  if (p === "linux") return "linux";
  if (p === "darwin") return "darwin";
  if (p === "win32") return "windows";
  return "linux";
}

function detectArch(): Arch {
  const a = process.arch;
  if (a === "x64") return "amd64";
  if (a === "arm64") return "arm64";
  return "amd64";
}

export function getAssetName(platform?: Platform, arch?: Arch): string {
  const plat = platform || detectPlatform();
  const arc = arch || detectArch();
  return `CLIProxyAPI_{version}_${plat}_${arc}${plat === "windows" ? ".zip" : ".tar.gz"}`;
}

export function getTargetPlatform(): { platform: Platform; arch: Arch } {
  return { platform: detectPlatform(), arch: detectArch() };
}

async function downloadFile(url: string, dest: string, signal?: AbortSignal): Promise<void> {
  const res = await safeFetch(url, { signal }, {
    maxRedirects: 5,
    serviceName: "CLIProxyAPI binary download",
  });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  const fileStream = fsSync.createWriteStream(dest);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, fileStream);
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  await validateArchiveEntries("tar", archivePath);
  await execFileAsync("tar", ["xzf", archivePath, "-C", destDir]);
}

async function extractZip(archivePath: string, destDir: string): Promise<void> {
  await validateArchiveEntries("zip", archivePath);
  await execFileAsync("unzip", ["-o", archivePath, "-d", destDir]);
}

async function verifyChecksum(filePath: string, expectedSha256: string): Promise<boolean> {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (data: Buffer) => hash.update(data));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return hash.digest("hex").toLowerCase() === expectedSha256.toLowerCase();
}

function findBinaryInDir(dir: string): string | null {
  const candidates = ["cli-proxy-api", "cli-proxy-api.exe", "CLIProxyAPI", "CLIProxyAPI.exe"];
  for (const name of candidates) {
    if (fsSync.existsSync(path.join(dir, name))) return path.join(dir, name);
  }
  return null;
}

async function validateArchiveEntries(kind: "tar" | "zip", archivePath: string): Promise<void> {
  const command = kind === "tar" ? "tar" : "unzip";
  const args = kind === "tar" ? ["tzf", archivePath] : ["-Z1", archivePath];
  const { stdout } = await execFileAsync(command, args, { timeout: 15_000, maxBuffer: 1024 * 1024 });
  const entries = stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    throw new Error(`${kind} archive is empty or could not be listed`);
  }
  const unsafe = entries.find((entry) => !isSafeArchiveEntry(entry));
  if (unsafe) {
    throw new Error(`Unsafe ${kind} archive entry blocked: ${unsafe}`);
  }
}

function isSafeArchiveEntry(entry: string): boolean {
  const normalized = entry.replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0")) {
    return false;
  }
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    return false;
  }
  return !normalized.split("/").some((segment) => segment === "..");
}

export async function downloadRelease(
  version: string,
  targetDir: string,
  signal?: AbortSignal
): Promise<string> {
  version = assertSafeVersion(version);
  const release = await getReleaseByVersion(version);
  if (!release) throw new Error(`Version ${version} not found`);
  assertSafeVersion(release.version);

  const { platform, arch } = getTargetPlatform();
  const ext = platform === "windows" ? ".zip" : ".tar.gz";
  const assetName = `CLIProxyAPI_${release.version}_${platform}_${arch}${ext}`;
  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) throw new Error(`No asset for ${platform}/${arch}`);

  const versionDir = path.join(targetDir, `cliproxyapi-${version}`);
  await fs.mkdir(versionDir, { recursive: true });

  const archivePath = path.join(versionDir, assetName);
  await downloadFile(asset.url, archivePath, signal);

  const checksums = await getChecksums(version);
  const expected = checksums.get(assetName);
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
    await fs.unlink(archivePath).catch(() => undefined);
    throw new Error(`Trusted SHA256 checksum missing for ${assetName}`);
  }
  const valid = await verifyChecksum(archivePath, expected);
  if (!valid) {
    await fs.unlink(archivePath).catch(() => undefined);
    throw new Error(`SHA256 checksum mismatch for ${assetName}`);
  }

  if (platform === "windows") {
    await extractZip(archivePath, versionDir);
  } else {
    await extractTarGz(archivePath, versionDir);
  }

  await fs.unlink(archivePath).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });

  const binary = findBinaryInDir(versionDir);
  if (!binary) throw new Error(`Binary not found in extracted archive`);

  await fs.chmod(binary, 0o755);
  return binary;
}

export async function installVersion(version: string, dataDir?: string): Promise<string> {
  const dir = dataDir || DEFAULT_DATA_DIR;
  const binDir = path.join(dir, "bin");
  await fs.mkdir(binDir, { recursive: true });

  const binary = await downloadRelease(version, binDir);

  const symlinkPath = path.join(binDir, "cliproxyapi");
  try {
    await fs.unlink(symlinkPath);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[auto-fix] Empty catch block", err); }
  if (process.platform === "win32") {
    await fs.copyFile(binary, symlinkPath);
  } else {
    await fs.symlink(binary, symlinkPath);
  }

  return symlinkPath;
}

export async function getCurrentBinaryPath(dataDir?: string): Promise<string | null> {
  const dir = dataDir || DEFAULT_DATA_DIR;
  const symlinkPath = path.join(dir, "bin", "cliproxyapi");
  try {
    const real = await fs.realpath(symlinkPath);
    return fsSync.existsSync(real) ? real : null;
  } catch (error: unknown) {logger.warn('[binary Manager] filesystem operation failed', error); return null; }
}

export async function getInstalledVersions(dataDir?: string): Promise<string[]> {
  const dir = dataDir || DEFAULT_DATA_DIR;
  const binDir = path.join(dir, "bin");
  try {
    const entries = await fs.readdir(binDir);
    return entries
      .filter(
        (e) => e.startsWith("cliproxyapi-") && fsSync.statSync(path.join(binDir, e)).isDirectory()
      )
      .map((e) => e.replace("cliproxyapi-", ""));
  } catch (error: unknown) {logger.warn('[binary Manager] filesystem operation failed', error); return []; }
}

export async function rollbackVersion(dataDir?: string): Promise<string | null> {
  const versions = await getInstalledVersions(dataDir);
  if (versions.length < 2) return null;

  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const previous = versions[1];

  const dir = dataDir || DEFAULT_DATA_DIR;
  const binDir = path.join(dir, "bin");
  const oldBinary = findBinaryInDir(path.join(binDir, `cliproxyapi-${previous}`));
  if (!oldBinary) return null;

  const symlinkPath = path.join(binDir, "cliproxyapi");
  try {
    await fs.unlink(symlinkPath);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[auto-fix] Empty catch block", err); }
  if (process.platform === "win32") {
    await fs.copyFile(oldBinary, symlinkPath);
  } else {
    await fs.symlink(oldBinary, symlinkPath);
  }

  return previous;
}

export async function removeVersion(version: string, dataDir?: string): Promise<boolean> {
  try {
    version = assertSafeVersion(version);
  } catch {
    return false;
  }
  const dir = dataDir || DEFAULT_DATA_DIR;
  const versionDir = path.join(dir, "bin", `cliproxyapi-${version}`);
  try {
    await fs.rm(versionDir, { recursive: true, force: true });
    return true;
  } catch (error: unknown) {logger.warn('[binary Manager] delete operation failed', error); return false; }
}
