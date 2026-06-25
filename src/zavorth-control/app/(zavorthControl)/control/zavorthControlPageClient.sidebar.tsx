import React from 'react';

export function ZavorthControlPageClientSidebar() {
  return (
    <aside>
      <h2>Approval Inbox</h2>
      <button type="button">Approve once</button>
      <button type="button">Preview mission</button>
      <button type="button">Submit live</button>
      <p>Policy: workspace.write.requires_approval</p>
      <p>Approval ID: pending approval reference</p>
    </aside>
  );
}
