import ora, { type Ora } from 'ora';
import { TerminalTheme } from './TerminalTheme.js';

export class TerminalSpinner {
  private spinner: Ora | null = null;

  start(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    } else {
      this.spinner = ora({
        text,
        color: 'yellow',
        spinner: 'dots',
      }).start();
    }
  }

  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text ? TerminalTheme.colors.success(text) : undefined);
      this.spinner = null;
    }
  }

  fail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text ? TerminalTheme.colors.error(text) : undefined);
      this.spinner = null;
    }
  }

  warn(text?: string): void {
    if (this.spinner) {
      this.spinner.warn(text ? TerminalTheme.colors.warning(text) : undefined);
      this.spinner = null;
    }
  }

  info(text?: string): void {
    if (this.spinner) {
      this.spinner.info(text ? TerminalTheme.colors.info(text) : undefined);
      this.spinner = null;
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  clear(): void {
    if (this.spinner) {
      this.spinner.clear();
    }
  }
}

export const globalSpinner = new TerminalSpinner();
