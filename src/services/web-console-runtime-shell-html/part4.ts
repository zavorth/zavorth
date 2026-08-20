export function buildRuntimeShellHtmlPart4(): string {
  return `        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="distributed-runtime-control-plane-actions" class="handoff-list compact">
              <li>Validate the token to review the next step for distributed runtime.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Channels avancados</p>
            <ul id="distributed-runtime-control-plane-channels" class="handoff-list compact">
              <li>Validate the token to see Slack, WhatsApp, Signal, iMessage, Teams, and Email in one plan.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Fleet capabilities</p>
            <ul id="distributed-runtime-control-plane-fleet" class="handoff-list compact">
              <li>Validate the token to see browser.proxy, files.watch, screen.capture, and other fleet capabilities.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">surfaces oficiais</p>
            <ul id="distributed-runtime-control-plane-surfaces" class="handoff-list compact">
              <li>Validate the token to review web shell, CLI, Telegram, Discord, and official remote access.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="runtime-stability-control-plane-card" class="handoff-card">
        <p class="profile-tag">Ops Stability</p>
        <h2>Fleet and transports supervised</h2>
        <p class="muted-copy section-note">
          This read consolidates Node Mesh, remote transports, supervised keepalive, and canonical recovery to stabilize the operational mesh.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Runtime</p>
            <strong id="runtime-stability-control-plane-state">Validate token</strong>
            <p id="runtime-stability-control-plane-summary" class="muted-copy">
              Fleet, transports, keepalive and recovery aparecem here when the protected shell is released.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Fleet</p>
            <strong id="runtime-stability-fleet-state">No reading</strong>
            <p id="runtime-stability-fleet-summary" class="muted-copy">
              Online, paired, queue and stale of the Node Mesh aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Transports</p>
            <strong id="runtime-stability-transports-state">No reading</strong>
            <p id="runtime-stability-transports-summary" class="muted-copy">
              Readiness, attention and doctor of the transports aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Keepalive</p>
            <strong id="runtime-stability-keepalive-state">No reading</strong>
            <p id="runtime-stability-keepalive-summary" class="muted-copy">
              Processos supervised, restarts and staleness aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Recover</p>
            <strong id="runtime-stability-recover-state">No reading</strong>
            <p id="runtime-stability-recover-summary" class="muted-copy">
              Recoverable issues and the canonical next step appear here.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="runtime-stability-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar estabilidade</button>
          <button id="runtime-stability-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:stability">Copiar ops:stability</button>
        </div>
        <p id="runtime-stability-control-plane-status" class="muted-copy section-note">
          Validate token to review keepalive, doctor, and repair for supervised runtime.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="runtime-stability-control-plane-actions" class="handoff-list compact">
              <li>Validate token to review the next step for supervised stability.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Cards operational</p>
            <ul id="runtime-stability-control-plane-cards" class="handoff-list compact">
              <li>Validate token to see fleet, transports, keepalive, and recovery in one frame.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Processos keepalive</p>
            <ul id="runtime-stability-control-plane-processes" class="handoff-list compact">
              <li>Validate token to review proxy, gateway, and supervised node-hosts.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="rollout-readiness-control-plane-card" class="handoff-card">
        <p class="profile-tag">Rollout QA</p>
        <h2>Rollout and QA persistentes</h2>
        <p class="muted-copy section-note">
          This view combines release gates, distributed runtime, recurring maintenance, and publish history for a long-running predictable rollout.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Rollout</p>
            <strong id="rollout-readiness-control-plane-state">Validate token</strong>
            <p id="rollout-readiness-control-plane-summary" class="muted-copy">
              QA, maintenance and rollout persistente aparecem here when the protected shell is released.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">QA</p>
            <strong id="rollout-readiness-qa-state">No reading</strong>
            <p id="rollout-readiness-qa-summary" class="muted-copy">
              Gates de alpha/beta, regressions and readiness aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Distribuido</p>
            <strong id="rollout-readiness-distributed-state">No reading</strong>
            <p id="rollout-readiness-distributed-summary" class="muted-copy">
              A postura of the runtime distributed entra como requisito of the rollout.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Maintenance</p>
            <strong id="rollout-readiness-maintenance-state">No reading</strong>
            <p id="rollout-readiness-maintenance-summary" class="muted-copy">
              Recurring maintenance and persistent keepalive appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Publish</p>
            <strong id="rollout-readiness-publish-state">No reading</strong>
            <p id="rollout-readiness-publish-summary" class="muted-copy">
              O history de publish and as comparisons with baseline aparecem aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="rollout-readiness-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar rollout</button>
          <button id="rollout-readiness-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:rollout-readiness">Copiar ops:rollout-readiness</button>
        </div>
        <p id="rollout-readiness-control-plane-status" class="muted-copy section-note">
          Validate token to review gates, maintenance, and publish for persistent rollout.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="rollout-readiness-control-plane-actions" class="handoff-list compact">
              <li>Validate token to review the next step for persistent rollout.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Cards operational</p>
            <ul id="rollout-readiness-control-plane-cards" class="handoff-list compact">
              <li>Validate token to see QA, runtime, maintenance, and publish in one panel.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Publicactions recentes</p>
            <ul id="rollout-readiness-control-plane-publish" class="handoff-list compact">
              <li>Validate token to review o history de publish of the host.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="trust-plane-card" class="handoff-card">
        <p class="profile-tag">Trust Plane</p>
        <h2>Perfis, allowlists and surfaces sensitive</h2>
        <p class="muted-copy section-note">
          This view combines the supervised host, MCP profile, skill and plugin trust policy, and runtime trust boundary into one operator layer.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Host</p>
            <strong id="trust-plane-host-state">Validate token</strong>
            <p id="trust-plane-host-summary" class="muted-copy">
              Approvals, kill switch and capabilities sensitive aparecem here when o shell protegido estiver liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">MCP</p>
            <strong id="trust-plane-mcp-state">Perfil safe</strong>
            <p id="trust-plane-mcp-summary" class="muted-copy">
              O profile MCP and a allowlist explicit aparecem here when o runtime protegido estiver autenticado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Skills & plugins</p>
            <strong id="trust-plane-skills-state">Policy deny</strong>
            <p id="trust-plane-skills-summary" class="muted-copy">
              Skill policy and trusted plugin plane appear together here to avoid scattered trust.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Runtime</p>
            <strong id="trust-plane-runtime-state">Baseline</strong>
            <p id="trust-plane-runtime-summary" class="muted-copy">
              The Runtime & Security Mesh trust boundary appears here as an operator summary.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="trust-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar trust</button>
          <button id="trust-plane-promote-trusted-action" type="button" class="action-button secondary compact-action" hidden>MCP trusted</button>
          <button id="trust-plane-harden-safe-action" type="button" class="action-button secondary compact-action" hidden>MCP safe</button>
          <button id="trust-plane-skills-deny-action" type="button" class="action-button secondary compact-action" hidden>Skills deny</button>
          <button id="trust-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:trust-plane">Copiar ops:trust-plane</button>
        </div>
        <p id="trust-plane-status" class="muted-copy section-note">
          Validate token to review this host official Trust Plane.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Riscos</p>
            <ul id="trust-plane-highlights" class="handoff-list compact">
              <li>Validate token to see the main risks and blockers.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="trust-plane-actions" class="handoff-list compact">
              <li>Validate token to review the next Trust Plane steps.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">surfaces</p>
            <ul id="trust-plane-surfaces" class="handoff-list compact">
              <li>Validate token to see host, MCP, skills, plugins, and runtime in one read.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="system-supervisor-card" class="handoff-card system-supervisor-card">
        <p class="profile-tag">System Supervisor</p>
        <h2>Controle supervised of the host</h2>
        <p class="muted-copy section-note">
          Capabilities, niveis de autonomia, adapters and latest actions passam por policy, ledger and approvals before tocar in the host.
        </p>
        <p class="muted-copy section-note">
          Natural examples: <code>open the browser at https://example.com</code>, <code>publish a tunnel for http://127.0.0.1:3004</code>, <code>run in WSL: npm test</code>.
        </p>
        <div class="ops-summary-grid system-supervisor-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Estado</p>
            <strong id="system-supervisor-state">Validate token</strong>
            <p id="system-supervisor-summary" class="muted-copy">
              O control plane supervised aparece here assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Autonomia</p>
            <strong id="system-supervisor-autonomy-state">Niveis 1-6</strong>
            <p id="system-supervisor-autonomy-summary" class="muted-copy">
              diagnostic, patch, build/test/install, host, desktop/browser and owner supervised.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Adapters</p>
            <strong id="system-supervisor-adapters-state">Waiting</strong>
            <p id="system-supervisor-adapters-summary" class="muted-copy">
              Browser, desktop and computer-use aparecem when it isem registrados in the gateway.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Kill switch</p>
            <strong id="system-supervisor-kill-switch-state">Protected</strong>
            <p id="system-supervisor-kill-switch-summary" class="muted-copy">
              Blocks new actions and helps cancel what's still active.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="system-supervisor-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Supervisor</button>
          <button id="system-supervisor-kill-switch-enable" type="button" class="action-button secondary compact-action" hidden>Activate kill switch</button>
          <button id="system-supervisor-kill-switch-release" type="button" class="action-button secondary compact-action" hidden>enable kill switch</button>
          <button id="system-supervisor-copy-status" type="button" class="action-button secondary compact-action" data-copy="npm run cli:fast -- status --live">Copiar status live</button>
          <button id="system-supervisor-copy-doctor" type="button" class="action-button secondary compact-action" data-copy="npm run cli:fast -- doctor --json">Copiar doctor</button>
        </div>
        <div class="system-supervisor-action-form">
          <select id="system-supervisor-capability" class="auth-input compact-select" aria-label="Capability supervised">
            <option value="host.shell">host.shell</option>
            <option value="host.install">host.install</option>
            <option value="docker.exec">docker.exec</option>
            <option value="wsl.exec">wsl.exec</option>
            <option value="network.tunnel">network.tunnel</option>
            <option value="node.invoke">node.invoke</option>
            <option value="secrets.read">secrets.read</option>
            <option value="browser.control">browser.control</option>
            <option value="desktop.automation">desktop.automation</option>
            <option value="computer_use.visual_action">computer_use.visual_action</option>
          </select>
          <select id="system-supervisor-profile" class="auth-input compact-select" aria-label="Execution profile">
            <option value="safe">safe</option>
            <option value="trusted">trusted</option>
            <option value="dangerous">dangerous</option>
            <option value="owner">owner</option>
          </select>
          <select id="system-supervisor-autonomy" class="auth-input compact-select" aria-label="Nivel de autonomia">
            <option value="1">nivel 1</option>
            <option value="2">nivel 2</option>
            <option value="3">nivel 3</option>
            <option value="4">nivel 4</option>
            <option value="5">nivel 5</option>
            <option value="6">nivel 6</option>
          </select>
          <input id="system-supervisor-command" class="auth-input" type="text" placeholder="Ex.: git status" autocomplete="off" />
          <label class="inline-check"><input id="system-supervisor-dry-run" type="checkbox" checked /> dry-run</label>
          <label class="inline-check"><input id="system-supervisor-approved" type="checkbox" /> approved</label>
          <button id="system-supervisor-run-action" type="button" class="action-button compact-action" hidden>run supervised</button>
        </div>
        <p id="system-supervisor-status" class="muted-copy section-note">
          Validate token to review o System Supervisor supervised from this host.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Approvals</p>
            <ul id="system-supervisor-approvals" class="handoff-list compact">
              <li>Validate token to see pending approvals.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Capabilities</p>
            <ul id="system-supervisor-capabilities" class="handoff-list compact">
              <li>Validate token to see capabilities and risk.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions recentes</p>
            <ul id="system-supervisor-actions" class="handoff-list compact">
              <li>Validate token to see recent action ledger.</li>
            </ul>
          </article>
        </div>
      </section>

    </main>
  </body>
</html>`;
}
