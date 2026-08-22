import crypto from 'node:crypto';
import type {
  DocumentExtractionArtifact,
  DocumentExtractionReceipt,
} from '../../contracts/SourceMemoryDocumentTerminalPackContract.js';

type Runtime = {
  now?: () => Date;
};

export class PdfExtractionAdapter {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public extract(input: {
    bytes: Buffer;
    sourceName?: string;
    mimeType?: string;
  }): { artifact: DocumentExtractionArtifact; receipt: DocumentExtractionReceipt } {
    const sourceName = input.sourceName || 'document.pdf';
    const mimeType = input.mimeType || 'application/pdf';
    const extracted = extractPdfText(input.bytes);
    const artifactId = `credential-vault.document.pdf.${hashId(`${sourceName}:${extracted.text}`)}`;
    const receiptId = `${artifactId}.receipt`;
    const producedAt = this.now().toISOString();
    const artifact: DocumentExtractionArtifact = {
      id: artifactId,
      kind: 'pdf',
      sourceName,
      mimeType,
      title: extracted.title,
      text: extracted.text,
      excerpt: extracted.text.slice(0, 500),
      metadata: {
        parser: extracted.parser,
        pdfHeaderDetected: extracted.pdfHeaderDetected,
        stringObjects: extracted.stringObjects,
        bytes: input.bytes.length,
      },
      producedAt,
      receiptId,
      secretValuesSerialized: false,
    };
    const receipt: DocumentExtractionReceipt = {
      id: receiptId,
      status: artifact.text.trim() ? 'artifact-created' : 'failed',
      kind: 'pdf',
      artifactId: artifact.text.trim() ? artifact.id : null,
      parser: extracted.parser,
      bytes: input.bytes.length,
      artifactFirst: true,
      replayable: true,
      liveIoPerformed: false,
      secretValuesSerialized: false,
      reason: artifact.text.trim() ? 'PDF text extracted into an artifact-first receipt.'
        : 'PDF parser could not extract readable text from the provided bytes.',
    };

    return { artifact, receipt };
  }
}

function extractPdfText(bytes: Buffer): {
  text: string;
  title: string | null;
  parser: string;
  pdfHeaderDetected: boolean;
  stringObjects: number;
} {
  const raw = bytes.toString('latin1');
  const pdfHeaderDetected = raw.startsWith('%PDF');
  const objectStrings = [...raw.matchAll(/\((?:\\.|[^\\)]){1,500}\)/g)]
    .map((match) => decodePdfString(match[0].slice(1, -1)))
    .map(cleanText)
    .filter((value) => /[a-z0-9]/i.test(value));
  const fallbackStrings = objectStrings.length > 0
    ? []
    : (raw.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:'"!...()/_-]{4,}/g) || [])
      .map(cleanText)
      .filter((value) => value.length > 3 && !value.startsWith('obj') && !value.startsWith('endobj'));
  const chunks = (objectStrings.length > 0 ? objectStrings : fallbackStrings)
    .filter((value, index, array) => array.indexOf(value) === index);
  const text = cleanText(chunks.join('\n'));
  return {
    text,
    title: chunks[0]?.slice(0, 120) || null,
    parser: 'fallback-pdf-text-scan',
    pdfHeaderDetected,
    stringObjects: objectStrings.length,
  };
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function cleanText(value: string): string {
  return String(value || '')
  // eslint-disable-next-line no-control-regex
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
