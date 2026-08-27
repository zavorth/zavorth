/**
 * Workflow Macro Service.
 * Records, persists, and replays sequences of CLI commands and agent prompts as reusable macros.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WorkflowMacroStep {
  command: string;
  recordedAt: string;
  /** Optional working directory to run the command in; defaults to process.cwd(). */
  cwd?: string;
}

export interface WorkflowMacro {
  name: string;
  description: string;
  createdAt: string;
  steps: WorkflowMacroStep[];
}

export class WorkflowMacroService {
  private static activeRecording: { name: string; description: string; steps: WorkflowMacroStep[] } | null = null;

  private static getMacroDir(): string {
    const localDir = path.join(process.cwd(), '.zavorth', 'macros');
    if (!fs.existsSync(localDir)) {
      try {
        fs.mkdirSync(localDir, { recursive: true });
      } catch {
        const homeDir = path.join(os.homedir(), '.zavorth', 'macros');
        if (!fs.existsSync(homeDir)) fs.mkdirSync(homeDir, { recursive: true });
        return homeDir;
      }
    }
    return localDir;
  }

  /**
   * Starts recording an interactive workflow macro.
   */
  static startRecording(name: string, description = ''): void {
    this.activeRecording = {
      name: name.trim().toLowerCase(),
      description: description.trim() || `Workflow macro for ${name}`,
      steps: [],
    };
  }

  /**
   * Records a command into the active recording session.
   */
  static recordStep(command: string): void {
    if (!this.activeRecording) return;
    const cmd = command.trim();
    if (!cmd || cmd.startsWith('/macro')) return;

    this.activeRecording.steps.push({
      command: cmd,
      recordedAt: new Date().toISOString(),
    });
  }

  /**
   * Finishes recording and saves the macro to disk.
   */
  static stopRecording(): WorkflowMacro | null {
    if (!this.activeRecording) return null;

    const macro: WorkflowMacro = {
      name: this.activeRecording.name,
      description: this.activeRecording.description,
      createdAt: new Date().toISOString(),
      steps: [...this.activeRecording.steps],
    };

    this.activeRecording = null;
    this.saveMacro(macro);
    return macro;
  }

  static isRecording(): boolean {
    return this.activeRecording !== null;
  }

  static getActiveRecordingName(): string | null {
    return this.activeRecording?.name || null;
  }

  /**
   * Lists all saved macros.
   */
  static listMacros(): WorkflowMacro[] {
    const dir = this.getMacroDir();
    const macros: WorkflowMacro[] = [];

    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
              const parsed: WorkflowMacro = JSON.parse(raw);
              if (parsed.name && Array.isArray(parsed.steps)) {
                macros.push(parsed);
              }
            } catch {
              // Ignore corrupt files
            }
          }
        }
      }
    } catch {
      // Non-blocking
    }

    return macros;
  }

  /**
   * Retrieves a macro by name.
   */
  static getMacro(name: string): WorkflowMacro | null {
    const target = name.trim().toLowerCase();
    const file = path.join(this.getMacroDir(), `${target}.json`);
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Deletes a macro by name.
   */
  static deleteMacro(name: string): boolean {
    const target = name.trim().toLowerCase();
    const file = path.join(this.getMacroDir(), `${target}.json`);
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

private static saveMacro(macro: WorkflowMacro): void {
    const file = path.join(this.getMacroDir(), `${macro.name}.json`);
    try {
      fs.writeFileSync(file, JSON.stringify(macro, null, 2), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  /**
   * Executes a saved macro by running its steps through the CLI.
   */
  static async runMacro(name: string): Promise<{ success: boolean; results: string[]; errors: string[] }> {
    const macro = this.getMacro(name);
    if (!macro) {
      return { success: false, results: [], errors: [`Macro "${name}" not found.`] };
    }

    const { execSync } = await import('child_process');
    const results: string[] = [];
    const errors: string[] = [];

    for (const step of macro.steps) {
      try {
        const output = execSync(step.command, {
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
          cwd: step.cwd || process.cwd(),
        });
        results.push(output.trim() || `[OK] ${step.command}`);
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push(`[ERROR] ${step.command}: ${error}`);
      }
    }

    return { success: errors.length === 0, results, errors };
  }
}
