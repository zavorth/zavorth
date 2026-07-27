import { asErrorLike } from '../../../src/utils/errorLike';
export type ComposerAttachment = {
  name: string;
  type: string;
  size: number;
  text: string | null;
  content: string | null;
  truncated: boolean;
  extraction: {
    kind: 'text' | 'pdf' | 'docx' | 'xlsx' | 'image' | 'audio' | 'video' | 'unsupported' | 'error';
    label: string;
    detail: string;
  };
  media: {
    kind: 'image' | 'audio' | 'video';
    mimeType: string;
    encoding: 'base64';
  } | null;
};

const MAX_INLINE_ATTACHMENT_BYTES = 512 * 1024;
const MAX_INLINE_MEDIA_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 120_000;
const TEXT_ATTACHMENT_PATTERN = /\.(txt|md|json|jsonl|csv|tsv|log|ts|tsx|js|jsx|mjs|cjs|py|html|htm|css|scss|less|yml|yaml|toml|ini|sql|xml|svg|java|kt|go|rs|rb|php|cs|cpp|c|h|hpp|sh|ps1)$/i;
const TEXT_MIME_PATTERN = /^(text\/|application\/(json|xml|javascript|typescript|x-yaml|yaml))/i;
const PDF_PATTERN = /\.pdf$/i;
const DOCX_PATTERN = /\.docx$/i;
const XLSX_PATTERN = /\.xlsx$/i;
const IMAGE_MIME_PATTERN = /^image\//i;
const AUDIO_MIME_PATTERN = /^audio\//i;
const VIDEO_MIME_PATTERN = /^video\//i;

type ZipLike = {
  file: (path: string | RegExp) => any;
};

export async function readAttachmentFile(file: File): Promise<ComposerAttachment> {
  const textLike = TEXT_MIME_PATTERN.test(file.type || '') || TEXT_ATTACHMENT_PATTERN.test(file.name || '');
  const attachment: ComposerAttachment = {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    text: null,
    content: null,
    truncated: false,
    extraction: {
      kind: 'unsupported',
      label: 'Attached',
      detail: 'File attached as metadata. Deep reading is not available for this type yet.',
    },
    media: null,
  };

  try {
    if (textLike && file.size <= MAX_INLINE_ATTACHMENT_BYTES) {
      attachment.text = limitExtractedText(await file.text(), attachment);
      attachment.extraction = {
        kind: 'text',
        label: 'Text extracted',
        detail: 'Readable text was attached to the request.',
      };
    } else if (textLike && file.size > MAX_INLINE_ATTACHMENT_BYTES) {
      attachment.text = limitExtractedText(await file.slice(0, MAX_INLINE_ATTACHMENT_BYTES).text(), attachment);
      attachment.truncated = true;
      attachment.extraction = {
        kind: 'text',
        label: 'Text preview extracted',
        detail: 'Large text file was truncated before sending.',
      };
    } else if (PDF_PATTERN.test(file.name) || /pdf/i.test(file.type || '')) {
      attachment.text = limitExtractedText(await extractPdfText(file), attachment);
      attachment.extraction = {
        kind: 'pdf',
        label: attachment.text ? 'PDF text extracted' : 'PDF attached',
        detail: attachment.text ? 'Readable PDF text was attached to the request.' : 'No readable text was found in the PDF.',
      };
    } else if (DOCX_PATTERN.test(file.name)) {
      attachment.text = limitExtractedText(await extractDocxText(file), attachment);
      attachment.extraction = {
        kind: 'docx',
        label: attachment.text ? 'DOCX text extracted' : 'DOCX attached',
        detail: attachment.text ? 'Document text was attached to the request.' : 'No readable text was found in the document.',
      };
    } else if (XLSX_PATTERN.test(file.name)) {
      attachment.text = limitExtractedText(await extractXlsxText(file), attachment);
      attachment.extraction = {
        kind: 'xlsx',
        label: attachment.text ? 'Spreadsheet text extracted' : 'Spreadsheet attached',
        detail: attachment.text ? 'Workbook cells were attached as readable text.' : 'No readable cells were found in the workbook.',
      };
    } else if (IMAGE_MIME_PATTERN.test(file.type || '')) {
      await attachInlineMedia(file, attachment, 'image');
    } else if (AUDIO_MIME_PATTERN.test(file.type || '')) {
      await attachInlineMedia(file, attachment, 'audio');
    } else if (VIDEO_MIME_PATTERN.test(file.type || '')) {
      await attachInlineMedia(file, attachment, 'video');
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    attachment.text = null;
    attachment.content = null;
    attachment.media = null;
    attachment.truncated = false;
    attachment.extraction = {
      kind: 'error',
      label: 'Extraction failed',
      detail: error instanceof Error ? err.message : 'The file could not be read in the browser.',
    };
  }

  return attachment;
}

async function attachInlineMedia(
  file: File,
  attachment: ComposerAttachment,
  kind: 'image' | 'audio' | 'video',
): Promise<void> {
  if (file.size > MAX_INLINE_MEDIA_BYTES) {
    attachment.extraction = {
      kind,
      label: `${kind === 'image' ? 'Image' : kind === 'audio' ? 'Audio' : 'Video'} too large`,
      detail: `Media payload was not embedded because it is larger than ${formatMegabytes(MAX_INLINE_MEDIA_BYTES)}.`,
    };
    return;
  }

  const dataUrl = await fileToDataUrl(file);
  const content = extractBase64FromDataUrl(dataUrl);
  if (!content) {
    throw new Error('The browser could not encode this media file.');
  }

  const mimeType = file.type || (kind === 'image' ? 'image/png' : kind === 'audio' ? 'audio/wav' : 'video/mp4');
  attachment.content = content;
  attachment.media = {
    kind,
    mimeType,
    encoding: 'base64',
  };
  attachment.extraction = {
    kind,
    label: kind === 'image' ? 'Image ready' : kind === 'audio' ? 'Audio ready' : 'Video ready',
    detail: kind === 'image'
      ? 'Image payload will be sent for visual understanding/OCR.'
      : kind === 'audio'
        ? 'Audio payload will be sent for transcription/understanding.'
        : 'Video payload will be sent for visual and timeline understanding.',
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed.'));
    reader.readAsDataURL(file);
  });
}

