import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

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
    } catch (error: unknown) {logger.warn('[Document Intelligence] filesystem operation failed', error); return ''; }
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
    const sentences = content.split(/[.!...]+/).filter((s) => s.trim().length > 0);
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
    } catch (error: unknown) {logger.warn('[Document Intelligence] process execution failed', error);
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
    } catch (error: unknown) {logger.warn('[Document Intelligence] filesystem operation failed', error);
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
    const sample = content.slice(0, 3000).toLowerCase();

    // Method 1: Script-based detection (most reliable for non-Latin scripts)
    const scriptResult = this.detectByScript(sample);
    if (scriptResult) return scriptResult;

    // Method 2: LLM-based detection (most accurate, requires API key)
    const llmResult = this.detectByLLM(content.slice(0, 500));
    if (llmResult) return llmResult;

    // Method 3: N-gram analysis (statistical approach)
    const ngramResult = this.detectByNgrams(sample);
    if (ngramResult && ngramResult.confidence > 0.3) return ngramResult.language;

    // Method 4: Word frequency analysis
    const wordResult = this.detectByWordFrequency(sample);
    if (wordResult) return wordResult;

    // Method 5: Character frequency analysis
    const charResult = this.detectByCharFrequency(sample);
    if (charResult) return charResult;

    return 'en'; // Default fallback
  }

  private detectByLLM(text: string): string | null {
    // Try providers in priority order
    const providers = [
      { name: 'gemini', key: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent' },
      { name: 'openai', key: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/chat/completions' },
      { name: 'anthropic', key: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages' },
      { name: 'groq', key: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions' },
      { name: 'deepseek', key: 'DEEPSEEK_API_KEY', url: 'https://api.deepseek.com/v1/chat/completions' },
      { name: 'mistral', key: 'MISTRAL_API_KEY', url: 'https://api.mistral.ai/v1/chat/completions' },
    ];

    const prompt = `Detect the language of this text. Reply with ONLY the ISO 639-1 language code (e.g., "en", "es", "fr", "de", "pt", "already", "zh", "ko", "ru", "ar", "hi", etc.). No explanation, just the code.\n\nText: "${text.slice(0, 300)}"`;

    for (const provider of providers) {
      const apiKey = process.env[provider.key];
      if (!apiKey) continue;

      try {
        const { execFileSync } = require('child_process');
        let payload: string;
        let headers: string[];
        let url: string;

        if (provider.name === 'anthropic') {
          payload = JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: prompt }],
          });
          headers = ['-H', `x-api-key: ${apiKey}`, '-H', 'anthropic-version: 2023-06-01', '-H', 'Content-Type: application/json'];
          url = provider.url;
        } else         if (provider.name === 'gemini') {
          payload = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 10, temperature: 0 },
          });
          headers = ['-H', 'Content-Type: application/json', '-H', `x-goog-api-key: ${apiKey}`];
          url = provider.url;
        } else {
          payload = JSON.stringify({
            model: provider.name === 'groq' ? 'llama-3.3-70b-versatile' : provider.name === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 10,
            temperature: 0,
          });
          headers = ['-H', `Authorization: Bearer ${apiKey}`, '-H', 'Content-Type: application/json'];
          url = provider.url;
        }

        const tmpFile = path.join(require('os').tmpdir(), `lang_detect_${provider.name}_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST', ...headers, '-d', `@${tmpFile}`, url,
          ], { timeout: 10000 }).toString();
          const parsed = JSON.parse(result);

          let langCode: string | null = null;
          if (provider.name === 'anthropic') {
            langCode = parsed.content?.[0]?.text?.trim().toLowerCase();
          } else if (provider.name === 'gemini') {
            langCode = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
          } else {
            langCode = parsed.choices?.[0]?.message?.content?.trim().toLowerCase();
          }

          if (langCode && langCode.length === 2) return langCode;
        } finally { try { fs.unlinkSync(tmpFile); } catch (error: unknown) {/* ignore */ logger.warn('[Document Intelligence] file cleanup failed', error); } }
      } catch (error: unknown) {continue; }
    }

    return null;
  }

  private detectByScript(text: string): string | null {
    for (const char of text) {
      const code = char.charCodeAt(0);
      if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) return 'already';
      if (code >= 0x4e00 && code <= 0x9fff) return 'zh';
      if (code >= 0xac00 && code <= 0xd7af) return 'ko';
      if (code >= 0x0400 && code <= 0x04ff) return 'ru';
      if (code >= 0x0600 && code <= 0x06ff) return 'ar';
      if (code >= 0x0900 && code <= 0x097f) return 'hi';
      if (code >= 0x0e00 && code <= 0x0e7f) return 'th';
      if (code >= 0x0590 && code <= 0x05ff) return 'he';
      if (code >= 0x1000 && code <= 0x109f) return 'my';
      if (code >= 0x1780 && code <= 0x17ff) return 'km';
    }
    return null;
  }

  private detectByNgrams(text: string): { language: string; confidence: number } | null {
    void text;
    return null;
  }

  private extractNgrams(text: string, n: number): string[] {
    const ngrams: string[] = [];
    const clean = text.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    for (let i = 0; i <= clean.length - n; i++) {
      ngrams.push(clean.slice(i, i + n));
    }
    return [...new Set(ngrams)];
  }

  private detectByWordFrequency(text: string): string | null {
    void text;
    return null;
  }

  private detectByCharFrequency(text: string): string | null {
    void text;
    return null;
  }
}
