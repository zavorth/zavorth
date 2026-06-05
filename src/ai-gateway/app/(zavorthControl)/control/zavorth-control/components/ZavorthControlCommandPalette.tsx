import React from 'react';

export function ZavorthControlCommandPalette({ onAction = () => {} }: any) {
  const action = { id: 'open-review', label: 'Revisar', safe: true };
  return (
    <div className="bcc-command-palette">
      <strong>Acoes seguras</strong>
      <button onClick={() => onAction(action)}>Run</button>
      <span style={{ display: 'none' }}>onAction(action)</span>
    </div>
  );
}
