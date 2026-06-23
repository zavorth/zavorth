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
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    try {
      const { execFileSync } = require('child_process');
      const prompt = `Detect the language of this text. Reply with ONLY the ISO 639-1 language code (e.g., "en", "es", "fr", "de", "pt", "ja", "zh", "ko", "ru", "ar", "hi", etc.). No explanation, just the code.\n\nText: "${text.slice(0, 300)}"`;

      if (process.env.GEMINI_API_KEY) {
        const payload = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        });
        const tmpFile = path.join(require('os').tmpdir(), `lang_detect_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
            '-d', `@${tmpFile}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          ], { timeout: 10000 }).toString();
          const parsed = JSON.parse(result);
          const langCode = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
          if (langCode && langCode.length === 2) return langCode;
        } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
      }

      if (process.env.OPENAI_API_KEY) {
        const payload = JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 10,
          temperature: 0,
        });
        const tmpFile = path.join(require('os').tmpdir(), `lang_detect_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST', '-H', `Authorization: Bearer ${process.env.OPENAI_API_KEY}`,
            '-H', 'Content-Type: application/json', '-d', `@${tmpFile}`,
            'https://api.openai.com/v1/chat/completions',
          ], { timeout: 10000 }).toString();
          const parsed = JSON.parse(result);
          const langCode = parsed.choices?.[0]?.message?.content?.trim().toLowerCase();
          if (langCode && langCode.length === 2) return langCode;
        } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
      }

      return null;
    } catch { return null; }
  }

  private detectByScript(text: string): string | null {
    // Asian scripts (distinctive, reliable)
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Japanese
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh'; // Chinese
    if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // Korean
    if (/[\u0400-\u04ff]/.test(text)) return 'ru'; // Russian
    if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic
    if (/[\u0900-\u097f]/.test(text)) return 'hi'; // Hindi
    if (/[\u0e00-\u0e7f]/.test(text)) return 'th'; // Thai
    if (/[\u0590-\u05ff]/.test(text)) return 'he'; // Hebrew
    if (/[\u1000-\u109f]/.test(text)) return 'my'; // Myanmar
    if (/[\u1780-\u17ff]/.test(text)) return 'km'; // Khmer
    return null;
  }

  private detectByNgrams(text: string): { language: string; confidence: number } | null {
    // Common n-grams by language (bigrams and trigrams)
    const ngramProfiles: Record<string, string[]> = {
      'en': ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'the', 'and', 'ing', 'ion', 'tio', 'ent', 'ati', 'for', 'ter', 'hat'],
      'es': ['de', 'en', 'el', 'la', 'es', 'ón', 'ci', 'ad', 're', 'ar', 'que', 'ión', 'ent', 'nte', 'ado', 'los', 'las', 'del', 'por', 'con'],
      'fr': ['le', 'de', 'es', 'en', 're', 'nt', 'on', 'ou', 'an', 'qu', 'les', 'ent', 'que', 'ait', 'est', 'des', 'ous', 'ant', 'par', 'son'],
      'de': ['en', 'er', 'de', 'ie', 'ei', 'te', 'in', 'nd', 'ch', 'ge', 'ein', 'ich', 'die', 'und', 'der', 'den', 'sch', 'ung', 'ber', 'ver'],
      'pt': ['de', 'da', 'do', 'em', 'os', 'ão', 'ar', 'er', 'ra', 'qu', 'que', 'ent', 'ção', 'ado', 'com', 'par', 'dos', 'das', 'por', 'nte'],
      'it': ['di', 're', 'la', 'le', 'to', 'no', 'ne', 'co', 'ta', 'ri', 'che', 'ion', 'ent', 'ato', 'per', 'con', 'del', 'ell', 'gli', 'zione'],
      'nl': ['en', 'de', 'er', 'an', 'ee', 'te', 'in', 'ie', 'aa', 'ge', 'een', 'van', 'den', 'het', 'aar', 'ver', 'oor', 'ter', 'sch', 'ijk'],
      'ru': ['ст', 'но', 'на', 'ко', 'ни', 'ен', 'по', 'ра', 'не', 'ов', 'что', 'про', 'ста', 'ени', 'ние', 'ост', 'ого', 'тор', 'при', 'ком'],
    };

    const textBigrams = this.extractNgrams(text, 2);
    const textTrigrams = this.extractNgrams(text, 3);
    const allTextNgrams = [...textBigrams, ...textTrigrams];

    let bestLang = 'en';
    let bestScore = 0;

    for (const [lang, ngrams] of Object.entries(ngramProfiles)) {
      let matches = 0;
      for (const ngram of ngrams) {
        if (allTextNgrams.includes(ngram)) matches++;
      }
      const score = matches / ngrams.length;
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return { language: bestLang, confidence: bestScore };
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
    const words = text.split(/\s+/).slice(0, 200);
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      const clean = word.replace(/[^\w]/g, '');
      if (clean.length > 1) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }

    // Stop words by language (most common words)
    const stopWords: Record<string, string[]> = {
      'en': ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'in', 'it', 'of', 'for', 'that', 'was', 'with', 'be', 'this', 'have', 'from', 'are'],
      'es': ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'ser', 'se', 'no', 'haber', 'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo'],
      'fr': ['le', 'la', 'de', 'et', 'un', 'être', 'en', 'que', 'pour', 'dans', 'ce', 'il', 'qui', 'ne', 'sur', 'pas', 'plus', 'par', 'avec', 'son'],
      'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'ein', 'nicht', 'ein', 'eine', 'als', 'auch'],
      'pt': ['o', 'a', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais'],
      'it': ['il', 'di', 'che', 'è', 'e', 'la', 'per', 'in', 'un', 'del', 'non', 'con', 'sono', 'una', 'si', 'le', 'come', 'questo', 'ma', 'ha'],
      'nl': ['de', 'het', 'van', 'een', 'en', 'in', 'is', 'dat', 'op', 'te', 'zijn', 'voor', 'met', 'niet', 'aan', 'er', 'ook', 'maar', 'als', 'dan'],
      'ru': ['и', 'в', 'не', 'на', 'я', 'быть', 'он', 'с', 'что', 'а', 'по', 'это', 'как', 'из', 'за', 'но', 'к', 'у', 'вы', 'мы'],
    };

    let bestLang = 'en';
    let bestScore = 0;

    for (const [lang, patterns] of Object.entries(stopWords)) {
      let score = 0;
      for (const pattern of patterns) {
        if (wordFreq[pattern]) score += wordFreq[pattern];
      }
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return bestScore > 5 ? bestLang : null;
  }

  private detectByCharFrequency(text: string): string | null {
    // Character frequency analysis for Latin-script languages
    const charFreq: Record<string, number> = {};
    for (const char of text) {
      if (/[a-z]/.test(char)) {
        charFreq[char] = (charFreq[char] || 0) + 1;
      }
    }

    const totalChars = Object.values(charFreq).reduce((s, c) => s + c, 0);
    if (totalChars === 0) return null;

    // Normalize frequencies
    const normalized: Record<string, number> = {};
    for (const [char, count] of Object.entries(charFreq)) {
      normalized[char] = count / totalChars;
    }

    // Language-specific character patterns
    const patterns: Record<string, Record<string, number>> = {
      'pt': { 'a': 0.14, 'e': 0.12, 'o': 0.10, 's': 0.08, 'r': 0.07, 'n': 0.05, 'i': 0.05, 'd': 0.05 },
      'es': { 'e': 0.13, 'a': 0.12, 'o': 0.09, 's': 0.08, 'r': 0.07, 'n': 0.07, 'i': 0.06, 'd': 0.06 },
      'fr': { 'e': 0.15, 'a': 0.08, 's': 0.08, 'i': 0.07, 't': 0.07, 'n': 0.07, 'r': 0.07, 'u': 0.06 },
      'de': { 'e': 0.17, 'n': 0.10, 'i': 0.08, 's': 0.07, 'r': 0.07, 'a': 0.06, 't': 0.06, 'd': 0.05 },
      'it': { 'e': 0.11, 'a': 0.11, 'i': 0.11, 'o': 0.10, 'n': 0.07, 'l': 0.06, 'r': 0.06, 't': 0.06 },
    };

    let bestLang = 'en';
    let bestScore = Infinity;

    for (const [lang, expected] of Object.entries(patterns)) {
      let score = 0;
      for (const [char, expectedFreq] of Object.entries(expected)) {
        const actualFreq = normalized[char] || 0;
        score += Math.abs(actualFreq - expectedFreq);
      }
      if (score < bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return bestScore < 0.1 ? bestLang : null;
  }
}