function extractBase64FromDataUrl(value: string): string | null {
  const match = /^data:[^;,]+;base64,(.+)$/i.exec(String(value || ''));
  return match?.[1] || null;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function limitExtractedText(value: string, attachment: ComposerAttachment): string | null {
  const normalized = String(value || '').replace(/\u0000/g, '').trim();
  if (!normalized) return null;
  if (normalized.length <= MAX_EXTRACTED_TEXT_CHARS) return normalized;
  attachment.truncated = true;
  return `${normalized.slice(0, MAX_EXTRACTED_TEXT_CHARS).trimEnd()}\n\n[Attachment preview truncated: ${normalized.length - MAX_EXTRACTED_TEXT_CHARS} characters omitted]`;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true, useWorkerFetch: false, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages || 0, 30);
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => String(item?.str || '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(`Page ${pageNumber}\n${text}`);
  }
  const suffix = pdf.numPages > maxPages ? `\n\n[PDF preview truncated: ${pdf.numPages ? maxPages} pages omitted]` : '';
  return pages.join('\n\n') + suffix;
}

async function extractDocxText(file: File): Promise<string> {
  const zip = await loadZip(file);
  const documentXml = await readZipText(zip, 'word/document.xml');
  const paragraphs = documentXml
    .split(/<\/w:p>/g)
    .map((paragraph) => extractXmlText(paragraph))
    .filter(Boolean);
  return paragraphs.join('\n');
}

async function extractXlsxText(file: File): Promise<string> {
  const zip = await loadZip(file);
  const sharedStringsXml = await readZipText(zip, 'xl/sharedStrings.xml').catch(() => '');
  const sharedStrings = sharedStringsXml
    ? Array.from(sharedStringsXml.matchAll(/<si[\s\S]*...<\/si>/g)).map((match) => extractXmlText(match[0]))
    : [];
  const workbookXml = await readZipText(zip, 'xl/workbook.xml').catch(() => '');
  const sheetNames = Array.from(workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)).map((match) => decodeXml(match[1]));
  const sheetFiles = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/) || [];
  const sheets: string[] = [];
  for (let index = 0; index < Math.min(sheetFiles.length, 12); index += 1) {
    const sheetFile = sheetFiles[index];
    const xml = await sheetFile.async('text');
    const rows = Array.from(xml.matchAll(/<row\b[\s\S]*...<\/row>/g)).slice(0, 120);
    const lines = rows.map((rowMatch) => {
      const cells = Array.from(rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*...)<\/c>/g)).map((cellMatch) => {
        const attrs = cellMatch[1] || '';
        const body = cellMatch[2] || '';
        const valueMatch = body.match(/<v[^>]*>([\s\S]*...)<\/v>/);
        const inlineMatch = body.match(/<is[\s\S]*...<\/is>/);
        if (inlineMatch) return extractXmlText(inlineMatch[0]);
        if (!valueMatch) return '';
        const raw = decodeXml(valueMatch[1]);
        if (/\bt="s"/.test(attrs)) return sharedStrings[Number(raw)] || raw;
        return raw;
      }).filter((cell) => cell !== '');
      return cells.join('\t');
    }).filter(Boolean);
    if (lines.length > 0) {
      sheets.push(`Sheet: ${sheetNames[index] || `Sheet ${index + 1}`}\n${lines.join('\n')}`);
    }
  }
  return sheets.join('\n\n');
}

async function loadZip(file: File): Promise<ZipLike> {
  const module = await import('jszip');
  const JSZip = module.default || module;
  return JSZip.loadAsync(await file.arrayBuffer());
}

async function readZipText(zip: ZipLike, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`${path} not found`);
  return entry.async('text');
}

function extractXmlText(xml: string): string {
  return Array.from(String(xml || '').matchAll(/<[^:/\s>]+:t\b[^>]*>([\s\S]*...)<\/[^:/\s>]+:t>|<t\b[^>]*>([\s\S]*...)<\/t>/g))
    .map((match) => decodeXml(match[1] || match[2] || ''))
    .join('')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function decodeXml(value: string): string {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&after;/g, "'")
    .replace(/&amp;/g, '&');
}

export function attachmentKindLabel(file: Partial<ComposerAttachment> | null | undefined) {
  const name = String(file?.name || '');
  const extension = name.includes('.') ? name.split('.').pop()?.slice(0, 5).toUpperCase() : '';
  if (extension) return extension;

  const type = String(file?.type || '');
  if (type.startsWith('text/')) return 'TXT';
  if (type.startsWith('image/')) return 'IMG';
  if (type.startsWith('audio/')) return 'AUD';
  if (type.includes('pdf')) return 'PDF';
  return 'FILE';
}

export function attachmentReadyLabel(count: number) {
  return count === 1 ? '1 file ready' : `${count} files ready`;
}
