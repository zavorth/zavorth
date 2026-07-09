import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../utils/errorLike.js';

const TARGET_HOST = "daily-cloudcode-pa.googleapis.com";
const IS_WIN = process.platform === "win32";
const HOSTS_FILE = IS_WIN
  ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
  : "/etc/hosts";

const ADD_HOSTS_ENTRY_SCRIPT = `
const fs = require("fs");
const os = require("os");
const [hostsFile, targetHost] = process.argv.slice(-2);
const entry = "127.0.0.1 " + targetHost;
const content = fs.existsSync(hostsFile) ? fs.readFileSync(hostsFile, "utf8") : "";
const exists = content
  .split(/\\r?\\n/)
  .some((line) => {
    const parts = line.trim().split(/\\s+/);
    return parts.length >= 2 && parts[0] === "127.0.0.1" && parts.slice(1).includes(targetHost);
  });
if (!exists) {
  const prefix = content && !content.endsWith("\\n") ? os.EOL : "";
  fs.writeFileSync(hostsFile, content + prefix + entry + os.EOL);
}
`;

const REMOVE_HOSTS_ENTRY_SCRIPT = `
const fs = require("fs");
const os = require("os");
const [hostsFile, targetHost] = process.argv.slice(-2);
const content = fs.existsSync(hostsFile) ? fs.readFileSync(hostsFile, "utf8") : "";
const next = content
  .split(/\\r?\\n/)
  .filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const parts = trimmed.split(/\\s+/);
    return !(parts.length >= 2 && parts.slice(1).includes(targetHost));
  })
  .join(os.EOL);
fs.writeFileSync(hostsFile, next.endsWith(os.EOL) ? next : next + os.EOL);
`;

function execFileWithInput(file, args, input = "") {
  return new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      {
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${error.message}${stderr ? `\n${stderr}` : ""}`));
        } else {
          resolve(stdout);
        }
      }
    );
    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

/**
 * Execute a binary with sudo password via stdin (macOS/Linux only).
 */
export function execWithPassword(file, args, password, stdinAfterPassword = "") {
  return execFileWithInput(file, args, `${password || ""}\n${stdinAfterPassword}`);
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function encodePowerShellCommand(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * Execute elevated PowerShell script on Windows via RunAs.
 */
export function execElevatedWindowsScript(script) {
  return new Promise((resolve, reject) => {
    const encoded = encodePowerShellCommand(`$ErrorActionPreference = 'Stop';\n${script}`);
    const startProcess = `Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}' -Verb RunAs -Wait`;
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", startProcess],
      {
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Elevated command failed: ${error.message}${stderr ? `\n${stderr}` : ""}`));
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

/**
 * Check if DNS entry already exists.
 */
export function checkDNSEntry() {
  try {
    const hostsContent = fs.readFileSync(HOSTS_FILE, "utf8");
    const lines = hostsContent.split(/\r?\n/);
    return lines.some((line) => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 2 && parts[0] === "127.0.0.1" && parts.some((p) => p === TARGET_HOST);
    });
  } catch (error: unknown) {logger.warn('[dns] filesystem operation failed', error); return false; }
}

/**
 * Add DNS entry to hosts file.
 */
export async function addDNSEntry(sudoPassword) {
  if (checkDNSEntry()) {
    console.log(`DNS entry for ${TARGET_HOST} already exists`);
    return;
  }

  const entry = `127.0.0.1 ${TARGET_HOST}`;

  try {
    if (IS_WIN) {
      const hostsPath = escapePowerShellSingleQuoted(HOSTS_FILE);
      const targetHost = escapePowerShellSingleQuoted(TARGET_HOST);
      await execElevatedWindowsScript(`
$hostsPath = '${hostsPath}'
$targetHost = '${targetHost}'
$entry = "127.0.0.1 $targetHost"
$content = if (Test-Path -LiteralPath $hostsPath) { Get-Content -LiteralPath $hostsPath } else { @() }
$exists = $false
foreach ($line in $content) {
  $parts = $line.Trim() -split '\\s+'
  if ($parts.Length -ge 2 -and $parts[0] -eq '127.0.0.1' -and ($parts[1..($parts.Length - 1)] -contains $targetHost)) {
    $exists = $true
    break
  }
}
if (-not $exists) {
  Add-Content -LiteralPath $hostsPath -Value $entry -Encoding ASCII
}
`);
    } else {
      await execWithPassword(
        "sudo",
        ["-S", process.execPath, "-e", ADD_HOSTS_ENTRY_SCRIPT, HOSTS_FILE, TARGET_HOST],
        sudoPassword
      );
    }
    console.log(`Added DNS entry: ${entry}`);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    throw new Error(`Failed to add DNS entry: ${err.message}`);
  }
}

/**
 * Remove DNS entry from hosts file.
 */
export async function removeDNSEntry(sudoPassword) {
  if (!checkDNSEntry()) {
    console.log(`DNS entry for ${TARGET_HOST} does not exist`);
    return;
  }

  try {
    if (IS_WIN) {
      const hostsPath = escapePowerShellSingleQuoted(HOSTS_FILE);
      const targetHost = escapePowerShellSingleQuoted(TARGET_HOST);
      await execElevatedWindowsScript(`
$hostsPath = '${hostsPath}'
$targetHost = '${targetHost}'
$content = if (Test-Path -LiteralPath $hostsPath) { Get-Content -LiteralPath $hostsPath } else { @() }
$next = $content | Where-Object {
  $parts = $_.Trim() -split '\\s+'
  -not ($parts.Length -ge 2 -and ($parts[1..($parts.Length - 1)] -contains $targetHost))
}
Set-Content -LiteralPath $hostsPath -Value $next -Encoding ASCII
`);
    } else {
      await execWithPassword(
        "sudo",
        ["-S", process.execPath, "-e", REMOVE_HOSTS_ENTRY_SCRIPT, HOSTS_FILE, TARGET_HOST],
        sudoPassword
      );
    }
    console.log(`Removed DNS entry for ${TARGET_HOST}`);
  } catch (error: unknown) {
    const err = asErrorLike(error);
    throw new Error(`Failed to remove DNS entry: ${err.message}`);
  }
}
