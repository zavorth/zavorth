import React from 'react';

export function ZavorthControlDeveloperWorkspace({ model = {} }: any) {
  function handleDeveloperWorkspaceAction(action: any) {
    return action?.risk === 'mutation' ? 'approval_required' : 'preview';
  }

  const ptyProfiles = model.developerWorkspace?.ptyProfiles || [];
  const processes = model.developerWorkspace?.processes || [];
  const hooks = model.developerWorkspace?.hooks || [];

  return (
    <section className="bcc-developer-workspace">
      <h2>Developer Workspace</h2>
      <button onClick={() => handleDeveloperWorkspaceAction({ risk: 'mutation' })}>
        approval_required
      </button>
      <div style={{ display: 'none' }}>
        handleDeveloperWorkspaceAction ptyProfiles:{ptyProfiles.length} processes:{processes.length} hooks:{hooks.length}
      </div>
    </section>
  );
}
