import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthReceiptSearchTool } from '../../src/tools/ZavorthReceiptSearchTool';

describe('ZavorthReceiptSearchTool', () => {
  let tool: ZavorthReceiptSearchTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-test-'));

    const receipt1 = {
      id: 'receipt_001',
      timestamp: '2025-06-01T10:00:00Z',
      action: 'execute',
      tool: 'web_search',
      args: { query: 'TypeScript' },
      result_summary: 'Found 10 results about TypeScript',
      success: true,
      risk_level: 'low',
      approval_status: 'auto_approved',
      session_id: 'session_1',
      user: 'ermys',
      channel: 'cli',
      duration_ms: 250,
      metadata: {},
    };

    const receipt2 = {
      id: 'receipt_002',
      timestamp: '2025-06-02T14:00:00Z',
      action: 'send',
      tool: 'send_email',
      args: { to: 'test@example.com' },
      result_summary: 'Email sent successfully',
      success: true,
      risk_level: 'high',
      approval_status: 'approved',
      session_id: 'session_1',
      user: 'ermys',
      channel: 'telegram',
      duration_ms: 1500,
      metadata: {},
    };

    fs.writeFileSync(path.join(tempDir, 'receipts.json'), JSON.stringify([receipt1, receipt2]));
    tool = new ZavorthReceiptSearchTool({ receiptsDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_receipt_search');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('searches receipts by query', async () => {
    const result = await tool.execute({ action: 'search', query: 'TypeScript' });
    expect(result).toContain('receipt_001');
    expect(result).toContain('web_search');
  });

  it('searches receipts by tool', async () => {
    const result = await tool.execute({ action: 'search', tool: 'send_email' });
    expect(result).toContain('receipt_002');
  });

  it('searches receipts by risk level', async () => {
    const result = await tool.execute({ action: 'search', risk_level: 'high' });
    expect(result).toContain('receipt_002');
  });

  it('gets a specific receipt', async () => {
    const result = await tool.execute({ action: 'get', receipt_id: 'receipt_001' });
    expect(result).toContain('receipt_001');
    expect(result).toContain('web_search');
    expect(result).toContain('low');
  });

  it('returns error for non-existent receipt', async () => {
    const result = await tool.execute({ action: 'get', receipt_id: 'nonexistent' });
    expect(result).toContain('Erro');
    expect(result).toContain('nao encontrado');
  });

  it('gets stats', async () => {
    const result = await tool.execute({ action: 'stats' });
    expect(result).toContain('Estatisticas');
    expect(result).toContain('2');
  });

  it('lists tools', async () => {
    const result = await tool.execute({ action: 'list_tools' });
    expect(result).toContain('web_search');
    expect(result).toContain('send_email');
  });

  it('lists sessions', async () => {
    const result = await tool.execute({ action: 'list_sessions' });
    expect(result).toContain('session_1');
  });

  it('verifies a receipt', async () => {
    const result = await tool.execute({ action: 'verify', receipt_id: 'receipt_001' });
    expect(result).toContain('Verificacao');
    expect(result).toContain('valido');
  });

  it('exports receipts as JSON', async () => {
    const result = await tool.execute({ action: 'export', export_format: 'json' });
    expect(result).toContain('receipt_001');
    expect(result).toContain('receipt_002');
  });

  it('exports receipts as CSV', async () => {
    const result = await tool.execute({ action: 'export', export_format: 'csv' });
    expect(result).toContain('id,timestamp');
  });

  it('exports receipts as markdown', async () => {
    const result = await tool.execute({ action: 'export', export_format: 'markdown' });
    expect(result).toContain('Receipts Export');
  });
});
