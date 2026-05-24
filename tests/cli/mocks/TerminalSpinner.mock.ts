export class TerminalSpinner {
  start(): void {}
  update(): void {}
  succeed(): void {}
  fail(): void {}
  warn(): void {}
  info(): void {}
  stop(): void {}
  clear(): void {}
}
export const globalSpinner = new TerminalSpinner();
