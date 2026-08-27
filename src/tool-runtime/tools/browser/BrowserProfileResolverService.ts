import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type {
  BrowserFamily,
  BrowserPlatform,
  BrowserProfileCandidate,
  BrowserProfileResolutionResult,
  BrowserProfileResolverOptions,
} from './BrowserProfileResolverContract.js';

interface FamilyPathDefinition {
  family: BrowserFamily;
  displayName: string;
  subDir: string;
  executableRelative?: string[];
}

export class BrowserProfileResolverService {
  private static readonly WINDOWS_FAMILIES: FamilyPathDefinition[] = [
    {
      family: 'chrome',
      displayName: 'Google Chrome',
      subDir: path.join('Google', 'Chrome', 'User Data'),
      executableRelative: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ],
    },
    {
      family: 'edge',
      displayName: 'Microsoft Edge',
      subDir: path.join('Microsoft', 'Edge', 'User Data'),
      executableRelative: [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ],
    },
    {
      family: 'brave',
      displayName: 'Brave Browser',
      subDir: path.join('BraveSoftware', 'Brave-Browser', 'User Data'),
      executableRelative: [
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      ],
    },
    {
      family: 'chromium',
      displayName: 'Chromium',
      subDir: path.join('Chromium', 'User Data'),
      executableRelative: ['C:\\Program Files\\Chromium\\Application\\chrome.exe'],
    },
  ];

  private static readonly MACOS_FAMILIES: FamilyPathDefinition[] = [
    {
      family: 'chrome',
      displayName: 'Google Chrome',
      subDir: path.join('Library', 'Application Support', 'Google', 'Chrome'),
      executableRelative: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    },
    {
      family: 'edge',
      displayName: 'Microsoft Edge',
      subDir: path.join('Library', 'Application Support', 'Microsoft Edge'),
      executableRelative: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    },
    {
      family: 'brave',
      displayName: 'Brave Browser',
      subDir: path.join('Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'),
      executableRelative: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    },
    {
      family: 'chromium',
      displayName: 'Chromium',
      subDir: path.join('Library', 'Application Support', 'Chromium'),
      executableRelative: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
    },
  ];

  private static readonly LINUX_FAMILIES: FamilyPathDefinition[] = [
    {
      family: 'chrome',
      displayName: 'Google Chrome',
      subDir: path.join('.config', 'google-chrome'),
      executableRelative: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
    },
    {
      family: 'edge',
      displayName: 'Microsoft Edge',
      subDir: path.join('.config', 'microsoft-edge'),
      executableRelative: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
    },
    {
      family: 'brave',
      displayName: 'Brave Browser',
      subDir: path.join('.config', 'BraveSoftware', 'Brave-Browser'),
      executableRelative: ['/usr/bin/brave-browser'],
    },
    {
      family: 'chromium',
      displayName: 'Chromium',
      subDir: path.join('.config', 'chromium'),
      executableRelative: ['/usr/bin/chromium', '/usr/bin/chromium-browser'],
    },
  ];

  public resolveProfile(options?: BrowserProfileResolverOptions): BrowserProfileResolutionResult {
    const platform = (options?.platform || process.platform) as BrowserPlatform;
    const profileName = options?.profileName?.trim() || 'Default';
    const preferredFamily = options?.preferredFamily || null;

    if (options?.customUserDataDir) {
      const customCandidate = this.buildCandidateFromCustomPath(
        options.customUserDataDir,
        profileName,
        preferredFamily || 'chrome',
      );
      return {
        success: customCandidate.exists,
        selectedCandidate: customCandidate.exists ? customCandidate : null,
        candidates: [customCandidate],
        error: customCandidate.exists ? undefined : `Custom user data dir not found: ${options.customUserDataDir}`,
      };
    }

    const defaultFamily = this.detectSystemDefaultBrowserFamily(platform);
    const candidates = this.discoverCandidates(platform, profileName, options);

    for (const candidate of candidates) {
      if (defaultFamily && candidate.browserFamily === defaultFamily) {
        candidate.isDefault = true;
      }
    }

    let selected: BrowserProfileCandidate | null = null;

    if (preferredFamily) {
      selected = candidates.find((c) => c.browserFamily === preferredFamily && c.exists) || null;
    }

    if (!selected && defaultFamily) {
      selected = candidates.find((c) => c.browserFamily === defaultFamily && c.exists) || null;
    }

    if (!selected) {
      selected = candidates.find((c) => c.exists) || null;
    }

    return {
      success: selected !== null,
      selectedCandidate: selected,
      candidates,
      error: selected ? undefined : 'No existing Chromium-family browser profiles discovered on this system.',
    };
  }

  private discoverCandidates(
    platform: BrowserPlatform,
    profileName: string,
    options?: BrowserProfileResolverOptions,
  ): BrowserProfileCandidate[] {
    const homeDir = options?.homeDir || os.homedir();
    const localAppData = options?.localAppDataDir || process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');

    const families = this.getPlatformFamilies(platform);
    const candidates: BrowserProfileCandidate[] = [];

    for (const item of families) {
      let baseDir = '';
      if (platform === 'win32') {
        baseDir = path.join(localAppData, item.subDir);
      } else {
        baseDir = path.join(homeDir, item.subDir);
      }

      const candidate = this.createCandidateRecord(item.family, item.displayName, baseDir, profileName, item.executableRelative);
      candidates.push(candidate);
    }

    if (platform === 'linux') {
      this.appendLinuxSandboxCandidates(homeDir, profileName, candidates);
    }

    return candidates;
  }

  private appendLinuxSandboxCandidates(
    homeDir: string,
    profileName: string,
    candidates: BrowserProfileCandidate[],
  ): void {
    const flatpakChrome = path.join(homeDir, '.var', 'app', 'com.google.Chrome', 'config', 'google-chrome');
    candidates.push(
      this.createCandidateRecord('chrome', 'Google Chrome (Flatpak)', flatpakChrome, profileName, [
        '/var/lib/flatpak/exports/bin/com.google.Chrome',
      ]),
    );

    const snapChromium = path.join(homeDir, 'snap', 'chromium', 'common', 'chromium');
    candidates.push(
      this.createCandidateRecord('chromium', 'Chromium (Snap)', snapChromium, profileName, [
        '/snap/bin/chromium',
      ]),
    );
  }

  private createCandidateRecord(
    family: BrowserFamily,
    name: string,
    userDataDir: string,
    profileName: string,
    candidateExecutables?: string[],
  ): BrowserProfileCandidate {
    const profileDir = path.join(userDataDir, profileName);
    const networkCookiesPath = path.join(profileDir, 'Network', 'Cookies');
    const legacyCookiesPath = path.join(profileDir, 'Cookies');
    const cookiesDbPath = fs.existsSync(networkCookiesPath) ? networkCookiesPath : legacyCookiesPath;
    const loginDataDbPath = path.join(profileDir, 'Login Data');
    const localStatePath = path.join(userDataDir, 'Local State');

    let executablePath: string | null = null;
    if (candidateExecutables && candidateExecutables.length > 0) {
      for (const execPath of candidateExecutables) {
        if (fs.existsSync(execPath)) {
          executablePath = execPath;
          break;
        }
      }
    }

    const exists = fs.existsSync(profileDir);

    return {
      browserFamily: family,
      name,
      executablePath,
      userDataDir,
      profileName,
      profileDir,
      cookiesDbPath,
      loginDataDbPath,
      localStatePath,
      isDefault: false,
      exists,
    };
  }

  private buildCandidateFromCustomPath(
    customUserDataDir: string,
    profileName: string,
    family: BrowserFamily,
  ): BrowserProfileCandidate {
    return this.createCandidateRecord(
      family,
      `Custom Profile (${family})`,
      path.resolve(customUserDataDir),
      profileName,
    );
  }

  private getPlatformFamilies(platform: BrowserPlatform): FamilyPathDefinition[] {
    switch (platform) {
      case 'win32':
        return BrowserProfileResolverService.WINDOWS_FAMILIES;
      case 'darwin':
        return BrowserProfileResolverService.MACOS_FAMILIES;
      case 'linux':
        return BrowserProfileResolverService.LINUX_FAMILIES;
      default:
        return BrowserProfileResolverService.LINUX_FAMILIES;
    }
  }

  private detectSystemDefaultBrowserFamily(platform: BrowserPlatform): BrowserFamily | null {
    try {
      if (platform === 'win32') {
        const result = spawnSync('reg', [
          'query',
          'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice',
          '/v',
          'ProgId',
        ], { encoding: 'utf8', timeout: 2000 });

        if (result.status === 0 && result.stdout) {
          const stdout = result.stdout.toLowerCase();
          if (stdout.includes('chromehtml') || stdout.includes('chrome')) return 'chrome';
          if (stdout.includes('msedgehtm') || stdout.includes('edge')) return 'edge';
          if (stdout.includes('bravehtml') || stdout.includes('brave')) return 'brave';
          if (stdout.includes('chromium')) return 'chromium';
        }
      } else if (platform === 'linux') {
        const result = spawnSync('xdg-settings', ['get', 'default-web-browser'], {
          encoding: 'utf8',
          timeout: 2000,
        });
        if (result.status === 0 && result.stdout) {
          const stdout = result.stdout.toLowerCase();
          if (stdout.includes('chrome')) return 'chrome';
          if (stdout.includes('edge')) return 'edge';
          if (stdout.includes('brave')) return 'brave';
          if (stdout.includes('chromium')) return 'chromium';
        }
      }
    } catch {
      return null;
    }
    return null;
  }
}
