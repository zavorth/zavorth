import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthDocumentExtractorTool } from '../../src/tools/ZavorthDocumentExtractorTool';

describe('ZavorthDocumentExtractorTool', () => {
  let tool: ZavorthDocumentExtractorTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docextract-'));
    tool = new ZavorthDocumentExtractorTool();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_document_extractor');
  });

  it('returns error when file_path is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('file_path');
  });

  it('returns error for non-existent file', async () => {
    const result = await tool.execute({ file_path: '/nonexistent/file.pdf' });
    expect(result).toContain('Erro');
    expect(result).toContain('nao encontrado');
  });

  it('extracts plain text files', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'Hello World\nLine 2\nLine 3');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Hello World');
    expect(result).toContain('Line 2');
  });

  it('extracts markdown files', async () => {
    const filePath = path.join(tempDir, 'test.md');
    fs.writeFileSync(filePath, '# Title\n\nSome content here.');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Title');
    expect(result).toContain('content');
  });

  it('extracts JSON files', async () => {
    const filePath = path.join(tempDir, 'test.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'Zavorth', version: 2 }));
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Zavorth');
    expect(result).toContain('version');
  });

  it('extracts CSV files', async () => {
    const filePath = path.join(tempDir, 'test.csv');
    fs.writeFileSync(filePath, 'name,age,city\nAlice,30,SP\nBob,25,RJ');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('30');
  });

  it('extracts HTML files', async () => {
    const filePath = path.join(tempDir, 'test.html');
    fs.writeFileSync(filePath, '<html><body><h1>Title</h1><p>Content</p></body></html>');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Title');
    expect(result).toContain('Content');
  });

  it('extracts XML files', async () => {
    const filePath = path.join(tempDir, 'test.xml');
    fs.writeFileSync(filePath, '<root><item>Value</item></root>');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Value');
  });

  it('extracts YAML files', async () => {
    const filePath = path.join(tempDir, 'test.yaml');
    fs.writeFileSync(filePath, 'name: Zavorth\nversion: 2\nfeatures:\n  - tools\n  - skills');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Zavorth');
  });

  it('returns error for unsupported format', async () => {
    const filePath = path.join(tempDir, 'test.xyz');
    fs.writeFileSync(filePath, 'data');
    const result = await tool.execute({ file_path: filePath });
    expect(result).toContain('Erro');
    expect(result).toContain('nao suportado');
  });

  it('saves output to file when output_path is provided', async () => {
    const filePath = path.join(tempDir, 'input.txt');
    const outputPath = path.join(tempDir, 'output.txt');
    fs.writeFileSync(filePath, 'Test content');
    const result = await tool.execute({ file_path: filePath, output_path: outputPath });
    expect(result).toContain('salvo');
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('truncates output when max_chars is set', async () => {
    const filePath = path.join(tempDir, 'long.txt');
    fs.writeFileSync(filePath, 'A'.repeat(1000));
    const result = await tool.execute({ file_path: filePath, max_chars: 50 });
    expect(result.length).toBeLessThan(200);
  });
});
