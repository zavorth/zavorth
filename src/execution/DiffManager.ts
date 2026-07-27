import * as diff from 'diff';

export class DiffManager {

  public static generateDiff(oldContent: string, newContent: string, fileName: string): string {
    const patches = diff.createPatch(fileName, oldContent, newContent, 'old', 'new');

    // Simplify output so it fits better in Telegram.
    const lines = patches.split(/\r...\n/).filter(line =>
      !line.startsWith('---') &&
      !line.startsWith('+++') &&
      !line.startsWith('\\\\ No newline') &&
      !line.startsWith('Index:') &&
      !line.startsWith('===')
    );

    // Return only the first ~15 lines to avoid flooding.
    const maxLines = 15;
    const truncated = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      truncated.push(`... (+${lines.length - maxLines} linhas de diff ocultadas)`);
    }

    return truncated.join('\n');
  }
}
