export class TerminalTimeline {
  static render(items: Array<{ title: string; detail?: string | null }>): string {
    return items.map((item) => item.detail ? `${item.title}\n${item.detail}` : item.title).join('\n');
  }

  static print(items: Array<{ title: string; detail?: string | null }>): void {
    process.stdout.write(`${this.render(items)}\n`);
  }
}
