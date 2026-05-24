export class TerminalDiff {
  static render(oldStr: string, newStr: string): string {
    return oldStr + '\n' + newStr;
  }
  static print(oldStr: string, newStr: string): void {
    process.stdout.write(oldStr + '\n' + newStr + '\n');
  }
}
