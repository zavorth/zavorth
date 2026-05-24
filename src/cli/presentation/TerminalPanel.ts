import boxen, { type Options as BoxenOptions } from 'boxen';
import { TerminalTheme } from './TerminalTheme.js';

export interface PanelOptions {
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'default';
  padding?: number;
  margin?: number;
  width?: number;
}

export class TerminalPanel {
  static render(content: string, options: PanelOptions = {}): string {
    const { type = 'default', title, padding = 1, margin = 0, width } = options;

    let borderColor = 'gray';
    let titleColor = TerminalTheme.colors.primary;

    switch (type) {
      case 'info':
        borderColor = 'cyan';
        titleColor = TerminalTheme.colors.info;
        break;
      case 'success':
        borderColor = 'green';
        titleColor = TerminalTheme.colors.success;
        break;
      case 'warning':
        borderColor = 'yellow';
        titleColor = TerminalTheme.colors.warning;
        break;
      case 'error':
        borderColor = 'red';
        titleColor = TerminalTheme.colors.error;
        break;
      case 'default':
        borderColor = 'gray';
        titleColor = TerminalTheme.colors.primary;
        break;
    }

    const boxenOptions: BoxenOptions = {
      padding,
      margin,
      borderColor,
      borderStyle: 'round',
      title: title ? titleColor(TerminalTheme.format.bold(` ${title} `)) : undefined,
      titleAlignment: 'left',
      width,
    };

    return boxen(content, boxenOptions);
  }

  static print(content: string, options: PanelOptions = {}): void {
    process.stdout.write(this.render(content, options) + '\n');
  }

  static error(error: Error | string, title = 'Error'): void {
    const message = error instanceof Error ? error.message : error;
    this.print(message, { type: 'error', title });
  }

  static warning(message: string, title = 'Warning'): void {
    this.print(message, { type: 'warning', title });
  }

  static success(message: string, title = 'Success'): void {
    this.print(message, { type: 'success', title });
  }

  static info(message: string, title = 'Info'): void {
    this.print(message, { type: 'info', title });
  }
}
