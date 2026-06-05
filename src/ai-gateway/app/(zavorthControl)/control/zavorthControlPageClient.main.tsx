import React from 'react';

export function ZavorthControlPageClientMain({ state }: { state?: Record<string, any> }) {
  return (
    <main>
      <section aria-label="Runtime API v1">
        <h2>Runtime API v1</h2>
        <p>Readable evidence from governed actions; this panel has no direct execution authority.</p>
        <p>Receipts will appear after approvals</p>
        <p>Rollback: available when the runtime exposes a rollback receipt.</p>
      </section>

      <section aria-label="Provider Cockpit">
        <h2>Provider Cockpit</h2>
        <p>Readiness and tests from Runtime API v1</p>
        <button type="button">Test preview</button>
      </section>

      <section aria-label="Channel Cockpit">
        <h2>Channel Cockpit</h2>
        <p>Readiness and tests from Runtime API v1</p>
      </section>

      <section aria-label="Mission Cockpit">
        <h2>Mission Cockpit</h2>
        <button type="button">Cancel mission</button>
      </section>

      <pre hidden>{JSON.stringify(state || {})}</pre>
    </main>
  );
}
