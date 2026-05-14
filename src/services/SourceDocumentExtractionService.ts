import type {
  DocumentExtractionArtifact,
  DocumentExtractionReceipt,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import { PdfExtractionAdapter } from '../adapters/documents/PdfExtractionAdapter.js';
import { ReadabilityExtractionAdapter } from '../adapters/documents/ReadabilityExtractionAdapter.js';

type Runtime = {
  now?: () => Date;
  pdfAdapter?: PdfExtractionAdapter;
  readabilityAdapter?: ReadabilityExtractionAdapter;
};

export class SourceDocumentExtractionService {
  private readonly pdfAdapter: PdfExtractionAdapter;
  private readonly readabilityAdapter: ReadabilityExtractionAdapter;

  constructor(runtime: Runtime = {}) {
    this.pdfAdapter = runtime.pdfAdapter || new PdfExtractionAdapter({
      now: runtime.now,
    });
    this.readabilityAdapter = runtime.readabilityAdapter || new ReadabilityExtractionAdapter({
      now: runtime.now,
    });
  }

  public extractPdf(input: {
    bytes: Buffer;
    sourceName?: string;
    mimeType?: string;
  }): { artifact: DocumentExtractionArtifact; receipt: DocumentExtractionReceipt } {
    return this.pdfAdapter.extract(input);
  }

  public extractHtml(input: {
    html: string;
    sourceName?: string;
    mimeType?: string;
    url?: string | null;
  }): { artifact: DocumentExtractionArtifact; receipt: DocumentExtractionReceipt } {
    return this.readabilityAdapter.extract(input);
  }

  public runSmoke(): {
    artifacts: DocumentExtractionArtifact[];
    receipts: DocumentExtractionReceipt[];
  } {
    const pdf = this.extractPdf({
      sourceName: 'phase5-source-memory-document-terminal.pdf',
      bytes: Buffer.from([
        '%PDF-1.7',
        '1 0 obj',
        '<< /Type /Page >>',
        'stream',
        'BT (Phase 5 PDF extraction smoke artifact) Tj ET',
        'endstream',
        'endobj',
        '%%EOF',
      ].join('\n'), 'latin1'),
    });
    const html = this.extractHtml({
      sourceName: 'phase5-source-memory-document-terminal.html',
      url: 'https://example.invalid/phase5',
      html: [
        '<!doctype html>',
        '<html>',
        '<head><title>Phase 5 HTML extraction smoke</title></head>',
        '<body>',
        '<nav>Skip navigation</nav>',
        '<article><h1>Phase 5 HTML extraction smoke</h1>',
        '<p>Readability extraction creates an artifact-first receipt for Zavorth.</p></article>',
        '</body>',
        '</html>',
      ].join(''),
    });

    return {
      artifacts: [pdf.artifact, html.artifact],
      receipts: [pdf.receipt, html.receipt],
    };
  }
}
