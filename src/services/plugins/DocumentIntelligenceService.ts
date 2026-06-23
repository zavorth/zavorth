import fs from 'fs';
import path from 'path';

export interface DocumentMetadata {
  filename: string;
  extension: string;
  size_bytes: number;
  created_at: string;
  modified_at: string;
  pages: number | null;
  words: number;
  characters: number;
  language: string | null;
}

export interface DocumentSection {
  title: string;
  content: string;
  level: number;
  page: number | null;
}

export class DocumentIntelligenceService {
  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'document-intelligence');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public async analyze(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) return `Error: "${filePath}" not found.`;

    const metadata = this.getMetadata(filePath);
    const content = this.extractText(filePath);
    const sections = this.extractSections(content);
    const summary = this.generateSummary(content);

    return [
      'Document Analysis:',
      `  File: ${metadata.filename}`,
      `  Type: ${metadata.extension}`,
      `  Size: ${(metadata.size_bytes / 1024).toFixed(1)}KB`,
      `  Words: ${metadata.words}`,
      `  Characters: ${metadata.characters}`,
      `  Sections: ${sections.length}`,
      '',
      'Summary:',
      summary,
      '',
      'Sections:',
      ...sections.slice(0, 10).map((s) => `  ${'#'.repeat(s.level)} ${s.title} (${s.content.length} chars)`),
    ].join('\n');
  }

  public extractText(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';

    const ext = path.extname(filePath).toLowerCase();
    try {
      switch (ext) {
        case '.txt':
        case '.md':
        case '.json':
        case '.csv':
        case '.xml':
        case '.html':
        case '.htm':
          return fs.readFileSync(filePath, 'utf-8');
        case '.pdf':
          return this.extractPdfText(filePath);
        case '.docx':
          return this.extractDocxText(filePath);
        default:
          return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error: unknown) {
      return `Error extracting text: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public getMetadata(filePath: string): DocumentMetadata {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const content = this.extractText(filePath);
    const words = content.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      filename: path.basename(filePath),
      extension: ext,
      size_bytes: stat.size,
      created_at: stat.birthtime.toISOString(),
      modified_at: stat.mtime.toISOString(),
      pages: this.estimatePages(content, ext),
      words,
      characters: content.length,
      language: this.detectLanguage(content),
    };
  }

  public extractSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');
    let currentSection: DocumentSection | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: headingMatch[2],
          content: '',
          level: headingMatch[1].length,
          page: null,
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }
    if (currentSection) sections.push(currentSection);

    return sections;
  }

  public generateSummary(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) return content;
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    let summary = '';
    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
    }
    return summary || content.slice(0, maxLength) + '...';
  }

  public compareDocuments(file1: string, file2: string): string {
    if (!fs.existsSync(file1)) return `Error: "${file1}" not found.`;
    if (!fs.existsSync(file2)) return `Error: "${file2}" not found.`;

    const content1 = this.extractText(file1);
    const content2 = this.extractText(file2);
    const words1 = new Set(content1.split(/\s+/));
    const words2 = new Set(content2.split(/\s+/));

    const onlyIn1 = [...words1].filter((w) => !words2.has(w));
    const onlyIn2 = [...words2].filter((w) => !words1.has(w));
    const common = [...words1].filter((w) => words2.has(w));

    return [
      'Document Comparison:',
      `  File 1: ${path.basename(file1)} (${words1.size} unique words)`,
      `  File 2: ${path.basename(file2)} (${words2.size} unique words)`,
      `  Common words: ${common.length}`,
      `  Only in file 1: ${onlyIn1.length}`,
      `  Only in file 2: ${onlyIn2.length}`,
      `  Similarity: ${((common.length / Math.max(words1.size, words2.size)) * 100).toFixed(1)}%`,
    ].join('\n');
  }

  public searchInDocument(filePath: string, query: string): string {
    if (!fs.existsSync(filePath)) return `Error: "${filePath}" not found.`;

    const content = this.extractText(filePath);
    const lines = content.split('\n');
    const results: Array<{ line: number; content: string; context: string }> = [];

    const queryLower = query.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n');
        results.push({ line: i + 1, content: lines[i].trim(), context });
      }
    }

    if (results.length === 0) return `No results found for "${query}".`;

    return [
      `Search Results for "${query}" (${results.length} matches):`,
      ...results.slice(0, 10).map((r) => `  Line ${r.line}: ${r.content.slice(0, 100)}`),
    ].join('\n');
  }

  public extractKeywords(content: string, limit: number = 10): string {
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
    const freq: Record<string, number> = {};
    for (const word of words) {
      const clean = word.replace(/[^\w]/g, '');
      if (clean.length > 2 && !stopWords.has(clean)) {
        freq[clean] = (freq[clean] || 0) + 1;
      }
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return ['Keywords:', ...sorted.map(([word, count]) => `  ${word}: ${count}`)].join('\n');
  }

  private extractPdfText(filePath: string): string {
    try {
      const { execFileSync } = require('child_process');
      const result = execFileSync('pdftotext', [filePath, '-'], { timeout: 30000 }).toString();
      return result;
    } catch {
      return '[PDF extraction requires pdftotext]';
    }
  }

  private extractDocxText(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      const text = content.toString('utf-8');
      const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (matches) return matches.map((m: string) => m.replace(/<[^>]+>/g, '')).join(' ');
      return '[DOCX extraction failed]';
    } catch {
      return '[DOCX extraction error]';
    }
  }

  private estimatePages(content: string, ext: string): number | null {
    if (ext === '.pdf') {
      const pages = content.match(/\f/g);
      return pages ? pages.length + 1 : null;
    }
    return Math.ceil(content.length / 2000);
  }

  private detectLanguage(content: string): string | null {
    const sample = content.slice(0, 2000).toLowerCase();
    
    // Asian languages (check first - distinctive scripts)
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'ja'; // Japanese (Hiragana/Katakana)
    if (/[\u4e00-\u9fff]/.test(sample)) return 'zh'; // Chinese
    if (/[\uac00-\ud7af]/.test(sample)) return 'ko'; // Korean
    if (/[\u0400-\u04ff]/.test(sample)) return 'ru'; // Russian (Cyrillic)
    if (/[\u0600-\u06ff]/.test(sample)) return 'ar'; // Arabic
    if (/[\u0900-\u097f]/.test(sample)) return 'hi'; // Hindi (Devanagari)
    
    // European languages with distinctive characters
    if (/[àáâãéêíóôõúç]/.test(sample)) return 'pt'; // Portuguese
    if (/[äöüß]/.test(sample)) return 'de'; // German
    if (/[àâçéèêëîïôùûüÿ]/.test(sample)) return 'fr'; // French
    if (/[áéíóúñ]/.test(sample)) return 'es'; // Spanish
    if (/[àèéìíîòóùú]/.test(sample)) return 'it'; // Italian
    if (/[àèéêîïôùûüÿæœ]/.test(sample)) return 'fr'; // French (extended)
    if (/[ãõ]/.test(sample)) return 'pt'; // Portuguese (extended)
    if (/[åæø]/.test(sample)) return 'da'; // Danish/Norwegian
    if (/[äöüõ]/.test(sample)) return 'et'; // Estonian
    if (/[ąćęłńóśźż]/.test(sample)) return 'pl'; // Polish
    if ((/[čďěňřšťůž]/.test(sample))) return 'cs'; // Czech
    if ((/[áéíóöőúüű]/.test(sample))) return 'hu'; // Hungarian
    if ((/[ćčđšž]/.test(sample))) return 'hr'; // Croatian
    if ((/[ãõ]/.test(sample))) return 'pt'; // Portuguese
    
    // Word frequency analysis for common languages
    const words = sample.split(/\s+/).slice(0, 100);
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      const clean = word.replace(/[^\w]/g, '');
      if (clean.length > 1) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
    
    // Common words by language
    const langPatterns: Record<string, string[]> = {
      'en': ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'in', 'it', 'of', 'for', 'that', 'was', 'with'],
      'es': ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'ser', 'se', 'no', 'haber', 'por', 'con', 'su', 'para'],
      'fr': ['le', 'la', 'de', 'et', 'un', 'être', 'en', 'que', 'pour', 'dans', 'ce', 'il', 'qui', 'ne', 'sur'],
      'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'ein'],
      'pt': ['o', 'a', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os'],
      'it': ['il', 'di', 'che', 'è', 'e', 'la', 'per', 'in', 'un', 'del', 'non', 'con', 'sono', 'una', 'si'],
      'nl': ['de', 'het', 'van', 'een', 'en', 'in', 'is', 'dat', 'op', 'te', 'zijn', 'voor', 'met', 'niet', 'aan'],
      'ru': ['и', 'в', 'не', 'на', 'я', 'быть', 'он', 'с', 'что', 'а', 'по', 'это', 'как', 'из', 'за'],
    };
    
    let bestLang = 'en';
    let bestScore = 0;
    
    for (const [lang, patterns] of Object.entries(langPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (wordFreq[pattern]) score += wordFreq[pattern];
      }
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }
    
    return bestLang;
  }
}
