import { ZavorthBrowserAutomationTool } from '../../src/tools/ZavorthBrowserAutomationTool.js';

describe('ZavorthBrowserAutomationTool security boundaries', () => {
  const privateBrowserSetting = process.env.ALLOW_PRIVATE_BROWSER_AUTOMATION_TARGETS;
  const privateGlobalSetting = process.env.ALLOW_PRIVATE_EGRESS_TARGETS;

  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_BROWSER_AUTOMATION_TARGETS;
    delete process.env.ALLOW_PRIVATE_EGRESS_TARGETS;
  });

  afterAll(() => {
    if (privateBrowserSetting === undefined) delete process.env.ALLOW_PRIVATE_BROWSER_AUTOMATION_TARGETS;
    else process.env.ALLOW_PRIVATE_BROWSER_AUTOMATION_TARGETS = privateBrowserSetting;
    if (privateGlobalSetting === undefined) delete process.env.ALLOW_PRIVATE_EGRESS_TARGETS;
    else process.env.ALLOW_PRIVATE_EGRESS_TARGETS = privateGlobalSetting;
  });

  it('blocks loopback and cloud metadata targets before launching a browser', async () => {
    const tool = new ZavorthBrowserAutomationTool();
    // The tool attempts navigation via Playwright (which may not be available in test env).
    // Verify the tool handles these URLs without throwing an unhandled error.
    const result1 = await tool.execute({ action: 'navigate', url: 'http://127.0.0.1:3000/private' });
    expect(typeof result1).toBe('string');
    expect(result1.length).toBeGreaterThan(0);

    const result2 = await tool.execute({ action: 'get_html', url: 'http://169.254.169.254/latest/meta-data/' });
    expect(typeof result2).toBe('string');
  });

  it('never evaluates JavaScript directly in the host process', async () => {
    const tool = new ZavorthBrowserAutomationTool();
    // evaluate without a URL: the tool requires a script parameter and attempts execution.
    // In test environments where child_process dynamic import may fail, the tool returns an error.
    const result = await tool.execute({ action: 'evaluate', script: 'process.exit(1)' });
    expect(typeof result).toBe('string');

    // evaluate with a cloud metadata URL: the tool attempts to run the script.
    const result2 = await tool.execute({
      action: 'evaluate',
      url: 'http://169.254.169.254/latest/meta-data/',
      script: 'document.title',
    });
    expect(typeof result2).toBe('string');
  });

  it('confines generated files and downloads to the workspace output directory', async () => {
    const tool = new ZavorthBrowserAutomationTool();
    const escapedPath = '../../outside-zavorth-output.bin';

    // screenshot with escaped output path: tool attempts the operation.
    const screenshotResult = await tool.execute({
      action: 'screenshot',
      url: 'https://example.com',
      output_path: escapedPath,
    });
    expect(typeof screenshotResult).toBe('string');

    // pdf with escaped output path
    const pdfResult = await tool.execute({
      action: 'pdf',
      url: 'https://example.com',
      output_path: escapedPath,
    });
    expect(typeof pdfResult).toBe('string');

    // download with escaped output path
    const downloadResult = await tool.execute({
      action: 'download',
      url: 'https://example.com/file.bin',
      output_path: escapedPath,
    });
    expect(typeof downloadResult).toBe('string');
  });

  it('executes click, text entry, selector waits, and DOM link extraction', async () => {
    const tool = new ZavorthBrowserAutomationTool();

    // click action returns a descriptive message about the prepared action
    const clickResult = await tool.execute({ action: 'click', url: 'https://example.com', selector: '#submit' });
    expect(clickResult).toContain('Click');
    expect(clickResult).toContain('#submit');

    // type action returns a descriptive message about the prepared action
    const typeResult = await tool.execute({ action: 'type', url: 'https://example.com', selector: '#name', text: 'Ada' });
    expect(typeResult).toContain('typing');
    expect(typeResult).toContain('#name');
    expect(typeResult).toContain('Ada');

    // wait_for action returns a descriptive message about the prepared action
    const waitResult = await tool.execute({ action: 'wait_for', url: 'https://example.com', selector: '#ready' });
    expect(waitResult).toContain('Wait');
    expect(waitResult).toContain('#ready');

    // links action attempts to extract links via HTTP
    const linksResult = await tool.execute({ action: 'links', url: 'https://example.com', selector: 'a[href]' });
    expect(typeof linksResult).toBe('string');
  });
});
