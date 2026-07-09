import { fileURLToPath } from 'node:url';
import { safeParseInt } from '../../ai-gateway/shared/utils/safeParseInt.js';

// ============================================================================
// WhitelistConfig - security configuration for Zavorth Echo
// ============================================================================

// --- OS: Executaveis permitidos para os_open_app ---
export const SYSTEM_EXECUTABLES_WHITELIST = [
    'chrome.exe', 'brave.exe', 'msedge.exe', 'spotify.exe',
    'explorer.exe', 'code', 'notepad.exe', 'calc.exe',
    'chrome', 'brave', 'spotify', 'firefox', 'firefox.exe',
    'vlc', 'vlc.exe',
];

export const BLOCKED_SYSTEM_EXECUTABLES = [
    'cmd', 'cmd.exe',
    'powershell', 'powershell.exe',
    'pwsh', 'pwsh.exe',
    'wt', 'wt.exe',
    'terminal',
    'bash', 'bash.exe',
    'wsl', 'wsl.exe',
    'sh', 'sh.exe',
    'python', 'python.exe',
    'node', 'node.exe',
    'reg', 'reg.exe',
    'regedit', 'regedit.exe',
    'mshta', 'mshta.exe',
    'rundll32', 'rundll32.exe',
    'certutil', 'certutil.exe',
    'schtasks', 'schtasks.exe',
    'wmic', 'wmic.exe',
];

export function normalizeExecutableName(value: string | undefined): string {
    const normalized = String(value || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\//g, '\\')
        .toLowerCase();
    return normalized.split('\\').pop() || normalized;
}

function stripExeSuffix(value: string): string {
    return value.endsWith('.exe') ? value.slice(0, -4) : value;
}

export function isBlockedSystemExecutable(value: string | undefined): boolean {
    const app = normalizeExecutableName(value);
    const appBase = stripExeSuffix(app);
    return BLOCKED_SYSTEM_EXECUTABLES.some((blocked) => {
        const blockedName = normalizeExecutableName(blocked);
        return app === blockedName || appBase === stripExeSuffix(blockedName);
    });
}

export function isWhitelistedSystemExecutable(value: string | undefined): boolean {
    const app = normalizeExecutableName(value);
    const appBase = stripExeSuffix(app);
    if (!app || isBlockedSystemExecutable(app)) {
        return false;
    }
    return SYSTEM_EXECUTABLES_WHITELIST.some((allowed) => {
        const normalized = normalizeExecutableName(allowed);
        const normalizedBase = stripExeSuffix(normalized);
        return app === normalized || appBase === normalizedBase;
    });
}

// --- OS: Padroes destrutivos bloqueados no prompt original ---
export const DESTRUCTIVE_REGEX = [
    /\brm\s+-rf\b/i,
    /\bdel\s+\/f\b/i,
    /\bformat\b/i,
    /\bdiskpart\b/i,
    /system32/i,
    />\s*\/dev\/null/i,
    /\bshutdown\b/i,
    /\bregedit\b/i,
    /\bnet\s+user\b/i,
    /\btaskkill\s+\/f\s+\/im/i,
];

// --- IoT: Prefixos de entity_id permitidos para Home Assistant ---
export const ALLOWED_HA_ENTITY_PREFIXES = [
    'light.', 'switch.', 'climate.', 'sensor.', 'binary_sensor.',
    'fan.', 'cover.', 'media_player.', 'input_boolean.', 'automation.',
    'scene.', 'script.', 'lock.', 'vacuum.', 'camera.', 'button.',
    'select.', 'number.', 'humidifier.', 'water_heater.', 'lawn_mower.',
    'valve.', 'siren.', 'alarm_control_panel.', 'device_tracker.', 'person.',
    'remote.', 'update.', 'input_button.', 'input_number.', 'input_select.',
    'input_text.', 'timer.', 'schedule.', 'calendar.', 'weather.',
    'air_quality.', 'plant.', 'sun.', 'todo.',
];

// --- IoT: Brokers MQTT permitidos (apenas rede local) ---
export const ALLOWED_MQTT_BROKERS = [
    'localhost', '127.0.0.1',
    '192.168.', '10.', '172.16.', '172.17.', '172.18.',
    '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
    '172.29.', '172.30.', '172.31.',
];

export function isLocalNetworkHostname(hostname: string | undefined): boolean {
    const normalized = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!normalized) {
        return false;
    }
    if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
        return true;
    }
    if (normalized.endsWith('.local') || normalized.endsWith('.lan') || normalized.endsWith('.home.arpa')) {
        return true;
    }
    if (normalized.startsWith('192.168.') || normalized.startsWith('10.')) {
        return true;
    }
    const match172 = normalized.match(/^172\.(\d{1,2})\./);
    if (match172) {
        const secondOctet = safeParseInt(match172[1], 0);
        return secondOctet >= 16 && secondOctet <= 31;
    }
    return false;
}

