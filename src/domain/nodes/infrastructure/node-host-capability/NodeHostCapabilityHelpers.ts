import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { isPathContained } from './NodeHostCapabilityPathPolicy.js';
import { logger } from '../../../../logger';export type NodeHostCommandDescriptor = {
  label: string;
  command: string;
  file?: string;
  args?: string[];
};

export type NodeHostLocationPayload = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  label: string | null;
};

export type NodeHostCapturePathInput = {
  payload: Record<string, unknown> | null;
  tempRoot: string;
  now: () => Date;
  resolveAllowedPath: (targetPath: string, capabilityId: string) => string;
  capabilityId?: string;
  prefix?: string;
};

export type NodeHostIdentitySnapshotInput = {
  platform: NodeJS.Platform;
  workspaceRoot: string;
  tempRoot: string;
  allowedRoots: string[];
  env: NodeJS.ProcessEnv;
};

export function buildNodeHostIdentitySnapshot(input: NodeHostIdentitySnapshotInput): Record<string, unknown> {
  return {
    hostname: os.hostname(),
    platform: input.platform,
    arch: process.arch,
    osRelease: os.release(),
    nodeVersion: process.version,
    workspaceRoot: input.workspaceRoot,
    tempRoot: input.tempRoot,
    cwd: process.cwd(),
    allowedRoots: input.allowedRoots,
    deviceModel: String(input.env.ZAVORTH_NODE_HOST_DEVICE_MODEL || '').trim() || null,
    appVersion: String(input.env.ZAVORTH_NODE_HOST_APP_VERSION || '').trim() || null,
    networkType: String(input.env.ZAVORTH_NODE_HOST_NETWORK_TYPE || '').trim() || null,
    locationLabel: String(input.env.ZAVORTH_NODE_HOST_LOCATION_LABEL || '').trim() || null,
  };
}

export function buildNodeHostClipboardCommands(platform: NodeJS.Platform): NodeHostCommandDescriptor[] {
  switch (platform) {
    case 'win32':
      return [
        {
          label: 'powershell-clipboard',
          command: 'powershell -NoProfile -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $clip = Get-Clipboard -Raw -ErrorAction Stop; if ($null -eq $clip) { \'\'; } else { $clip }"',
        },
      ];
    case 'darwin':
      return [
        {
          label: 'pbpaste',
          command: 'pbpaste',
        },
      ];
    default:
      return [
        {
          label: 'wl-paste',
          command: 'wl-paste --no-newline',
        },
        {
          label: 'xclip',
          command: 'xclip -selection clipboard -o',
        },
        {
          label: 'xsel',
          command: 'xsel --clipboard --output',
        },
      ];
  }
}

export function buildNodeHostClipboardWriteCommands(
  platform: NodeJS.Platform,
  text: string,
): NodeHostCommandDescriptor[] {
  switch (platform) {
    case 'win32': {
      const encodedText = encodeUtf8Base64(text);
      return [
        {
          label: 'powershell-set-clipboard',
          command: 'powershell -NoProfile -Command "<clipboard write via base64 payload>"',
          file: 'powershell',
          args: [
            '-NoProfile',
            '-Command',
            `$text = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedText}')); Set-Clipboard -Value $text; Write-Output 'clipboard-written'`,
          ],
        },
      ];
    }
    case 'darwin':
      return [
        {
          label: 'pbcopy',
          command: `printf %s ${escapePosixSingleQuoted(text)} | pbcopy`,
          file: 'sh',
          args: ['-c', 'printf %s "$1" | pbcopy', 'zavorth-clipboard', text],
        },
      ];
    default:
      return [
        {
          label: 'wl-copy',
          command: `printf %s ${escapePosixSingleQuoted(text)} | wl-copy`,
          file: 'sh',
          args: ['-c', 'printf %s "$1" | wl-copy', 'zavorth-clipboard', text],
        },
        {
          label: 'xclip',
          command: `printf %s ${escapePosixSingleQuoted(text)} | xclip -selection clipboard`,
          file: 'sh',
          args: ['-c', 'printf %s "$1" | xclip -selection clipboard', 'zavorth-clipboard', text],
        },
        {
          label: 'xsel',
          command: `printf %s ${escapePosixSingleQuoted(text)} | xsel --clipboard --input`,
          file: 'sh',
          args: ['-c', 'printf %s "$1" | xsel --clipboard --input', 'zavorth-clipboard', text],
        },
      ];
  }
}

export function buildNodeHostNotificationCommands(
  platform: NodeJS.Platform,
  title: string,
  body: string,
): NodeHostCommandDescriptor[] {
  switch (platform) {
    case 'win32': {
      const encodedTitle = encodeUtf8Base64(title);
      const encodedBody = encodeUtf8Base64(body);
      return [
        {
          label: 'powershell-notifyicon',
          command: 'powershell -NoProfile -Command "<notify via base64 payload>"',
          file: 'powershell',
          args: [
            '-NoProfile',
            '-Command',
            [
              `$title = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedTitle}'))`,
              `$body = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedBody}'))`,
              'Add-Type -AssemblyName System.Windows.Forms',
              'Add-Type -AssemblyName System.Drawing',
              '$notify = New-Object System.Windows.Forms.NotifyIcon',
              '$notify.Icon = [System.Drawing.SystemIcons]::Information',
              '$notify.BalloonTipTitle = $title',
              '$notify.BalloonTipText = $body',
              '$notify.Visible = $true',
              '$notify.ShowBalloonTip(5000)',
              'Start-Sleep -Milliseconds 800',
              '$notify.Dispose()',
              "Write-Output 'notification-sent'",
            ].join('; '),
          ],
        },
      ];
    }
    case 'darwin':
      return [
        {
          label: 'osascript-notification',
          command: `osascript -e 'display notification ${escapePosixDoubleQuoted(body)} with title ${escapePosixDoubleQuoted(title)}'`,
          file: 'osascript',
          args: [
            '-e',
            'on run argv',
            '-e',
            'display notification (item 2 of argv) with title (item 1 of argv)',
            '-e',
            'end run',
            title,
            body,
          ],
        },
      ];
    default:
      return [
        {
          label: 'notify-send',
          command: `notify-send ${escapePosixSingleQuoted(title)} ${escapePosixSingleQuoted(body)}`,
          file: 'notify-send',
          args: [title, body],
        },
      ];
  }
}

