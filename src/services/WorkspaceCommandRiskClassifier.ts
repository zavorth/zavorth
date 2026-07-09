import path from 'path';
import { logger } from '../logger.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class WorkspaceCommandRiskClassifier {
  public classify(commandStr: string, cwd: string, workspaceRoot: string): RiskLevel {
    // 1. Check if command string is empty
    const trimmed = commandStr.trim();
    if (!trimmed) {
      return 'CRITICAL';
    }

    // 2. Check for secrets/tokens/keys
    if (this.containsSecrets(trimmed)) {
      return 'CRITICAL';
    }

    // 3. Check for specific dangerous commands (rm -rf, del /s, Remove-Item -Recurse, format, shutdown)
    if (this.isDestructiveCommand(trimmed)) {
      return 'CRITICAL';
    }

    // 4. Parse the command into binary and arguments
    const parsed = this.parseCommand(trimmed);
    if (!parsed) {
      return 'CRITICAL';
    }

    const { binary, args } = parsed;
    const binaryLower = path.basename(binary).toLowerCase().replace(/\.(exe|cmd|bat)$/i, '');

    // 5. Check workspace containment for cwd
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedCwd = path.resolve(cwd);
    if (this.isPathOutside(resolvedCwd, resolvedRoot)) {
      return 'CRITICAL';
    }

    // 6. Check workspace containment for command arguments (e.g. if target path is outside)
    for (const arg of args) {
      if (this.isArgOutsideWorkspace(arg, resolvedCwd, resolvedRoot)) {
        return 'CRITICAL';
      }
    }

    // 7. Check if binary itself is outside workspace (unless it is a standard system command or global binary)
    if (binary.includes('/') || binary.includes('\\')) {
      const resolvedBinaryPath = path.resolve(resolvedCwd, binary);
      if (this.isPathOutside(resolvedBinaryPath, resolvedRoot)) {
        return 'CRITICAL';
      }
    }

    // 8. Classify CRITICAL based on specific executables
    if (['format', 'shutdown'].includes(binaryLower)) {
      return 'CRITICAL';
    }

    // 9. Classify HIGH risk commands
    const highRiskBinaries = ['curl', 'wget', 'ssh', 'scp', 'docker', 'powershell', 'cmd', 'bash', 'sh'];
    if (highRiskBinaries.includes(binaryLower)) {
      return 'HIGH';
    }

    // Node / Python eval checks (node -e, python -c)
    if (binaryLower === 'node' || binaryLower === 'nodejs') {
      if (args.some(arg => arg === '-e' || arg === '--eval' || arg === '-p' || arg === '--print')) {
        return 'HIGH';
      }
    }
    if (['python', 'python3', 'py'].includes(binaryLower)) {
      if (args.some(arg => arg === '-c')) {
        return 'HIGH';
      }
    }

    // 10. Classify LOW risk commands
    // git status, git diff, git log, git show, git branch
    if (binaryLower === 'git') {
      const firstArg = args[0];
      if (firstArg && ['status', 'diff', 'log', 'show', 'branch'].includes(firstArg)) {
        return 'LOW';
      }
    }
    // npm test, npm run build
    if (binaryLower === 'npm') {
      if (args[0] === 'test') {
        return 'LOW';
      }
      if (args[0] === 'run' && args[1] === 'build') {
        return 'LOW';
      }
    }
    // pnpm test, yarn test, npx jest
    if (binaryLower === 'pnpm' && args[0] === 'test') {
      return 'LOW';
    }
    if (binaryLower === 'yarn' && args[0] === 'test') {
      return 'LOW';
    }
    if (binaryLower === 'npx' && args[0] === 'jest') {
      return 'LOW';
    }

    // 11. Classify MEDIUM risk commands
    // npm install, pnpm install, yarn install
    if (binaryLower === 'npm' && (args[0] === 'install' || args[0] === 'i')) {
      return 'MEDIUM';
    }
    if (binaryLower === 'pnpm' && (args[0] === 'install' || args[0] === 'i')) {
      return 'MEDIUM';
    }
    if (binaryLower === 'yarn' && args[0] === 'install') {
      return 'MEDIUM';
    }
    // node scripts/*.js or local files, python script.py
    if (binaryLower === 'node' || binaryLower === 'nodejs') {
      const hasJsFile = args.some(arg => arg.endsWith('.js') || arg.endsWith('.ts') || arg.endsWith('.cjs') || arg.endsWith('.mjs'));
      if (hasJsFile) {
        return 'MEDIUM';
      }
    }
    if (['python', 'python3', 'py'].includes(binaryLower)) {
      const hasPyFile = args.some(arg => arg.endsWith('.py'));
      if (hasPyFile) {
        return 'MEDIUM';
      }
    }

    // Default fallback: if it's not matched, default to HIGH
    return 'HIGH';
  }

  private parseCommand(command: string): { binary: string; args: string[] } | null {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;

    for (let index = 0; index < command.length; index += 1) {
      const char = command[index];
      if ((char === '"' || char === "'") && !quote) {
        quote = char;
        continue;
      }
      if (quote === char) {
        quote = null;
        continue;
      }
      if (!quote && /\s/u.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }

    if (quote) {
      return null;
    }
    if (current) {
      tokens.push(current);
    }
    if (tokens.length === 0) {
      return null;
    }

    return {
      binary: tokens[0],
      args: tokens.slice(1),
    };
  }

  private isPathOutside(target: string, root: string): boolean {
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return true;
    }
    // Handle Windows drive root vs folder containment
    const normalizedTarget = target.replace(/\\/g, '/').toLowerCase();
    const normalizedRoot = root.replace(/\\/g, '/').toLowerCase();
    if (!normalizedTarget.startsWith(normalizedRoot + '/') && normalizedTarget !== normalizedRoot) {
      return true;
    }
    return false;
  }

  private isArgOutsideWorkspace(arg: string, cwd: string, root: string): boolean {
    // Ignore Windows-style switches (e.g. /c, /s, /y, /quiet) on Windows
    if (process.platform === 'win32' && /^\/[a-zA-Z0-9?_-]+$/.test(arg)) {
      return false;
    }

    const hasPathIndicators = arg.includes('/') || arg.includes('\\') || arg.startsWith('.') || path.isAbsolute(arg);
    if (!hasPathIndicators) {
      return false;
    }

    try {
      const resolved = path.resolve(cwd, arg);
      return this.isPathOutside(resolved, root);
    } catch (error: unknown) {logger.warn('[Workspace Command Risk Classifier] lifecycle operation failed', error); return false; }
  }

  private isDestructiveCommand(command: string): boolean {
    const normalized = command.toLowerCase();

    if (normalized.includes('rm ') && (normalized.includes('-r') || normalized.includes('--recursive'))) {
      return true;
    }
    if (normalized.includes('del ') && (normalized.includes('/s') || normalized.includes('-s'))) {
      return true;
    }
    if (normalized.includes('remove-item') && (normalized.includes('-recurse') || normalized.includes('recurse'))) {
      return true;
    }
    if (normalized.includes('rd ') && (normalized.includes('/s') || normalized.includes('-s'))) {
      return true;
    }
    if (normalized.includes('rmdir ') && (normalized.includes('/s') || normalized.includes('-s') || normalized.includes('-r') || normalized.includes('--recursive'))) {
      return true;
    }

    const words = normalized.split(/\s+/u);
    if (words.includes('format') || words.includes('shutdown')) {
      return true;
    }

    return false;
  }

  private containsSecrets(command: string): boolean {
    const assignmentPattern = /(?:api[_-]?key|token|secret|password|passwd|passphrase|private[_-]?key|auth|credential|jwt|bearer|key)\s*[:=]\s*["']?([a-zA-Z0-9_\-.~%+]{8,})["']?/i;
    if (assignmentPattern.test(command)) {
      return true;
    }

    const bearerPattern = /\bbearer\s+[a-zA-Z0-9_\-.~%+]{8,}\b/i;
    if (bearerPattern.test(command)) {
      return true;
    }

    const githubTokenPattern = /\bgh[pous]_[a-zA-Z0-9]{36,}\b/;
    const awsKeyPattern = /\bAKIA[A-Z0-9]{16}\b/;
    const slackTokenPattern = /\bxox[baprs]-[0-9]{10,12}-[a-zA-Z0-9]{24,48}\b/;
    const openAiKeyPattern = /\bsk-[a-zA-Z0-9]{48,}\b/;
    const privateKeyHeaderPattern = /-----BEGIN\s+.*PRIVATE\s+KEY-----/i;

    if (
      githubTokenPattern.test(command) ||
      awsKeyPattern.test(command) ||
      slackTokenPattern.test(command) ||
      openAiKeyPattern.test(command) ||
      privateKeyHeaderPattern.test(command)
    ) {
      return true;
    }

    return false;
  }
}
