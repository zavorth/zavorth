import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { TerminalTheme } from './TerminalTheme.js';

// Apply the terminal renderer
marked.use(markedTerminal({
  // Customizing colors to match Zavorth theme
  code: TerminalTheme.colors.muted,
  blockquote: TerminalTheme.colors.dim,
  html: TerminalTheme.colors.dim,
  heading: TerminalTheme.colors.primary,
  firstHeading: TerminalTheme.colors.primary.bold,
  hr: TerminalTheme.colors.dim,
  listitem: TerminalTheme.colors.primary,
  table: TerminalTheme.colors.dim,
  paragraph: (text: string) => text,
  strong: TerminalTheme.format.bold,
  em: TerminalTheme.format.italic,
  codespan: TerminalTheme.colors.secondary,
  del: TerminalTheme.format.strikethrough,
  link: TerminalTheme.colors.info,
  href: TerminalTheme.colors.info.underline,
}) as any);

export class TerminalMarkdown {
  static render(markdownText: string): string {
    // marked.parse can be synchronous if no async extensions are used
    try {
      const parsed = marked.parse(markdownText) as string;
      return parsed.trim();
    } catch (e) {
      // Fallback to raw text if parsing fails
      return markdownText;
    }
  }

  static print(markdownText: string): void {
    process.stdout.write(this.render(markdownText) + '\n');
  }
}