export function buildNodeHostScreenCaptureCommands(
  platform: NodeJS.Platform,
  outputPath: string,
): NodeHostCommandDescriptor[] {
  switch (platform) {
    case 'win32': {
      const safePath = escapePowerShellSingleQuoted(outputPath);
      return [
        {
          label: 'powershell-screen-capture',
          command: 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bitmap.Save(\'' + safePath + '\', [System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $bitmap.Dispose(); Write-Output \'' + safePath + '\'"',
        },
      ];
    }
    case 'darwin':
      return [
        {
          label: 'screencapture',
          command: `screencapture -x ${escapePosixSingleQuoted(outputPath)}`,
        },
      ];
    default:
      return [
        {
          label: 'import',
          command: `import -window root ${escapePosixSingleQuoted(outputPath)}`,
        },
        {
          label: 'gnome-screenshot',
          command: `gnome-screenshot -f ${escapePosixSingleQuoted(outputPath)}`,
        },
        {
          label: 'grim',
          command: `grim ${escapePosixSingleQuoted(outputPath)}`,
        },
      ];
  }
}

export function buildNodeHostBrowserOpenCommand(
  platform: NodeJS.Platform,
  targetUrl: string,
): NodeHostCommandDescriptor {
  switch (platform) {
    case 'win32':
      return {
        label: 'powershell-start-process',
        command: `powershell -NoProfile -Command "Start-Process ${escapePowerShellSingleQuoted(targetUrl)}"`,
        file: 'powershell',
        args: ['-NoProfile', '-Command', 'Start-Process -FilePath $args[0]', targetUrl],
      };
    case 'darwin':
      return {
        label: 'open',
        command: `open ${escapePosixSingleQuoted(targetUrl)}`,
        file: 'open',
        args: [targetUrl],
      };
    default:
      return {
        label: 'xdg-open',
        command: `xdg-open ${escapePosixSingleQuoted(targetUrl)}`,
        file: 'xdg-open',
        args: [targetUrl],
      };
  }
}

export function normalizeNodeHostBrowserUrl(
  value: unknown,
  allowedProtocols: string[] = ['http:', 'https:', 'ws:', 'wss:'],
): string | null {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);
    return allowedProtocols.includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch (error: unknown) {logger.warn('[Node Host Capability Helpers] network request failed', error); return null; }
}

export function normalizeNodeHostBrowserTargetUrl(
  value: unknown,
  input: {
    allowedRoots: string[];
    env: NodeJS.ProcessEnv;
  },
): string | null {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }

    if (
      parsed.protocol === 'file:'
      && String(input.env.ZAVORTH_NODE_HOST_BROWSER_ALLOW_FILE_URLS || '').toLowerCase() === 'true'
    ) {
      const targetPath = fileURLToPath(parsed);
      const allowed = input.allowedRoots.some((root) => isPathContained(root, targetPath));
      return allowed ? parsed.toString() : null;
    }

    return null;
  } catch (error: unknown) {logger.warn('[Node Host Capability Helpers] parsing failed', error); return null; }
}

export function normalizeNodeHostLocationPayload(
  payload: Record<string, unknown> | null | undefined,
): NodeHostLocationPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const latitude = parseFiniteNumber(payload.latitude);
  const longitude = parseFiniteNumber(payload.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracyMeters: parseFiniteNumber(payload.accuracyMeters),
    label: String(payload.label || payload.name || '').trim() || null,
  };
}

export function resolveNodeHostCapturePath(input: NodeHostCapturePathInput): string {
  const capabilityId = input.capabilityId || 'screen.capture';
  const prefix = input.prefix || 'screen';
  const directPath = String(input.payload?.outputPath || input.payload?.path || input.payload?.filePath || '').trim();
  if (directPath) {
    return input.resolveAllowedPath(directPath, capabilityId);
  }

  return path.resolve(
    input.tempRoot,
    'captures',
    `${prefix}-${input.now().toISOString().replace(/[:.]/g, '-')}.png`,
  );
}

function escapePosixSingleQuoted(value: string): string {
  return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function escapePosixDoubleQuoted(value: string): string {
  return `"${String(value || '').replace(/(["\\$`])/g, '\\$1')}"`;
}

function escapePowerShellSingleQuoted(value: string): string {
  return String(value || '').replace(/'/g, "''");
}

function encodeUtf8Base64(value: string): string {
  return Buffer.from(String(value || ''), 'utf8').toString('base64');
}

function parseFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
