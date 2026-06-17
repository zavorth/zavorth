import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ZavorthActionCatalog, ZavorthActionGateway } from '../../../src/runtime/actions';
import { SearchQueryService } from '../../../src/services/SearchQueryService';
import { safeFetch } from '../../../src/security/SafeFetchService';
import { assertPublicHttpTargetAllowed } from '../../../src/ai-gateway/lib/security/egressGuard';
import { MinimalBrowserSidecarClient } from '../../../src/core/MinimalBrowserSidecarClient';

jest.mock('../../../src/services/SearchQueryService');
jest.mock('../../../src/security/SafeFetchService');
jest.mock('../../../src/ai-gateway/lib/security/egressGuard');
jest.mock('../../../src/core/MinimalBrowserSidecarClient');

describe('Web & Browser Actions Harness (Phase 23-A)', () => {
  const roots: string[] = [];
  const mockSearch = jest.fn();
  const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;
  const mockAssertAllowed = assertPublicHttpTargetAllowed as jest.MockedFunction<typeof assertPublicHttpTargetAllowed>;

  const mockNavigate = jest.fn();
  const mockScreenshot = jest.fn();
  const mockExtractText = jest.fn();
  const mockHealth = jest.fn();

  beforeAll(() => {
    SearchQueryService.prototype.search = mockSearch;
    MinimalBrowserSidecarClient.prototype.navigate = mockNavigate;
    MinimalBrowserSidecarClient.prototype.screenshot = mockScreenshot;
    MinimalBrowserSidecarClient.prototype.extractText = mockExtractText;
    MinimalBrowserSidecarClient.prototype.health = mockHealth;
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-actions-test-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'web-actions-test' }));
    return root;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockSearch.mockResolvedValue({
      ok: true,
      mode: 'deep',
      evidenceDomain: 'general',
      qualityGate: { status: 'passed', highSignalCount: 2, highSignalRequired: 1, hostDiversity: 2 },
      items: [
        {
          title: 'Test Web Search Result 1',
          url: 'https://example.com/1',
          providerEvidence: { snippet: 'test snippet 1' },
          snippet: 'test snippet 1',
        },
      ],
    });

    mockSafeFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html><body>Hello Web</body></html>',
    } as any);

    mockAssertAllowed.mockResolvedValue(new URL('https://example.com'));

    mockHealth.mockResolvedValue({ ok: true });
    mockNavigate.mockResolvedValue({ ok: true, url: 'https://example.com/navigated', title: 'Navigated Title' });
    mockScreenshot.mockResolvedValue({ ok: true, file: 'data/runtime/screenshot.png', bytes: 1024, base64: 'abcde' });
    mockExtractText.mockResolvedValue({ ok: true, text: 'extracted page body innerText content', truncated: false });
  });

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  // 1. web.search is registered in catalog and includes the web-browser module (Req 1, 35)
  it('registers web.search in catalog under web-browser module', () => {
    const catalog = new ZavorthActionCatalog();
    const actions = catalog.list();
    const actionIds = actions.map((a) => a.id);

    expect(actionIds).toContain('web.search');
    expect(actionIds).toContain('web.fetch_url');
    expect(actionIds).toContain('browser.open');
    expect(actionIds).toContain('browser.screenshot');
    expect(actionIds).toContain('browser.extract');

    const searchAction = actions.find((a) => a.id === 'web.search');
    expect(searchAction?.capabilityId).toBe('web-browser');
    expect(searchAction?.verificationStatus).toBe('verified');
  });

  // 2. web.search is safe and does not require preview/approval (Req 2)
  it('defines web.search as safe with no preview or approval requirements', () => {
    const catalog = new ZavorthActionCatalog();
    const searchAction = catalog.get('web.search')!;

    expect(searchAction.risk).toBe('safe');
    expect(searchAction.requiresPreview).toBe(false);
    expect(searchAction.requiresApproval).toBe(false);
    expect(searchAction.receiptPolicy).toBe('none');
  });

  // 3. web.search calls SearchQueryService with validated input (Req 3)
  it('calls SearchQueryService with validated arguments during apply', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const res = await gateway.apply('web.search', { query: 'Zavorth framework guide', mode: 'quick', limit: 3 });

    expect(res.ok).toBe(true);
    expect(res.status).toBe('applied');
    expect(res.summary).toContain('Found 1 results');
    expect(mockSearch).toHaveBeenCalledWith({
      query: 'Zavorth framework guide',
      mode: 'quick',
      limit: 3,
      evidenceDomain: 'auto',
      extractPages: undefined,
    });
    expect(res.data?.results).toEqual([
      { title: 'Test Web Search Result 1', url: 'https://example.com/1', snippet: 'test snippet 1' },
    ]);
  });

  it('rejects web.search with missing query', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const res = await gateway.apply('web.search', { query: '' });

    expect(res.ok).toBe(false);
    expect(res.status).toBe('blocked');
    expect(res.summary).toContain('Missing query');
  });

  // 4. web.fetch_url manifest checks (Req 4, 5)
  it('defines web.fetch_url as safe with no preview or approval requirements', () => {
    const catalog = new ZavorthActionCatalog();
    const fetchAction = catalog.get('web.fetch_url')!;

    expect(fetchAction.risk).toBe('safe');
    expect(fetchAction.requiresPreview).toBe(false);
    expect(fetchAction.requiresApproval).toBe(false);
  });

  // 5. web.fetch_url calls safeFetch and wraps response in untrusted_web_evidence (Req 6, 7)
  it('calls safeFetch and wraps response text with untrusted_web_evidence tag', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const res = await gateway.apply('web.fetch_url', { url: 'https://zavorth.internal/docs' });

    expect(res.ok).toBe(true);
    expect(res.status).toBe('applied');
    expect(mockAssertAllowed).toHaveBeenCalledWith('https://zavorth.internal/docs');
    expect(mockSafeFetch).toHaveBeenCalledWith('https://zavorth.internal/docs', expect.objectContaining({
      method: 'GET',
    }));
    expect(res.data?.content).toContain('<untrusted_web_evidence url="https://zavorth.internal/docs">');
    expect(res.data?.content).toContain('Hello Web');
    expect(res.data?.content).toContain('</untrusted_web_evidence>');
  });

  // 6. web.fetch_url blocks private/localhost/non-http targets (Req 8, 9)
  it('blocks private, loopback, or non-http targets for web.fetch_url', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    mockAssertAllowed.mockRejectedValueOnce(new Error('Target IP is private or loopback blocked.'));

    const res = await gateway.apply('web.fetch_url', { url: 'http://127.0.0.1:8080/info' });

    expect(res.ok).toBe(false);
    expect(res.status).toBe('blocked');
    expect(res.summary).toContain('Failed to fetch URL or target blocked');
  });

  it('rejects web.fetch_url with invalid schemes or empty URL', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const ftpRes = await gateway.apply('web.fetch_url', { url: 'ftp://example.com' });
    const emptyRes = await gateway.apply('web.fetch_url', { url: '' });

    expect(ftpRes.ok).toBe(false);
    expect(ftpRes.status).toBe('blocked');
    expect(ftpRes.summary).toContain('Invalid scheme');

    expect(emptyRes.ok).toBe(false);
    expect(emptyRes.status).toBe('blocked');
    expect(emptyRes.summary).toContain('Missing URL');
  });

  // 7. browser.open manifest details (Req 10, 11, 12, 13)
  it('defines browser.open as attention risk requiring preview, approval, and receipt', () => {
    const catalog = new ZavorthActionCatalog();
    const openAction = catalog.get('browser.open')!;

    expect(openAction.risk).toBe('attention');
    expect(openAction.requiresPreview).toBe(true);
    expect(openAction.requiresApproval).toBe(true);
    expect(openAction.receiptPolicy).toBe('required');
  });

  // 8. browser.open blocks private/localhost/non-http targets (Req 14)
  it('blocks private or loopback targets for browser.open', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    mockAssertAllowed.mockRejectedValueOnce(new Error('SSRF blocked.'));

    const res = await gateway.apply('browser.open', { url: 'http://localhost/admin' }, { trustedOperatorConfirmation: true });

    expect(res.ok).toBe(false);
    expect(res.status).toBe('blocked');
  });

  // 9. browser.open does not call sidecar during status or preview (Req 16, 17)
  it('does not invoke the sidecar client during browser.open status or preview operations', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const statusRes = await gateway.status('browser.open', { url: 'https://google.com' });
    const previewRes = await gateway.preview('browser.open', { url: 'https://google.com' });

    expect(statusRes.ok).toBe(true);
    expect(previewRes.ok).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockHealth).not.toHaveBeenCalled();
  });

  // 10. browser.open calls client only in apply after approved receipt (Req 15, 18)
  it('calls MinimalBrowserSidecarClient only during apply with confirmation', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const res = await gateway.apply('browser.open', { url: 'https://google.com' }, { trustedOperatorConfirmation: true });

    expect(res.ok).toBe(true);
    expect(res.status).toBe('applied');
    expect(mockHealth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('https://google.com', { waitUntil: undefined });
  });

  // 11. browser.open fails closed if sidecar unavailable (Req 19)
  it('fails closed during browser.open if the browser sidecar is offline', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    mockHealth.mockResolvedValueOnce({ ok: false });

    const res = await gateway.apply('browser.open', { url: 'https://google.com' }, { trustedOperatorConfirmation: true });

    expect(res.ok).toBe(false);
    expect(res.status).toBe('blocked');
    expect(res.summary).toContain('offline or unreachable');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // 12. browser.screenshot metadata and lifecycle (Req 20, 21, 22, 23, 24)
  it('defines browser.screenshot as attention risk requiring preview, approval, and receipt, and fails closed when offline', async () => {
    const catalog = new ZavorthActionCatalog();
    const ssAction = catalog.get('browser.screenshot')!;

    expect(ssAction.risk).toBe('attention');
    expect(ssAction.requiresPreview).toBe(true);
    expect(ssAction.requiresApproval).toBe(true);
    expect(ssAction.receiptPolicy).toBe('required');

    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const previewRes = await gateway.preview('browser.screenshot');
    expect(previewRes.ok).toBe(true);
    expect(mockScreenshot).not.toHaveBeenCalled();

    const appliedRes = await gateway.apply('browser.screenshot', { viewportOnly: true }, { trustedOperatorConfirmation: true });
    expect(appliedRes.ok).toBe(true);
    expect(appliedRes.status).toBe('applied');
    expect(mockScreenshot).toHaveBeenCalledWith({ fullPage: false, base64: true });
    expect(appliedRes.data?.screenshot?.base64).toBe('abcde');

    // Fail closed test
    mockHealth.mockResolvedValueOnce({ ok: false });
    const offlineRes = await gateway.apply('browser.screenshot', {}, { trustedOperatorConfirmation: true });
    expect(offlineRes.ok).toBe(false);
    expect(offlineRes.status).toBe('blocked');
  });

  // 13. browser.extract wraps text and fails closed (Req 25, 26, 27, 28, 29, 30)
  it('extracts DOM innerText, wraps output in untrusted_browser_content, and fails closed if sidecar is offline', async () => {
    const catalog = new ZavorthActionCatalog();
    const extAction = catalog.get('browser.extract')!;

    expect(extAction.risk).toBe('attention');
    expect(extAction.requiresPreview).toBe(true);
    expect(extAction.requiresApproval).toBe(true);

    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const previewRes = await gateway.preview('browser.extract');
    expect(previewRes.ok).toBe(true);
    expect(mockExtractText).not.toHaveBeenCalled();

    const appliedRes = await gateway.apply('browser.extract', { maxChars: 50 }, { trustedOperatorConfirmation: true });
    expect(appliedRes.ok).toBe(true);
    expect(appliedRes.status).toBe('applied');
    expect(mockExtractText).toHaveBeenCalledWith({ maxChars: 50 });
    expect(appliedRes.data?.content).toContain('<untrusted_browser_content>');
    expect(appliedRes.data?.content).toContain('extracted page body innerText content');
    expect(appliedRes.data?.content).toContain('</untrusted_browser_content>');

    // Fail closed
    mockHealth.mockResolvedValueOnce({ ok: false });
    const offlineRes = await gateway.apply('browser.extract', {}, { trustedOperatorConfirmation: true });
    expect(offlineRes.ok).toBe(false);
    expect(offlineRes.status).toBe('blocked');
  });

  // 14. no live sidecar, no raw credentials or Bearer tokens in outputs (Req 31, 32, 33, 34)
  it('mocks sidecar endpoints and never exposes Authorization, cookies or Bearer secrets in outputs', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    // Verify safeFetch isn't called with Authorization headers
    await gateway.apply('web.fetch_url', { url: 'https://zavorth.internal/docs' });
    expect(mockSafeFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
          Cookie: expect.any(String),
        }),
      })
    );

    // Verify raw credentials don't escape in search
    const searchRes = await gateway.apply('web.search', { query: 'test query' });
    expect(JSON.stringify(searchRes)).not.toMatch(/Authorization|Bearer|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  });
});
