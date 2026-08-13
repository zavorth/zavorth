import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';

interface ExtractionResult {
  success: boolean;
  file_path: string;
  file_type: string;
  file_size: number;
  page_count?: number;
  extracted_text: string;
  metadata: Record<string, unknown>;
  tables?: string[][];
  images?: string[];
  error?: string;
}

export class ZavorthDocumentExtractorTool extends BaseTool {
  public readonly name = 'zavorth_document_extractor';

  public readonly description =
    'Extracts text, tables, metadata, and images from PDF, DOCX, XLSX, PPTX, CSV, HTML, RTF, ODT, and other document formats. Supports OCR for images and scanned PDFs.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file to extract.',
      },
      format: {
        type: 'string',
        description: "Output format: 'text' (default), 'markdown', 'html', 'json'.",
      },
      extract_tables: {
        type: 'boolean',
        description: 'If true, extracts tables encontradas. Default: false.',
      },
      extract_images: {
        type: 'boolean',
        description: 'If true, lists/extracts images. Default: false.',
      },
      extract_metadata: {
        type: 'boolean',
        description: 'If true, extracts file metadata. Default: true.',
      },
      ocr: {
        type: 'boolean',
        description: 'If true, applies OCR to scanned images/PDFs. Default: false.',
      },
      page_range: {
        type: 'string',
        description: "Pages to extract (PDF/DOCX): '1-5', '1,3,5', 'all'. Default: 'all'.",
      },
      language: {
        type: 'string',
        description: "Language for OCR. Default: 'por+eng'.",
      },
      output_path: {
        type: 'string',
        description: 'Path to save o result extraido.',
      },
      max_chars: {
        type: 'number',
        description: 'Limite maximum of characters extraidos. Default: 50000.',
      },
    },
    required: ['file_path'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" parameter is required.';

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return `Error: file "${filePath}" not found.`;
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return `Error: "${filePath}" is not a file.`;
    }

    if (resolvedPath.includes('\0')) {
      return 'Error: invalid file path.';
    }

    if (stat.size > 100 * 1024 * 1024) {
      return 'Error: file exceeds 100MB. Split into smaller parts.';
    }

    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    const format = String(args.format || 'text');
    const extractTables = args.extract_tables === true;
    const extractImages = args.extract_images === true;
    const extractMetadata = args.extract_metadata !== false;
    const useOcr = args.ocr === true;
    const pageRange = String(args.page_range || 'all');
    const language = String(args.language || 'por+eng');
    const maxChars = typeof args.max_chars === 'number' ? args.max_chars : 50000;
    const outputPath = typeof args.output_path === 'string' ? args.output_path : undefined;

    const supportedFormats = [
      'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt',
      'csv', 'tsv', 'html', 'htm', 'rtf', 'odt', 'ods', 'odp',
      'txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml',
      'epub', 'mobi',
    ];

    if (!supportedFormats.includes(ext)) {
      return `Error: format "${ext}" not supported. Use: ${supportedFormats.join(', ')}.`;
    }

    try {
      const result = await this.extractDocument(resolvedPath, ext, {
        format,
        extractTables,
        extractImages,
        extractMetadata,
        useOcr,
        pageRange,
        language,
        maxChars,
      });

      if (!result.success) {
        return `Extraction error: ${result.error}`;
      }

      const output = this.formatResult(result, format);

      if (outputPath) {
        fs.writeFileSync(path.resolve(outputPath), output, 'utf-8');
        return `Document extracted and saved at ${outputPath}. Size: ${output.length} chars.`;
      }

      if (output.length > maxChars) {
        return output.slice(0, maxChars) + `\n\n... [truncated at ${maxChars} characters]`;
      }

      return output;
    } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] filesystem operation failed', error);
    const message = error instanceof Error ? error.message : String(error);
      return `Extraction error: ${message}`;
  }
  }

  private async extractDocument(
    filePath: string,
    ext: string,
    options: {
      format: string;
      extractTables: boolean;
      extractImages: boolean;
      extractMetadata: boolean;
      useOcr: boolean;
      pageRange: string;
      language: string;
      maxChars: number;
    },
  ): Promise<ExtractionResult> {
    const stat = fs.statSync(filePath);
    const baseResult: ExtractionResult = {
      success: false,
      file_path: filePath,
      file_type: ext,
      file_size: stat.size,
      extracted_text: '',
      metadata: {},
    };

    try {
      switch (ext) {
        case 'pdf':
          return await this.extractPdf(filePath, baseResult, options);
        case 'docx':
        case 'doc':
          return await this.extractDocx(filePath, baseResult, options);
        case 'xlsx':
        case 'xls':
          return await this.extractXlsx(filePath, baseResult, options);
        case 'pptx':
        case 'ppt':
          return await this.extractPptx(filePath, baseResult, options);
        case 'csv':
        case 'tsv':
          return this.extractCsv(filePath, baseResult, ext);
        case 'html':
        case 'htm':
          return this.extractHtml(filePath, baseResult);
        case 'json':
          return this.extractJson(filePath, baseResult);
        case 'xml':
          return this.extractXml(filePath, baseResult);
        case 'txt':
        case 'md':
        case 'yaml':
        case 'yml':
        case 'toml':
        case 'rtf':
          return this.extractPlainText(filePath, baseResult);
        default:
          return { ...baseResult, error: `Extractor for "${ext}" is not implemented.` };
      }
    } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] operation failed', error);
    return { ...baseResult, error: this.sanitizePath(error instanceof Error ? error.message : String(error)) };
  }
  }

  private async extractPdf(
    filePath: string,
    base: ExtractionResult,
    options: { extractTables: boolean; extractImages: boolean; useOcr: boolean; pageRange: string; language: string },
  ): Promise<ExtractionResult> {
    const { execFileSync } = await import('child_process');

    try {
      let text: string;
      const pages = this.parsePageRange(options.pageRange);

      if (pages.length === 0) {
        text = execFileSync('pdftotext', ['-layout', filePath, '-'], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).toString();
      } else {
        const isContiguous = pages.every((p, i) => i === 0 || p === pages[i - 1] + 1);
        if (isContiguous) {
          text = execFileSync('pdftotext', ['-layout', '-f', String(pages[0]), '-l', String(pages[pages.length - 1]), filePath, '-'], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).toString();
        } else {
          const parts: string[] = [];
          for (const page of pages) {
            try {
              const part = execFileSync('pdftotext', ['-layout', '-f', String(page), '-l', String(page), filePath, '-'], { timeout: 10000 }).toString();
              if (part.trim()) parts.push(part.trim());
            } catch (error: unknown) { /* skip individual page errors */ logger.warn('[Zavorth Document Extractor] process execution failed', error); }
          }
          text = parts.join('\n\n');
        }
      }

      let pageCount: number | undefined;
      try {
        const info = execFileSync('pdfinfo', [filePath], { timeout: 5000 }).toString();
        const match = info.match(/Pages:\s*(\d+)/);
        if (match) pageCount = safeParseInt(match[1], 0) || undefined;
      } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] process execution failed', error); }

      let tables: string[][] | undefined;
      if (options.extractTables) {
        try {
          const tableData = execFileSync('pdftotext', ['-layout', filePath, '-'], { timeout: 30000 }).toString();
          tables = this.parseTablesFromText(tableData);
        } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] process execution failed', error); }
      }

      return {
        ...base,
        success: true,
        extracted_text: text.trim(),
        page_count: pageCount,
        tables,
        metadata: { tool: 'pdftotext' },
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (options.useOcr) {
        return this.ocrPdf(filePath, base, options.language);
      }
      return { ...base, error: `pdftotext failed: ${this.sanitizePath(errMsg)}. Install poppler-utils. Use ocr=true for OCR.` };
    }
  }

  private parsePageRange(range: string): number[] {
    if (range === 'all') return [];
    const pages: number[] = [];
    for (const part of range.split(',')) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = safeParseInt(startStr, 0);
        const end = safeParseInt(endStr, 0);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) pages.push(i);
        }
      } else {
        const num = safeParseInt(trimmed, 0);
        if (!isNaN(num)) pages.push(num);
      }
    }
    return [...new Set(pages)].sort((a, b) => a - b);
  }

  private async ocrPdf(filePath: string, base: ExtractionResult, language: string): Promise<ExtractionResult> {
    const { execFileSync } = await import('child_process');
    const tmpDir = path.join(process.cwd(), 'data', 'runtime', 'ocr_temp');

    try {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      execFileSync('pdftoppm', ['-png', filePath, path.join(tmpDir, 'page')], { timeout: 60000 });
      const pages = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.png')).sort();

      const texts: string[] = [];
      for (const page of pages) {
        const pagePath = path.join(tmpDir, page);
        try {
          const text = execFileSync('tesseract', [pagePath, 'stdout', '-l', language], { timeout: 30000 }).toString();
          texts.push(text.trim());
        } finally {
          try { fs.unlinkSync(pagePath); } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] file cleanup failed', error); }
        }
      }

      return {
        ...base,
        success: true,
        extracted_text: texts.join('\n\n--- Page Break ---\n\n'),
        page_count: pages.length,
        metadata: { tool: 'tesseract', language },
      };
    } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] file cleanup failed', error);
    return { ...base, error: `OCR failed: ${this.sanitizePath(error instanceof Error ? error.message : String(error))}. Install tesseract-ocr.` };
  } finally {
      try {
        const remaining = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.png'));
        for (const f of remaining) {
          try { fs.unlinkSync(path.join(tmpDir, f)); } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] file cleanup failed', error); }
        }
      } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] file cleanup failed', error); }
    }
  }

  private async extractDocx(
    filePath: string,
    base: ExtractionResult,
    _options: unknown,
  ): Promise<ExtractionResult> {
    const { execFileSync } = await import('child_process');
    const os = require('os');

    try {
      const script = `import zipfile, xml.etree.ElementTree as ET
z = zipfile.ZipFile(${JSON.stringify(filePath)})
doc = ET.parse(z.open('word/document.xml'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
texts = [p.text or '' for p in doc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')]
print('\\n'.join(texts))`;
      const tmpScript = path.join(os.tmpdir(), `zavorth_docx_${Date.now()}.py`);
      fs.writeFileSync(tmpScript, script);
      try {
        const text = execFileSync('python3', [tmpScript], { timeout: 30000 }).toString();
        return {
          ...base,
          success: true,
          extracted_text: text.trim(),
          metadata: { tool: 'python-docx-parse' },
        };
      } finally {
        try { fs.unlinkSync(tmpScript); } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] file cleanup failed', error); }
      }
    } catch (error: unknown) {
      try {
        const text = execFileSync('unzip', ['-p', filePath, 'word/document.xml'], { timeout: 15000 }).toString();
        return {
          ...base,
          success: true,
          extracted_text: text.replace(/<[^>]*>/g, ' ').trim(),
          metadata: { tool: 'unzip-fallback' },
        };
      } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] process execution failed', error);
    return { ...base, error: `Error extracting DOCX: ${error instanceof Error ? error.message : String(error)}` };
  }
    }
  }

  private async extractXlsx(
    filePath: string,
    base: ExtractionResult,
    _options: unknown,
  ): Promise<ExtractionResult> {
    const { execFileSync } = await import('child_process');
    const os = require('os');

    try {
      const script = `import zipfile, xml.etree.ElementTree as ET
z = zipfile.ZipFile(${JSON.stringify(filePath)})

shared = []
try:
    sst = ET.parse(z.open('xl/sharedStrings.xml'))
    for si in sst.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        parts = []
        for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            if t.text: parts.append(t.text)
        shared.append(''.join(parts))
except: pass

wb = ET.parse(z.open('xl/workbook.xml'))
sheets = [(s.get('name'), f'xl/worksheets/sheet{s.get("sheetId")}.xml') for s in wb.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')]

for name, spath in sheets:
    ws = ET.parse(z.open(spath))
    rows = []
    for row in ws.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
        cells = []
        for c in row:
            v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            t = c.get('t', '')
            val = v.text if v is not None else ''
            if t == 's' and val: val = shared[int(val)] if int(val) < len(shared) else val
            cells.append(val)
        if cells: rows.append('\\t'.join(cells))
    print(f'\\n=== Sheet: {name} ===')
    print('\\n'.join(rows))`;
      const tmpScript = path.join(os.tmpdir(), `zavorth_xlsx_${Date.now()}.py`);
      fs.writeFileSync(tmpScript, script);
      try {
        const text = execFileSync('python3', [tmpScript], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).toString();
        return {
          ...base,
          success: true,
          extracted_text: text.trim(),
          metadata: { tool: 'python-xlsx-parse' },
        };
      } finally {
        try { fs.unlinkSync(tmpScript); } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] file cleanup failed', error); }
      }
    } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] file cleanup failed', error);
    return { ...base, error: `Error extracting XLSX: ${error instanceof Error ? error.message : String(error)}` };
  }
  }

  private async extractPptx(
    filePath: string,
    base: ExtractionResult,
    _options: unknown,
  ): Promise<ExtractionResult> {
    const { execFileSync } = await import('child_process');
    const os = require('os');

    try {
      const script = `import zipfile, xml.etree.ElementTree as ET
z = zipfile.ZipFile(${JSON.stringify(filePath)})
slides = sorted([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')])
for i, slide_path in enumerate(slides, 1):
    tree = ET.parse(z.open(slide_path))
    texts = [t.text for t in tree.iter() if t.text and t.text.strip()]
    print(f'\\n=== Slide {i} ===')
    print('\\n'.join(texts))`;
      const tmpScript = path.join(os.tmpdir(), `zavorth_pptx_${Date.now()}.py`);
      fs.writeFileSync(tmpScript, script);
      try {
        const text = execFileSync('python3', [tmpScript], { timeout: 30000 }).toString();
        return {
          ...base,
          success: true,
          extracted_text: text.trim(),
          metadata: { tool: 'python-pptx-parse' },
        };
      } finally {
        try { fs.unlinkSync(tmpScript); } catch (error: unknown) { /* ignore */ logger.warn('[Zavorth Document Extractor] file cleanup failed', error); }
      }
    } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] file cleanup failed', error);
    return { ...base, error: `Error extracting PPTX: ${error instanceof Error ? error.message : String(error)}` };
  }
  }

  private extractCsv(filePath: string, base: ExtractionResult, ext: string): ExtractionResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const lines = content.split('\n').filter((l) => l.trim());

    const rows: string[][] = [];
    for (const line of lines) {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      rows.push(cells);
    }

    const text = rows.map((r) => r.join('\t')).join('\n');

    return {
      ...base,
      success: true,
      extracted_text: text,
      tables: rows,
      metadata: { tool: 'csv-parser', delimiter, rows: rows.length, columns: rows[0]?.length || 0 },
    };
  }

  private extractHtml(filePath: string, base: ExtractionResult): ExtractionResult {
    const content = fs.readFileSync(filePath, 'utf-8');

    const text = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return {
      ...base,
      success: true,
      extracted_text: text,
      metadata: { tool: 'html-parser' },
    };
  }

  private extractJson(filePath: string, base: ExtractionResult): ExtractionResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const parsed = JSON.parse(content);
      const text = JSON.stringify(parsed, null, 2);
      return {
        ...base,
        success: true,
        extracted_text: text,
        metadata: { tool: 'json-parser', keys: typeof parsed === 'object' ? Object.keys(parsed).length : 0 },
      };
    } catch (error: unknown) {
    logger.warn('[Zavorth Document Extractor] JSON parse failed', error);
    return { ...base, success: true, extracted_text: content, metadata: { tool: 'raw-read' } };
  }
  }

  private extractXml(filePath: string, base: ExtractionResult): ExtractionResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const text = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      ...base,
      success: true,
      extracted_text: text,
      metadata: { tool: 'xml-text-extract' },
    };
  }

  private extractPlainText(filePath: string, base: ExtractionResult): ExtractionResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      ...base,
      success: true,
      extracted_text: content,
      metadata: { tool: 'plain-read' },
    };
  }

  private sanitizePath(msg: string): string {
    return msg.replace(/(?:[A-Z]:)?[\\\/][^\s]*[\\\/]/g, '[path]/');
  }

  private parseTablesFromText(text: string): string[][] {
    const lines = text.split('\n').filter((l) => l.trim());
    const tables: string[][] = [];

    for (const line of lines) {
      const cells = line.split(/\s{2,}/u).map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        tables.push(cells);
      }
    }

    return tables;
  }

  private formatResult(result: ExtractionResult, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);

      case 'markdown': {
        const lines: string[] = [`# Extraction: ${path.basename(result.file_path)}`];
        lines.push(`- **Tipo**: ${result.file_type}`);
        lines.push(`- **Size**: ${(result.file_size / 1024).toFixed(1)} KB`);
        if (result.page_count) lines.push(`- **Paginas**: ${result.page_count}`);
        lines.push('');
        lines.push('## Extracted Text');
        lines.push(result.extracted_text);
        if (result.tables && result.tables.length > 0) {
          lines.push('');
          lines.push('## Tabelas');
          for (const table of result.tables) {
            lines.push('| ' + table.join(' | ') + ' |');
          }
        }
        return lines.join('\n');
      }

      case 'html': {
        const htmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const lines: string[] = ['<div class="document-extraction">'];
        lines.push(`<h2>${htmlEscape(path.basename(result.file_path))}</h2>`);
        lines.push(`<pre>${htmlEscape(result.extracted_text)}</pre>`);
        lines.push('</div>');
        return lines.join('\n');
      }

      case 'text':
      default: {
        const lines: string[] = [`Document: ${path.basename(result.file_path)}`];
        lines.push(`Type: ${result.file_type} | Size: ${(result.file_size / 1024).toFixed(1)} KB`);
        if (result.page_count) lines.push(`Paginas: ${result.page_count}`);
        lines.push('---');
        lines.push(result.extracted_text);
        return lines.join('\n');
      }
    }
  }
}
