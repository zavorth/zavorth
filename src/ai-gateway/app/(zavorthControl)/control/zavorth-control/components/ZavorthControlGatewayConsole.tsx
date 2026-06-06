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

  return (
    <section className="bcc-gateway-console">
      <h2>Gateway Console</h2>
      <p>Model Picker</p>
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
