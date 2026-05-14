import * as diff from 'diff';

export class DiffManager {
  
  public static generateDiff(oldContent: string, newContent: string, fileName: string): string {
    const patches = diff.createPatch(fileName, oldContent, newContent, 'old', 'new');
    
    // Simplificar a saída para caber melhor no Telegram
    const lines = patches.split(/\r?\n/).filter(line => 
      !line.startsWith('---') && 
      !line.startsWith('+++') && 
      !line.startsWith('\\\\ No newline') &&
      !line.startsWith('Index:') &&
      !line.startsWith('===')
    );
    
    // Retorna apenas até as primeiras ~15 linhas para não floodar
    const maxLines = 15;
    const truncated = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      truncated.push(`... (+${lines.length - maxLines} linhas de diff ocultadas)`);
    }

    return truncated.join('\n');
  }
}
