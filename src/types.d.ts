declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
  }

  interface SqlJsDatabase {
    run(sql: string, params?: any[]): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    get(params?: any[]): any[];
    getColumnNames(): string[];
    free(): boolean;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export type Database = SqlJsDatabase;

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}

declare module 'msedge-tts' {
  export class MsEdgeTTS {
    setMetadata(voice: string, outputFormat: string): Promise<void>;
    toStream(text: string): any;
  }
}

declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfData>;
  export default pdfParse;
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}
