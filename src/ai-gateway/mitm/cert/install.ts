import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { execElevatedWindowsScript, execWithPassword } from "../dns/dnsConfig";
import { logger } from '@/shared/utils/logger';
const IS_WIN = process.platform === "win32";
const TARGET_HOST = "daily-cloudcode-pa.googleapis.com";
const SYSTEM_KEYCHAIN = "/Library/Keychains/System.keychain";

// Get SHA1 fingerprint from cert file using Node.js crypto.
function getCertFingerprint(certPath) {
  const pem = fs.readFileSync(certPath, "utf-8");
  return crypto
    .createHash("sha1")
    .update(Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64"))
    .digest("hex")
    .toUpperCase()
    .match(/.{2}/g)
    .join(":");
}

function execFileCapture(file, args) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        maxBuffer: 1024 * 1024,
        timeout: 30_000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

/**
 * Check if certificate is already installed in system store.
 */
export async function checkCertInstalled(certPath) {
  if (IS_WIN) {
    return checkCertInstalledWindows();
  }
  return checkCertInstalledMac(certPath);
}

async function checkCertInstalledMac(certPath) {
  try {
    const fingerprint = getCertFingerprint(certPath);
    const stdout = await execFileCapture("security", [
      "find-certificate",
      "-a",
      "-Z",
      SYSTEM_KEYCHAIN,
    ]);
    return String(stdout).toUpperCase().includes(fingerprint);
  } catch (error: unknown) {logger.warn('[install] process execution failed', error); return false; }
}

async function checkCertInstalledWindows() {
  try {
    await execFileCapture("certutil", ["-store", "Root", TARGET_HOST]);
    return true;
  } catch (error: unknown) {logger.warn('[install] process execution failed', error); return false; }
}

/**
 * Install SSL certificate to system trust store.
 */
export async function installCert(sudoPassword, certPath) {
  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificate file not found: ${certPath}`);
  }

  const isInstalled = await checkCertInstalled(certPath);
  if (isInstalled) {
    console.log("Certificate already installed");
    return;
  }

  if (IS_WIN) {
    await installCertWindows(certPath);
  } else {
    await installCertMac(sudoPassword, certPath);
  }
}

async function installCertMac(sudoPassword, certPath) {
  try {
    await execWithPassword(
      "sudo",
      [
        "-S",
        "security",
        "add-trusted-cert",
        "-d",
        "-r",
        "trustRoot",
        "-k",
        SYSTEM_KEYCHAIN,
        certPath,
      ],
      sudoPassword
    );
    console.log(`Installed certificate to system keychain: ${certPath}`);
  } catch (error: unknown) {
    const msg = error.message?.includes("canceled")
      ? "User canceled authorization"
      : "Certificate install failed";
    throw new Error(msg);
  }
}

async function installCertWindows(certPath) {
  const certFile = escapePowerShellSingleQuoted(certPath);
  await execElevatedWindowsScript(`
Import-Certificate -FilePath '${certFile}' -CertStoreLocation 'Cert:\\LocalMachine\\Root' | Out-Null
`);
  console.log("Installed certificate to Windows Root store");
}

/**
 * Uninstall SSL certificate from system store.
 */
export async function uninstallCert(sudoPassword, certPath) {
  const isInstalled = await checkCertInstalled(certPath);
  if (!isInstalled) {
    console.log("Certificate not found in system store");
    return;
  }

  if (IS_WIN) {
    await uninstallCertWindows();
  } else {
    await uninstallCertMac(sudoPassword, certPath);
  }
}

async function uninstallCertMac(sudoPassword, certPath) {
  const fingerprint = getCertFingerprint(certPath).replace(/:/g, "");
  try {
    await execWithPassword(
      "sudo",
      ["-S", "security", "delete-certificate", "-Z", fingerprint, SYSTEM_KEYCHAIN],
      sudoPassword
    );
    console.log("Uninstalled certificate from system keychain");
  } catch (error: unknown) {throw new Error("Failed to uninstall certificate");
  }
}

async function uninstallCertWindows() {
  const subject = escapePowerShellSingleQuoted(`CN=${TARGET_HOST}`);
  await execElevatedWindowsScript(`
Get-ChildItem -Path 'Cert:\\LocalMachine\\Root' |
  Where-Object { $_.Subject -eq '${subject}' } |
  Remove-Item
`);
  console.log("Uninstalled certificate from Windows Root store");
}
