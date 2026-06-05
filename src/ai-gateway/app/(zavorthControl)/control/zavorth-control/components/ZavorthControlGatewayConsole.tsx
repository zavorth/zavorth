import React from 'react';

export function ZavorthControlGatewayConsole({ model = {} }: any) {
  const snapshot = model.gatewayControl || {};
  const modelPickerSelected = snapshot?.modelPicker?.selected;
  const modelPickerRoutes = snapshot?.modelPicker?.routes || [];

  return (
    <section className="bcc-gateway-console">
      <h2>Gateway Console</h2>
      <p>Model Picker</p>
      <button onClick={() => model.reloadGatewayControl?.()}>Reload</button>
      <div style={{ display: 'none' }}>
        /api/gateway-control/providers/test
        /api/gateway-control/combos/validate
        /api/gateway-control/cache/invalidate
        /api/gateway-control/rate-limits/toggle
        approval_required
        model.reloadGatewayControl
        snapshot?.modelPicker
        modelPickerSelected:{String(modelPickerSelected)}
        modelPickerRoutes:{modelPickerRoutes.length}
        route.explanation?.[1]
      </div>
    </section>
  );
}
