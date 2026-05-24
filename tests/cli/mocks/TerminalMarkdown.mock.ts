export class TerminalMarkdown {
  static render(text: string): string {
    return text;
  }
  static print(text: string): void {
    process.stdout.write(text + '\n');
  }
}