// --- OS: File paths blocked for reading ---
export const BLOCKED_FILE_PATHS = [
    'system32', 'C:\\Windows', 'C:\\Program Files',
    '/etc/passwd', '/etc/shadow', '/etc/sudoers',
    '.env', '.ssh', '.gnupg',
    'id_rsa', 'credentials', 'secrets',
];

export type BrowserTargetPolicy = {
    scope: 'local-file' | 'local-network' | 'policy-allowlist' | 'about';
    normalizedUrl: string;
    hostname: string | null;
    filePath: string | null;
    matchedAllowlist: string | null;
};

export function isBlockedFilePath(filePath: string): boolean {
    const normalized = String(filePath || '').toLowerCase().replace(/\//g, '\\');
    return BLOCKED_FILE_PATHS.some((blocked) => normalized.includes(blocked.toLowerCase()));
}

export function resolveBrowserTargetPolicy(
    rawUrl: string | undefined,
    allowlistValue = process.env.ZAVORTH_PLAYWRIGHT_ALLOWED_HOSTS || '',
): BrowserTargetPolicy {
    const candidate = String(rawUrl || '').trim();
    if (!candidate) {
        throw new Error('SandboxBlock: url is required for Playwright navigation.');
    }

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch (error: any) { const err = error; const e = error;
        throw new Error(`SandboxBlock: URL '${candidate}' invalida para navegacao Playwright.`);
    }

    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol === 'about:') {
        if (candidate !== 'about:blank') {
            throw new Error(`SandboxBlock: URL '${candidate}' uses a disallowed about protocol.`);
        }
        return {
            scope: 'about',
            normalizedUrl: candidate,
            hostname: null,
            filePath: null,
            matchedAllowlist: null,
        };
    }

    if (protocol === 'file:') {
        return {
            scope: 'local-file',
            normalizedUrl: parsed.toString(),
            hostname: null,
            filePath: fileURLToPath(parsed),
            matchedAllowlist: null,
        };
    }

    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new Error(`SandboxBlock: protocol '${protocol}' not allowed for Playwright navigation.`);
    }

    const hostname = String(parsed.hostname || '').trim().toLowerCase();
    if (!hostname) {
        throw new Error(`SandboxBlock: URL '${candidate}' does not provide a valid hostname.`);
    }

    if (isLocalNetworkHostname(hostname)) {
        return {
            scope: 'local-network',
            normalizedUrl: parsed.toString(),
            hostname,
            filePath: null,
            matchedAllowlist: null,
        };
    }

    const matchedAllowlist = matchBrowserAllowlist(hostname, allowlistValue);
    if (matchedAllowlist) {
        return {
            scope: 'policy-allowlist',
            normalizedUrl: parsed.toString(),
            hostname,
            filePath: null,
            matchedAllowlist,
        };
    }

    throw new Error(
        `SandboxBlock: URL '${candidate}' is not local and was not allowlisted in ZAVORTH_PLAYWRIGHT_ALLOWED_HOSTS.`,
    );
}

function matchBrowserAllowlist(hostname: string, allowlistValue: string): string | null {
    const entries = String(allowlistValue || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

    for (const entry of entries) {
        if (entry.startsWith('*.')) {
            const suffix = entry.slice(1);
            if (hostname.endsWith(suffix)) {
                return entry;
            }
            continue;
        }
        if (hostname === entry) {
            return entry;
        }
    }

    return null;
}
