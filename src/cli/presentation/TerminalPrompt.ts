import enquirer from 'enquirer';
import { TerminalTheme } from './TerminalTheme.js';
import { logger } from '../../logger.js';

const { prompt } = enquirer;

export class TerminalPrompt {
  static async confirm(message: string, initial = false): Promise<boolean> {
    try {
      const response = await prompt<{ value: boolean }>({
        type: 'confirm',
        name: 'value',
        message: TerminalTheme.colors.primary(message),
        initial,
      });
      return response.value;
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Terminal Prompt] filesystem check failed', error);
    // In case of Ctrl+C
      return false;
  }
  }

  static async input(message: string, initial = ''): Promise<string> {
    try {
      const response = await prompt<{ value: string }>({
        type: 'input',
        name: 'value',
        message: TerminalTheme.colors.primary(message),
        initial,
      });
      return response.value;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Terminal Prompt] filesystem check failed', error); return ''; }
  }

  static async select<T extends string>(message: string, choices: T[]): Promise<T | null> {
    try {
      const response = await prompt<{ value: T }>({
        type: 'select',
        name: 'value',
        message: TerminalTheme.colors.primary(message),
        choices: choices as unknown as string[],
      });
      return response.value;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Terminal Prompt] filesystem check failed', error); return null; }
  }
}
