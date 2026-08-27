export type BrowserFamily = 'chrome' | 'edge' | 'brave' | 'chromium';

export type BrowserPlatform = 'win32' | 'darwin' | 'linux';

export interface BrowserProfileCandidate {
  browserFamily: BrowserFamily;
  name: string;
  executablePath: string | null;
  userDataDir: string;
  profileName: string;
  profileDir: string;
  cookiesDbPath: string;
  loginDataDbPath: string;
  localStatePath: string;
  isDefault: boolean;
  exists: boolean;
}

export interface BrowserProfileResolutionResult {
  success: boolean;
  selectedCandidate: BrowserProfileCandidate | null;
  candidates: BrowserProfileCandidate[];
  error?: string;
}

export interface BrowserProfileResolverOptions {
  preferredFamily?: BrowserFamily | null;
  customUserDataDir?: string | null;
  profileName?: string | null;
  platform?: BrowserPlatform | null;
  homeDir?: string | null;
  localAppDataDir?: string | null;
}
