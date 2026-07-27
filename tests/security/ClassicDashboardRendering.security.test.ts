import { getZavorthControlClassicClientCoreScript } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlClassicClientCoreScript.js';
import { getZavorthControlClassicClientDataAuditScript } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlClassicClientDataAuditScript.js';
import { getZavorthControlClassicClientDataLogsScript } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlClassicClientDataLogsScript.js';
import { getZavorthControlClassicClientDataSnippetsScript } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlClassicClientDataSnippetsScript.js';

describe('classic dashboard rendering safety', () => {
  it('defines an escapeHtml utility in the core script', () => {
    const script = getZavorthControlClassicClientCoreScript();
    expect(script).toContain('function escapeHtml');
  });

  it('renders snippet names as text via the snippet list container', () => {
    const script = getZavorthControlClassicClientDataSnippetsScript();
    expect(script).toContain('snippet-list-container');
    expect(script).toContain('snippet-item');
  });
});
