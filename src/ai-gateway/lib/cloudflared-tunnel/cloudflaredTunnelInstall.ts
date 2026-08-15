import { execFile } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import proxyFetch from "@zavorth/ai-gateway/open-sse/utils/proxyFetch.ts";
import { promisify } from "util";
import {
  CLOUDFLARED_RELEASE_BASE,
  type AssetSpec,
  type BinaryResolution,
  type PersistedTunnelState,
} from "./cloudflaredTunnelTypes";
import { ensureTunnelDir, getManagedBinaryPath, getTunnelDir } from "./cloudflaredTunnelPaths";

import { logger } from '@/shared/utils/logger';const execFileAsync = promisify(execFile);

export function getCloudflaredAssetSpec(
  platform = process.platform,
  arch = process.arch
): AssetSpec | null {
  const matrix: Record<string, Record<string, Omit<AssetSpec, "downloadUrl">>> = {
    linux: {
      x64: {
        assetName: "cloudflared-linux-amd64",
        binaryName: "cloudflared",
        archive: "none",
      },
      arm64: {
        assetName: "cloudflared-linux-arm64",
        binaryName: "cloudflared",
        archive: "none",
      },
    },
    darwin: {
      x64: {
        assetName: "cloudflared-darwin-amd64.tgz",
        binaryName: "cloudflared",
        archive: "tgz",
      },
      arm64: {
        assetName: "cloudflared-darwin-arm64.tgz",
        binaryName: "cloudflared",
        archive: "tgz",
      },
    },
    win32: {
      x64: {
        assetName: "cloudflared-windows-amd64.exe",
        binaryName: "cloudflared.exe",
        archive: "none",
      },
      arm64: {
        assetName: "cloudflared-windows-arm64.exe",
        binaryName: "cloudflared.exe",
        archive: "none",
      },
    },
  };

  const spec = matrix[platform]?.[arch];
  if (!spec) return null;

  return {
    ...spec,
    downloadUrl: `${CLOUDFLARED_RELEASE_BASE}/${spec.assetName}`,
  };
}

async function resolvePathCommand(command: string) {
  const lookupCommand = process.platform === "win32" ? "where" : "which";
  const args = [command];

  try {
    const { stdout } = await execFileAsync(lookupCommand, args, { timeout: 3000 });
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first || null;
  } catch (error: unknown) {logger.warn('[cloudflared Tunnel Install] process execution failed', error); return null; }
}

export async function resolveBinary(): Promise<BinaryResolution> {
  const envPath = String(process.env.CLOUDFLARED_BIN || "").trim();
  if (envPath && fsSync.existsSync(envPath)) {
    return { binaryPath: envPath, source: "env", managed: false };
  }

  const managedPath = getManagedBinaryPath();
  if (fsSync.existsSync(managedPath)) {
    return { binaryPath: managedPath, source: "managed", managed: true };
  }

  const pathBinary = await resolvePathCommand("cloudflared");
  if (pathBinary) {
    return { binaryPath: pathBinary, source: "path", managed: false };
  }

  return { binaryPath: null, source: null, managed: false };
}

async function extractArchive(archivePath: string, destinationDir: string) {
  await execFileAsync("tar", ["-xzf", archivePath, "-C", destinationDir], { timeout: 15000 });
}

async function downloadToFile(url: string, destinationPath: string) {
  const response = await proxyFetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destinationPath, buffer);
}

async function ensureExecutable(binaryPath: string) {
  if (process.platform !== "win32") {
    await fs.chmod(binaryPath, 0o755);
  }
}

export async function installManagedBinary(input: {
  installPromiseRef: { current: Promise<string> | null };
  updateStateFile: (patch: PersistedTunnelState) => Promise<void>;
}) {
  if (input.installPromiseRef.current) return input.installPromiseRef.current;

  input.installPromiseRef.current = (async () => {
    const spec = getCloudflaredAssetSpec();
    if (!spec) {
      throw new Error(
        `Unsupported platform for managed cloudflared install: ${process.platform}/${process.arch}`
      );
    }

    await ensureTunnelDir();
    const managedBinaryPath = getManagedBinaryPath();
    const tempDownloadPath = path.join(getTunnelDir(), `${spec.assetName}.download`);

    await input.updateStateFile({
      status: "starting",
      lastError: null,
    });

    try {
      await downloadToFile(spec.downloadUrl, tempDownloadPath);

      if (spec.archive === "tgz") {
        await extractArchive(tempDownloadPath, path.dirname(managedBinaryPath));
      } else {
        await fs.rename(tempDownloadPath, managedBinaryPath);
      }

      await ensureExecutable(managedBinaryPath);
      await input.updateStateFile({
        binaryPath: managedBinaryPath,
        installSource: "managed",
        installedAt: new Date().toISOString(),
        lastError: null,
      });

      return managedBinaryPath;
    } finally {
      try {
        await fs.unlink(tempDownloadPath);
      } catch (error: unknown) {// Ignore temp cleanup issues.
      logger.warn('[cloudflared Tunnel Install] file cleanup failed', error);
    }
      input.installPromiseRef.current = null;
    }
  })();

  return input.installPromiseRef.current;
}

export async function ensureBinary(input: {
  installPromiseRef: { current: Promise<string> | null };
  updateStateFile: (patch: PersistedTunnelState) => Promise<void>;
}): Promise<BinaryResolution> {
  const resolved = await resolveBinary();
  if (resolved.binaryPath) {
    return resolved;
  }

  const binaryPath = await installManagedBinary(input);
  return {
    binaryPath,
    source: "managed" as const,
    managed: true,
  };
}
