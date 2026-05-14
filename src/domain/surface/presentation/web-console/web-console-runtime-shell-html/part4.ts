export function buildRuntimeShellHtmlPart4(): string {
  return `        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="distributed-runtime-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar o proximo passo do runtime distribuido.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Channels avancados</p>
            <ul id="distributed-runtime-control-plane-channels" class="handoff-list compact">
              <li>Valide o token para ver Slack, WhatsApp, Signal, iMessage, Teams e Email no mesmo plano.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Fleet capabilities</p>
            <ul id="distributed-runtime-control-plane-fleet" class="handoff-list compact">
              <li>Valide o token para ver browser.proxy, files.watch, screen.capture e outras capabilities da fleet.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Superficies oficiais</p>
            <ul id="distributed-runtime-control-plane-surfaces" class="handoff-list compact">
              <li>Valide o token para revisar shell web, CLI, Telegram, Discord e acesso remoto oficial.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="runtime-stability-control-plane-card" class="handoff-card">
        <p class="profile-tag">Ops Stability</p>
        <h2>Fleet e transports supervisionados</h2>
        <p class="muted-copy section-note">
          Esta leitura consolida Node Mesh, transports remotos, keepalive supervisionado e o recover canonico para estabilizar a malha operacional.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Runtime</p>
            <strong id="runtime-stability-control-plane-state">Valide o token</strong>
            <p id="runtime-stability-control-plane-summary" class="muted-copy">
              Fleet, transports, keepalive e recovery aparecem aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Fleet</p>
            <strong id="runtime-stability-fleet-state">Sem leitura</strong>
            <p id="runtime-stability-fleet-summary" class="muted-copy">
              Online, paired, fila e stale do Node Mesh aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Transports</p>
            <strong id="runtime-stability-transports-state">Sem leitura</strong>
            <p id="runtime-stability-transports-summary" class="muted-copy">
              Readiness, attention e doctor dos transports aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Keepalive</p>
            <strong id="runtime-stability-keepalive-state">Sem leitura</strong>
            <p id="runtime-stability-keepalive-summary" class="muted-copy">
              Processos supervisionados, restarts e staleness aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Recover</p>
            <strong id="runtime-stability-recover-state">Sem leitura</strong>
            <p id="runtime-stability-recover-summary" class="muted-copy">
              Issues recuperaveis e o proximo passo canonico aparecem aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="runtime-stability-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar estabilidade</button>
          <button id="runtime-stability-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:stability">Copiar ops:stability</button>
        </div>
        <p id="runtime-stability-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar keepalive, doctor e repair do runtime supervisionado.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="runtime-stability-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar o proximo passo da estabilidade supervisionada.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Cards operacionais</p>
            <ul id="runtime-stability-control-plane-cards" class="handoff-list compact">
              <li>Valide o token para ver fleet, transports, keepalive e recovery no mesmo quadro.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Processos keepalive</p>
            <ul id="runtime-stability-control-plane-processes" class="handoff-list compact">
              <li>Valide o token para revisar proxy, gateway e node-host supervisionados.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="rollout-readiness-control-plane-card" class="handoff-card">
        <p class="profile-tag">Rollout QA</p>
        <h2>Rollout e QA persistentes</h2>
        <p class="muted-copy section-note">
          Esta leitura junta release gates, runtime distribuido, maintenance recorrente e historico de publish para um rollout longo e previsivel.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Rollout</p>
            <strong id="rollout-readiness-control-plane-state">Valide o token</strong>
            <p id="rollout-readiness-control-plane-summary" class="muted-copy">
              QA, maintenance e rollout persistente aparecem aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">QA</p>
            <strong id="rollout-readiness-qa-state">Sem leitura</strong>
            <p id="rollout-readiness-qa-summary" class="muted-copy">
              Gates de alpha/beta, regressions e readiness aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Distribuido</p>
            <strong id="rollout-readiness-distributed-state">Sem leitura</strong>
            <p id="rollout-readiness-distributed-summary" class="muted-copy">
              A postura do runtime distribuido entra como requisito do rollout.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Maintenance</p>
            <strong id="rollout-readiness-maintenance-state">Sem leitura</strong>
            <p id="rollout-readiness-maintenance-summary" class="muted-copy">
              A manutencao recorrente e o keepalive persistente aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Publish</p>
            <strong id="rollout-readiness-publish-state">Sem leitura</strong>
            <p id="rollout-readiness-publish-summary" class="muted-copy">
              O historico de publish e as comparacoes com baseline aparecem aqui.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="rollout-readiness-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar rollout</button>
          <button id="rollout-readiness-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:rollout-readiness">Copiar ops:rollout-readiness</button>
        </div>
        <p id="rollout-readiness-control-plane-status" class="muted-copy section-note">
          Valide o token para revisar gates, maintenance e publish do rollout persistente.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="rollout-readiness-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar o proximo passo do rollout persistente.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Cards operacionais</p>
            <ul id="rollout-readiness-control-plane-cards" class="handoff-list compact">
              <li>Valide o token para ver QA, runtime, maintenance e publish no mesmo painel.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Publicacoes recentes</p>
            <ul id="rollout-readiness-control-plane-publish" class="handoff-list compact">
              <li>Valide o token para revisar o historico de publish do host.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="trust-plane-card" class="handoff-card">
        <p class="profile-tag">Trust Plane</p>
        <h2>Perfis, allowlists e superficies sensiveis</h2>
        <p class="muted-copy section-note">
          Esta leitura junta o host supervisionado, o perfil MCP, a trust policy de skills, plugins e o trust boundary do runtime numa camada unica para o operador.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Host</p>
            <strong id="trust-plane-host-state">Valide o token</strong>
            <p id="trust-plane-host-summary" class="muted-copy">
              Approvals, kill switch e capabilities sensiveis aparecem aqui quando o shell protegido estiver liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">MCP</p>
            <strong id="trust-plane-mcp-state">Perfil safe</strong>
            <p id="trust-plane-mcp-summary" class="muted-copy">
              O perfil MCP e a allowlist explicita aparecem aqui quando o runtime protegido estiver autenticado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Skills & plugins</p>
            <strong id="trust-plane-skills-state">Policy deny</strong>
            <p id="trust-plane-skills-summary" class="muted-copy">
              A policy de skills e o plugin plane trusted aparecem juntos aqui para evitar trust espalhado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Runtime</p>
            <strong id="trust-plane-runtime-state">Baseline</strong>
            <p id="trust-plane-runtime-summary" class="muted-copy">
              O trust boundary do Runtime & Security Mesh aparece aqui de forma resumida para o operador.
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
          Valide o token para revisar o Trust Plane oficial deste host.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Riscos</p>
            <ul id="trust-plane-highlights" class="handoff-list compact">
              <li>Valide o token para ver os principais riscos e bloqueios.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="trust-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar os proximos passos do Trust Plane.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Superficies</p>
            <ul id="trust-plane-surfaces" class="handoff-list compact">
              <li>Valide o token para ver host, MCP, skills, plugins e runtime numa leitura unica.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="system-overlord-card" class="handoff-card system-overlord-card">
        <p class="profile-tag">System Overlord</p>
        <h2>Controle supervisionado do host</h2>
        <p class="muted-copy section-note">
          Capabilities, niveis de autonomia, adapters e ultimas acoes passam por policy, ledger e approvals antes de tocar no host.
        </p>
        <p class="muted-copy section-note">
          Exemplos naturais: <code>abra o navegador em https://example.com</code>, <code>suba um tunel para http://127.0.0.1:3004</code>, <code>rode no WSL: npm test</code>.
        </p>
        <div class="ops-summary-grid system-overlord-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Estado</p>
            <strong id="system-overlord-state">Valide o token</strong>
            <p id="system-overlord-summary" class="muted-copy">
              O control plane supervisionado aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Autonomia</p>
            <strong id="system-overlord-autonomy-state">Niveis 1-6</strong>
            <p id="system-overlord-autonomy-summary" class="muted-copy">
              Diagnostico, patch, build/test/install, host, desktop/browser e owner supervisionado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Adapters</p>
            <strong id="system-overlord-adapters-state">Aguardando</strong>
            <p id="system-overlord-adapters-summary" class="muted-copy">
              Browser, desktop e computer-use aparecem quando estiverem registrados no gateway.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Kill switch</p>
            <strong id="system-overlord-kill-switch-state">Protegido</strong>
            <p id="system-overlord-kill-switch-summary" class="muted-copy">
              Bloqueia novas acoes e ajuda a cancelar o que ainda estiver ativo.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="system-overlord-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Overlord</button>
          <button id="system-overlord-kill-switch-enable" type="button" class="action-button secondary compact-action" hidden>Ativar kill switch</button>
          <button id="system-overlord-kill-switch-release" type="button" class="action-button secondary compact-action" hidden>Liberar kill switch</button>
          <button id="system-overlord-copy-status" type="button" class="action-button secondary compact-action" data-copy="npm run cli:fast -- status --live">Copiar status live</button>
          <button id="system-overlord-copy-doctor" type="button" class="action-button secondary compact-action" data-copy="npm run cli:fast -- doctor --json">Copiar doctor</button>
        </div>
        <div class="system-overlord-action-form">
          <select id="system-overlord-capability" class="auth-input compact-select" aria-label="Capability supervisionada">
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
          <select id="system-overlord-profile" class="auth-input compact-select" aria-label="Perfil de execucao">
            <option value="safe">safe</option>
            <option value="trusted">trusted</option>
            <option value="dangerous">dangerous</option>
            <option value="owner">owner</option>
          </select>
          <select id="system-overlord-autonomy" class="auth-input compact-select" aria-label="Nivel de autonomia">
            <option value="1">nivel 1</option>
            <option value="2">nivel 2</option>
            <option value="3">nivel 3</option>
            <option value="4">nivel 4</option>
            <option value="5">nivel 5</option>
            <option value="6">nivel 6</option>
          </select>
          <input id="system-overlord-command" class="auth-input" type="text" placeholder="Ex.: git status" autocomplete="off" />
          <label class="inline-check"><input id="system-overlord-dry-run" type="checkbox" checked /> dry-run</label>
          <label class="inline-check"><input id="system-overlord-approved" type="checkbox" /> aprovado</label>
          <button id="system-overlord-run-action" type="button" class="action-button compact-action" hidden>Executar supervisionado</button>
        </div>
        <p id="system-overlord-status" class="muted-copy section-note">
          Valide o token para revisar o System Overlord supervisionado deste host.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Approvals</p>
            <ul id="system-overlord-approvals" class="handoff-list compact">
              <li>Valide o token para ver aprovacoes pendentes.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Capabilities</p>
            <ul id="system-overlord-capabilities" class="handoff-list compact">
              <li>Valide o token para ver capabilities e risco.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes recentes</p>
            <ul id="system-overlord-actions" class="handoff-list compact">
              <li>Valide o token para ver ledger de acoes recentes.</li>
            </ul>
          </article>
        </div>
      </section>

    </main>
  </body>
</html>`;
}
