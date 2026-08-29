import { ConnectionSemanticIntrospectionService } from '../../../src/services/connection/ConnectionSemanticIntrospectionService.js';

describe('ConnectionSemanticIntrospectionService', () => {
  it('returns disabled status when flag is false', async () => {
    const service = new ConnectionSemanticIntrospectionService({ enabled: false });
    const res = await service.introspect('linear');

    expect(res.enabled).toBe(false);
    expect(res.recognizedCategory).toBeUndefined();
  });

  it('classifies recognized ecosystem service and provides manifest template snippet', async () => {
    const service = new ConnectionSemanticIntrospectionService({ enabled: true });
    const res = await service.introspect('linear');

    expect(res.enabled).toBe(true);
    expect(res.recognizedCategory).toBe('Issue Tracking & Project Management');
    expect(res.recommendedAuthType).toBe('api_key');
    expect(res.guidance).toContain('linear');
    expect(res.manifestTemplateSnippet).toBeDefined();
    expect(res.manifestTemplateSnippet).toContain('"id": "linear"');
  });

  it('provides safe generic guidance for unrecognized service', async () => {
    const service = new ConnectionSemanticIntrospectionService({ enabled: true });
    const res = await service.introspect('completely_unknown_vendor');

    expect(res.enabled).toBe(true);
    expect(res.recognizedCategory).toBeUndefined();
    expect(res.guidance).toContain('completely_unknown_vendor');
    expect(res.guidance).toContain('Plugin Manifest');
  });

  it('enforces rate limiting after maxRequestsPerMinute', async () => {
    const service = new ConnectionSemanticIntrospectionService({
      enabled: true,
      maxRequestsPerMinute: 3,
    });

    await service.introspect('linear');
    await service.introspect('jira');
    await service.introspect('hubspot');

    const rateLimitedRes = await service.introspect('salesforce');
    expect(rateLimitedRes.guidance).toContain('rate limit reached');
  });
});
