import fs from 'fs';
import { execFileSync } from 'child_process';
import { logger } from '../logger.js';

export class ZavorthSandboxDebuggerService {
  /**
   * Validates and applies corrected code to a tool file safely.
   * If validation fails (TypeScript compilation or unit tests fail),
   * rolls back the file to its original content.
   *
   * @returns true if successful and applied; false if failed and rolled back.
   */
  public static validateAndApply(
    filePath: string,
    correctedCode: string,
    testPath?: string
  ): boolean {
    if (!fs.existsSync(filePath)) {
      logger.error(`[Sandbox Debugger] File not found: ${filePath}`);
      return false;
    }

    const originalContent = fs.readFileSync(filePath, 'utf-8');

    try {
      logger.info(`[Sandbox Debugger] Writing candidate code to ${filePath}...`);
      fs.writeFileSync(filePath, correctedCode, 'utf-8');

      // 1. Run TypeScript compilation check
      logger.info(`[Sandbox Debugger] Running tsc compilation check on ${filePath}...`);
      try {
        execFileSync('node', [
          'node_modules/typescript/bin/tsc',
          '--noEmit',
          '--skipLibCheck',
          '--target', 'ES2022',
          '--moduleResolution', 'node',
          filePath
        ], {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 60000,
        });
      } catch (tscError: any) {
        const errorOutput = tscError.stdout?.toString() || tscError.stderr?.toString() || tscError.message;
        logger.warn(`[Sandbox Debugger] Compilation check failed. Output:\n${errorOutput}`);
        logger.warn(`[Sandbox Debugger] Rolling back changes...`);
        fs.writeFileSync(filePath, originalContent, 'utf-8');
        return false;
      }

      // 2. Run Jest unit test if a test path is provided
      if (testPath && fs.existsSync(testPath)) {
        logger.info(`[Sandbox Debugger] Running unit tests: ${testPath}...`);
        try {
          execFileSync('node', [
            '--experimental-vm-modules',
            'node_modules/jest/bin/jest.js',
            testPath,
            '--runInBand',
            '--passWithNoTests'
          ], {
            cwd: process.cwd(),
            stdio: 'pipe',
            timeout: 45000,
          });
        } catch (testError) {
          logger.warn(`[Sandbox Debugger] Unit tests failed. Rolling back changes...`);
          fs.writeFileSync(filePath, originalContent, 'utf-8');
          return false;
        }
      }

      logger.info(`[Sandbox Debugger] Safe code validation passed! Changes applied successfully.`);
      return true;
    } catch (err) {
      logger.error(`[Sandbox Debugger] Unexpected error during validation: ${err}`);
      // Safety rollback
      try {
        fs.writeFileSync(filePath, originalContent, 'utf-8');
      } catch (rollbackErr) {
        logger.error(`[Sandbox Debugger] Failed to rollback: ${rollbackErr}`);
      }
      return false;
    }
  }
}
