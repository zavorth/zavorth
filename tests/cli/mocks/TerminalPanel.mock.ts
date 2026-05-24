export class TerminalPanel {
  static render(content: string): string {
    return content;
  }
  static print(content: string): void {
    process.stdout.write(content + '\n');
  }
  static error(error: any): void {
    process.stderr.write(String(error) + '\n');
  }
  static warning(message: string): void {
    process.stdout.write(message + '\n');
  }
  static success(message: string): void {
    process.stdout.write(message + '\n');
  }
  static info(message: string): void {
    process.stdout.write(message + '\n');
  }
}
