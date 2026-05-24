export class TerminalPrompt {
  static async confirm(message: string, initial = false): Promise<boolean> {
    return initial;
  }
  static async input(message: string, initial = ''): Promise<string> {
    return initial;
  }
  static async select<T extends string>(message: string, choices: T[]): Promise<T | null> {
    return choices[0] || null;
  }
}
