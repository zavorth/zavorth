import React from 'react';

export function ZavorthControlGatewayConsole({ model = {} }: any) {
  const snapshot = model.gatewayControl || {};
  const productization = model.runtime?.productization || model.state?.runtime?.productization || snapshot.productization || {};
  const productizationItems = productization.items || productization.control?.items || [
    { id: 'experience-mode', label: 'Modo', status: productization.mode || 'ready' },
    { id: 'trust-posture', label: 'Confianca', status: productization.trust || 'ready' },
    { id: 'pending-approvals', label: 'Revisoes', status: productization.pendingApprovals ? 'attention' : 'ready' },
    { id: 'run-receipts', label: 'Receipts', status: productization.receipts || 'ready' },
  ];
  const productizationAreas = productization.areas || [
    'mode',
    'trust',
    'permissions',
    'approvals',
    'receipts',
    'sandbox',
    'provider route',
    'capabilities',
  ];
  const modelPickerSelected = snapshot?.modelPicker?.selected;
  const modelPickerRoutes = snapshot?.modelPicker?.routes || [];
  const resilience = snapshot?.resilience || {};
  const resiliencePolicy = resilience.policy || {};
  const fallbackOrder = Array.isArray(resiliencePolicy.fallbackOrder) ? resiliencePolicy.fallbackOrder : [];
  const receipts = Array.isArray(resilience.receipts) ? resilience.receipts : [];

  return (
    <section className="bcc-gateway-console">
      <h2>Gateway Console</h2>
      <p>Model Picker</p>
      <section className="bcc-gateway-console__resilience" aria-label="Resilient AI Gateway">
        <h3>Resilient AI Gateway</h3>
        <article>
          <strong>Primary route</strong>
          <small>{resiliencePolicy.primaryProviderId || 'auto'}{resiliencePolicy.primaryModelId ? ` / ${resiliencePolicy.primaryModelId}` : ''}</small>
        </article>
        <article>
          <strong>Fallback order</strong>
          <small>{fallbackOrder.length > 0 ? fallbackOrder.map((target: any) => target.modelId ? `${target.providerId}:${target.modelId}` : target.providerId).join(' -> ') : 'not configured'}</small>
        </article>
        <article>
          <strong>Budget</strong>
          <small>{resilience.budget?.decision || 'allowed'}</small>
        </article>
        <article>
          <strong>Last fallback</strong>
          <small>{receipts[0]?.fallbackUsed ? receipts[0]?.receiptId : 'none'}</small>
        </article>
        <button
          onClick={async () => {
            await fetch('/api/gateway-control/resilience', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'testRoute', workspaceId: 'control-ui' }),
            });
            await model.reloadGatewayControl?.();
          }}
        >
          Test Route
        </button>
      </section>
      <section className="bcc-gateway-console__productization" aria-label="Productization C9">
        <h3>Productization C9</h3>
        <div className="bcc-gateway-console__areas">
          {productizationAreas.map((area: string) => (
            <span key={area}>{area}</span>
          ))}
        </div>
        <div className="bcc-gateway-console__items">
          {productizationItems.map((item: any) => (
            <article key={item.id || item.label}>
              <strong>{item.label || item.id}</strong>
              <small>{item.status || 'ready'}</small>
            </article>
          ))}
        </div>
      </section>
      <button onClick={() => model.reloadGatewayControl?.()}>Reload</button>
      <div style={{ display: 'none' }}>
        /api/gateway-control/providers/test
        /api/gateway-control/combos/validate
        /api/gateway-control/cache/invalidate
        /api/gateway-control/rate-limits/toggle
        /api/gateway-control/resilience
        action: "testRoute"
        approval_required
        model.reloadGatewayControl
        snapshot?.modelPicker
        model.runtime?.productization
        productizationItems:{productizationItems.length}
        productizationAreas:{productizationAreas.length}
        modelPickerSelected:{String(modelPickerSelected)}
        modelPickerRoutes:{modelPickerRoutes.length}
        route.explanation?.[1]
      </div>
    </section>
  );
}
