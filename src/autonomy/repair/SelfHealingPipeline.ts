/**
 * Self-Healing Repair Pipeline Engine.
 * Manages autonomous repair loops: executes validation commands, parses diagnostic errors,
 * applies surgical fixes, and verifies resolution within bounded attempts.
 * Strictly typed (Zero any) and EN-First.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ErrorTraceParser } from './ErrorTraceParser.js';
import type { RepairTarget, RepairAttempt, SelfRepairReceipt, PatchApplier, DiagnosticFinding } from './types.js';
import { logger } from '../../logger.js';

const execAsync = promisify(exec);

export class SelfHealingPipeline {
  private readonly receipts: SelfRepairReceipt[] = [];

  private async runCommand(command: string, cwd?: string): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
      return { success: true, output: `${stdout}\n${stderr}`.trim() };
    } catch (err: unknown) {
      const errorObj = err as { stdout?: string; stderr?: string; message?: string };
      const output = `${errorObj.stdout || ''}\n${errorObj.stderr || ''}\n${errorObj.message || ''}`.trim();
      return { success: false, output };
    }
  }

  /**
   * Executes the self-healing repair loop on a target command.
   */
  public async executeRepair(target: RepairTarget, patchApplier?: PatchApplier): Promise<SelfRepairReceipt> {
    const startTime = Date.now();
    const maxAttempts = target.maxAttempts || 3;
    const attempts: RepairAttempt[] = [];

    logger.info(`[SelfHealing] Starting repair loop for target command "${target.command}" (max attempts: ${maxAttempts}).`);

    // Initial validation run
    const initialRun = await this.runCommand(target.command, target.cwd);
    if (initialRun.success) {
      const receipt: SelfRepairReceipt = {
        id: `repair_${Date.now()}`,
        targetCommand: target.command,
        status: 'resolved',
        attempts: [],
        totalDurationMs: Date.now() - startTime,
        finalOutput: initialRun.output,
        createdAt: new Date().toISOString(),
      };
      this.receipts.push(receipt);
      return receipt;
    }

    let lastOutput = initialRun.output;

    for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
      const attemptStart = Date.now();
      const diagnostics: DiagnosticFinding[] = ErrorTraceParser.parse(lastOutput);

      logger.info(`[SelfHealing] Attempt ${attemptNum}/${maxAttempts}: found ${diagnostics.length} diagnostic findings.`);

      if (diagnostics.length === 0) {
        // No parseable diagnostics found; abort
        attempts.push({
          attemptNumber: attemptNum,
          diagnostics: [],
          filesModified: [],
          success: false,
          durationMs: Date.now() - attemptStart,
          error: 'No parseable error trace found in output.',
        });
        break;
      }

      let filesModified: string[] = [];
      let patchDesc = '';

      if (patchApplier) {
        try {
          const patchResult = await patchApplier(diagnostics[0], attemptNum);
          filesModified = patchResult.modifiedFiles;
          patchDesc = patchResult.description;
        } catch (err: unknown) {
          logger.error(`[SelfHealing] Patch applier failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Re-run command to verify fix
      const validationRun = await this.runCommand(target.command, target.cwd);
      lastOutput = validationRun.output;

      const attemptRecord: RepairAttempt = {
        attemptNumber: attemptNum,
        diagnostics,
        patchDescription: patchDesc || 'Automatic diagnostic patch applied',
        filesModified,
        success: validationRun.success,
        durationMs: Date.now() - attemptStart,
      };

      attempts.push(attemptRecord);

      if (validationRun.success) {
        logger.info(`[SelfHealing] Target command resolved successfully on attempt ${attemptNum}!`);
        const receipt: SelfRepairReceipt = {
          id: `repair_${Date.now()}`,
          targetCommand: target.command,
          status: 'resolved',
          attempts,
          totalDurationMs: Date.now() - startTime,
          finalOutput: validationRun.output,
          createdAt: new Date().toISOString(),
        };
        this.receipts.push(receipt);
        return receipt;
      }
    }

    // Failed after max attempts
    const failedReceipt: SelfRepairReceipt = {
      id: `repair_${Date.now()}`,
      targetCommand: target.command,
      status: 'failed',
      attempts,
      totalDurationMs: Date.now() - startTime,
      finalOutput: lastOutput,
      createdAt: new Date().toISOString(),
    };

    this.receipts.push(failedReceipt);
    return failedReceipt;
  }

  public getReceipts(): SelfRepairReceipt[] {
    return [...this.receipts];
  }
}
