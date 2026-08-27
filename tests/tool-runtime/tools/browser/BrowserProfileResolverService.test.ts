import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserProfileResolverService } from '../../../../src/tool-runtime/tools/browser/BrowserProfileResolverService.js';

describe('BrowserProfileResolverService', () => {
  const resolver = new BrowserProfileResolverService();
  const testRoot = path.join(os.tmpdir(), `zavorth-resolver-test-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(testRoot, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error in test
    }
  });

  it('should discover candidates for Windows platform structure', () => {
    const fakeLocalAppData = path.join(testRoot, 'LocalAppData');
    const fakeChromeDefault = path.join(fakeLocalAppData, 'Google', 'Chrome', 'User Data', 'Default');
    fs.mkdirSync(fakeChromeDefault, { recursive: true });
    fs.writeFileSync(path.join(fakeChromeDefault, 'Cookies'), 'dummy-cookie-data');

    const result = resolver.resolveProfile({
      platform: 'win32',
      localAppDataDir: fakeLocalAppData,
      homeDir: testRoot,
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(4);
    const chromeCandidate = result.candidates.find((c) => c.browserFamily === 'chrome');
    expect(chromeCandidate).toBeDefined();
    expect(chromeCandidate?.exists).toBe(true);
    expect(result.selectedCandidate?.browserFamily).toBe('chrome');
  });

  it('should discover candidates for macOS platform structure', () => {
    const fakeHome = path.join(testRoot, 'macos-home');
    const fakeBraveDefault = path.join(fakeHome, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Default');
    fs.mkdirSync(fakeBraveDefault, { recursive: true });

    const result = resolver.resolveProfile({
      platform: 'darwin',
      homeDir: fakeHome,
      preferredFamily: 'brave',
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(4);
    const braveCandidate = result.candidates.find((c) => c.browserFamily === 'brave');
    expect(braveCandidate).toBeDefined();
    expect(braveCandidate?.exists).toBe(true);
    expect(result.selectedCandidate?.browserFamily).toBe('brave');
  });

  it('should discover candidates for Linux platform structure including flatpak and snap', () => {
    const fakeHome = path.join(testRoot, 'linux-home');
    const fakeEdgeDefault = path.join(fakeHome, '.config', 'microsoft-edge', 'Default');
    fs.mkdirSync(fakeEdgeDefault, { recursive: true });

    const result = resolver.resolveProfile({
      platform: 'linux',
      homeDir: fakeHome,
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(6); // 4 standard + flatpak + snap
    const edgeCandidate = result.candidates.find((c) => c.browserFamily === 'edge');
    expect(edgeCandidate).toBeDefined();
    expect(edgeCandidate?.exists).toBe(true);
    expect(result.selectedCandidate?.browserFamily).toBe('edge');
  });

  it('should resolve custom user data directory when specified', () => {
    const customDir = path.join(testRoot, 'custom-profile');
    fs.mkdirSync(path.join(customDir, 'Default'), { recursive: true });

    const result = resolver.resolveProfile({
      customUserDataDir: customDir,
    });

    expect(result.success).toBe(true);
    expect(result.selectedCandidate).toBeDefined();
    expect(result.selectedCandidate?.userDataDir).toBe(path.resolve(customDir));
  });

  it('should return failure with clear error when custom user data dir does not exist', () => {
    const nonExistent = path.join(testRoot, 'does-not-exist');

    const result = resolver.resolveProfile({
      customUserDataDir: nonExistent,
    });

    expect(result.success).toBe(false);
    expect(result.selectedCandidate).toBeNull();
    expect(result.error).toContain('not found');
  });
});
