import os from 'node:os';
import process from 'node:process';

/**
 * ZavorthPathCompactor
 * 
 * Normalizes absolute paths to use Unix-style slashes ('/') and replaces
 * the system user's home directory with '~/'. Also provides expansion support.
 */
export class ZavorthPathCompactor {
  /**
   * Normalizes absolute paths with Unix-style slashes ('/') and replaces
   * the system user's home directory (obtained via Node's os.homedir()) with '~/'.
   * 
   * @param absolutePath The absolute filesystem path to normalize and compact.
   * @returns The normalized and compacted path.
   */
  public static compact(absolutePath: string): string {
    if (!absolutePath || typeof absolutePath !== 'string') {
      return absolutePath;
    }

    // 1. Normalize absolute path with Unix-style slashes
    let normalized = absolutePath.replace(/\\/g, '/');
    if (!this.isWindowsDriveRoot(normalized) && normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.replace(/\/+$/g, '');
    }

    // 2. Retrieve system user's home directory
    const homedir = os.homedir();
    if (!homedir) {
      return normalized;
    }

    // 3. Normalize homedir path
    let normalizedHomedir = homedir.replace(/\\/g, '/');
    if (!this.isWindowsDriveRoot(normalizedHomedir) && normalizedHomedir.endsWith('/')) {
      normalizedHomedir = normalizedHomedir.slice(0, -1);
    }

    // 4. Compact matching prefix (case-insensitive on Windows)
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const normalizedLower = normalized.toLowerCase();
      const homedirLower = normalizedHomedir.toLowerCase();

      if (normalizedLower === homedirLower) {
        return '~';
      }
      if (normalizedLower.startsWith(homedirLower + '/')) {
        return '~/' + normalized.slice(normalizedHomedir.length + 1);
      }
    } else {
      if (normalized === normalizedHomedir) {
        return '~';
      }
      if (normalized.startsWith(normalizedHomedir + '/')) {
        return '~/' + normalized.slice(normalizedHomedir.length + 1);
      }
    }

    return normalized;
  }

  /**
   * Expands a compacted path (starting with '~' or '~/') back into an absolute path.
   * 
   * @param compactedPath The compacted path (e.g. '~/foo/bar')
   * @returns The expanded path with Unix-style slashes.
   */
  public static expand(compactedPath: string): string {
    if (!compactedPath || typeof compactedPath !== 'string') {
      return compactedPath;
    }

    const homedir = os.homedir();
    if (!homedir) {
      return compactedPath.replace(/\\/g, '/');
    }

    let normalized = compactedPath.replace(/\\/g, '/');

    if (normalized === '~') {
      return homedir.replace(/\\/g, '/').replace(/\/+$/g, '');
    }

    if (normalized.startsWith('~/')) {
      const normalizedHomedir = homedir.replace(/\\/g, '/').replace(/\/+$/g, '');
      return normalizedHomedir + '/' + normalized.slice(2);
    }

    return normalized;
  }

  private static isWindowsDriveRoot(value: string): boolean {
    return /^[A-Za-z]:\/$/.test(value.replace(/\\/g, '/'));
  }
}
