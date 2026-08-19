/**
 * Zavorth Plugin SDK - Remote Plugin Installer.
 * Downloads, verifies cryptographic signatures (Ed25519 / SHA-256), extracts,
 * and stages remote plugins from URLs and GitHub repositories.
 * Strictly typed (Zero any) and EN-First.
 */

import { logger } from '../logger.js';
import { PluginUrlInstallService, type PluginUrlDownloadResult } from '../services/PluginUrlInstallService.js';
import { PluginSignatureService, type PluginVerifyResult } from '../services/PluginSignatureService.js';

export interface RemoteInstallOptions {
  url: string;
  requireSignature?: boolean;
  publicKeyPem?: string;
}

export interface RemoteInstallResult {
  ok: boolean;
  pluginId?: string;
  packageDir?: string;
  verified: boolean;
  checksum?: string;
  error?: string;
}

export class PluginRemoteInstaller {
  private readonly urlInstallService: PluginUrlInstallService;
  private readonly signatureService: PluginSignatureService;

  constructor(
    urlInstallService: PluginUrlInstallService = new PluginUrlInstallService(),
    signatureService: PluginSignatureService = new PluginSignatureService(),
  ) {
    this.urlInstallService = urlInstallService;
    this.signatureService = signatureService;
  }

  /**
   * Installs and verifies a remote plugin package from an HTTPS URL.
   */
  public async installFromUrl(options: RemoteInstallOptions): Promise<RemoteInstallResult> {
    logger.info(`[PluginInstaller] Starting remote plugin installation from "${options.url}".`);

    try {
      const downloadResult: PluginUrlDownloadResult = await this.urlInstallService.downloadAndExtract(
        options.url
      );

      if (!downloadResult.ok || !downloadResult.packageDir) {
        return {
          ok: false,
          error: downloadResult.error || 'Failed to download or extract remote plugin archive.',
          verified: false,
        };
      }

      // Cryptographic signature check
      let isVerified = false;
      if (downloadResult.verify) {
        isVerified = downloadResult.verify.ok;
      } else {
        const verifyCheck: PluginVerifyResult = this.signatureService.verifyPackage(downloadResult.packageDir, {
          requireSignature: options.requireSignature,
          publicKeyPem: options.publicKeyPem,
        });
        isVerified = verifyCheck.ok;
      }

      logger.info(`[PluginInstaller] Successfully installed plugin "${downloadResult.pluginId}" (verified: ${isVerified}).`);

      return {
        ok: true,
        pluginId: downloadResult.pluginId,
        packageDir: downloadResult.packageDir,
        verified: isVerified,
        checksum: downloadResult.verify?.packageChecksum,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[PluginInstaller] Installation failed: ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg,
        verified: false,
      };
    }
  }

  /**
   * Verifies an existing local plugin package directory.
   */
  public verifyLocalPackage(packageDir: string, publicKeyPem?: string): PluginVerifyResult {
    return this.signatureService.verifyPackage(packageDir, {
      publicKeyPem,
      requireSignature: false,
    });
  }
}
