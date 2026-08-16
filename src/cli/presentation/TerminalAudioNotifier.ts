/**
 * Terminal Audio & Notification Notifier.
 * Plays subtle, classical, and non-intrusive completion chimes and system notifications.
 */

export class TerminalAudioNotifier {
  private static enabled = true;

  /**
   * Toggles notification chimes.
   */
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  static isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Plays a subtle, gentle terminal bell chime upon task completion.
   */
  static playCompletionChime(): void {
    if (!this.enabled) return;

    try {
      // Standard ASCII Bell char - gentle, classical, and native to all terminals
      process.stdout.write('\u0007');
    } catch {
      // Safe skip if stdout unavailable
    }
  }
}
