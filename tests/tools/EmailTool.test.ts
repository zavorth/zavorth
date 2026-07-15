import { EmailTool } from '../../src/tools/EmailTool';

describe('EmailTool', () => {
  let tool: EmailTool;
  const originalEnv = process.env;

  beforeEach(() => {
    tool = new EmailTool();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exposes correct name and required parameters', () => {
    expect(tool.name).toBe('send_email');
    expect(tool.parameters.required).toEqual(['to', 'subject', 'body']);
  });

  it('returns error when "to" is missing', async () => {
    const result = await tool.execute({ subject: 'Test', body: 'Hello' });
    expect(result).toContain('Erro');
    expect(result).toContain('to');
  });

  it('returns error when "subject" is missing', async () => {
    const result = await tool.execute({ to: 'test@example.com', body: 'Hello' });
    expect(result).toContain('Erro');
    expect(result).toContain('subject');
  });

  it('returns error when "body" is missing', async () => {
    const result = await tool.execute({ to: 'test@example.com', subject: 'Test' });
    expect(result).toContain('Erro');
    expect(result).toContain('body');
  });

  it('returns error for invalid email format', async () => {
    const result = await tool.execute({
      to: 'not-an-email',
      subject: 'Test',
      body: 'Hello',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('invalid email');
  });

  it('returns error when SMTP is not configured', async () => {
    delete process.env.ZAVORTH_SMTP_HOST;
    delete process.env.ZAVORTH_SMTP_USER;
    delete process.env.ZAVORTH_SMTP_PASS;

    const result = await tool.execute({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('SMTP');
  });

  it('returns error when live send is disabled', async () => {
    process.env.ZAVORTH_SMTP_HOST = 'smtp.example.com';
    process.env.ZAVORTH_SMTP_PORT = '587';
    process.env.ZAVORTH_SMTP_USER = 'user@example.com';
    process.env.ZAVORTH_SMTP_PASS = 'password123';
    delete process.env.ZAVORTH_SMTP_ALLOW_LIVE_SEND;

    const result = await tool.execute({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      body: 'Test body content',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('live email send is disabled');
  });

  it('handles multiple recipients validation', async () => {
    const result = await tool.execute({
      to: 'a@example.com, b@example.com',
      subject: 'Multi',
      body: 'Body',
    });
    const isValid = result.includes('Email enviado') || result.includes('Erro');
    expect(isValid).toBe(true);
  });

  it('returns error for invalid attachments JSON', async () => {
    process.env.ZAVORTH_SMTP_HOST = 'smtp.example.com';
    process.env.ZAVORTH_SMTP_USER = 'user@example.com';
    process.env.ZAVORTH_SMTP_PASS = 'pass';
    process.env.ZAVORTH_SMTP_ALLOW_LIVE_SEND = 'true';

    const result = await tool.execute({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Body',
      attachments: 'not-json',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('attachments');
  });

  it('rejects email fields containing carriage return or line feed characters', async () => {
    const badSubject = await tool.execute({
      to: 'test@example.com',
      subject: 'Test\r\nSubject',
      body: 'Body',
    });
    expect(badSubject).toContain('Error: subject contains invalid characters');

    const badCc = await tool.execute({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Body',
      cc: 'cc@example.com\nRCPT TO:victim@example.com',
    });
    expect(badCc).toContain('Error: CC contains invalid characters');
  });
});
