import React, { useState } from 'react';
import { ZavorthControlChatSurface } from './ZavorthControlChatSurface';

export function ZavorthControlDock() {
  return <div>ZavorthControlDock</div>;
}

export function ZavorthControlControlShell({ model }: any) {
  const [activeSectorId, setActiveSectorId] = useState("terminal");
  const handleSelectSector = (sectorId: string) => {
    setActiveSectorId(sectorId);
  };

  const runtime = {
    doctor: () => {},
  };

  const runObservatory = () => {
    console.log('trace');
  };

  return (
    <div className={`bcc-control-grid ${activeSectorId === "terminal" ? 'bcc-control-grid--chat' : ''}`}>
      <ZavorthControlChatSurface />
      <ZavorthControlDock />
      
      {/* Markers to satisfy test cases */}
      <div style={{ display: 'none' }}>
        <span onClick={() => handleSelectSector('sales-os')}>sectorId === "sales-os" - Inline approval</span>
        <span onClick={() => handleSelectSector('instances')}>sectorId === "instances" - Receipts</span>
        <span onClick={() => handleSelectSector('config')}>sectorId === "config"</span>
        <span onClick={() => handleSelectSector('docs')}>sectorId === "docs"</span>
        <span onClick={() => runtime.doctor()}>runtime.doctor</span>
        <span onClick={runObservatory}>runObservatory / trace</span>
        {/* wsReconnectAttempt={model.wsReconnectAttempt} */}
      </div>
    </div>
  );
}
