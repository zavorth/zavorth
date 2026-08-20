export function buildRuntimeShellHtmlPart3(): string {
  return `            <strong id="eval-control-plane-datasets-state">No reading</strong>
            <p id="eval-control-plane-datasets-summary" class="muted-copy">
              Flow clusters, replay/resume pressure, traces, and historical baseline appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Coverage</p>
            <strong id="eval-control-plane-coverage-state">No reading</strong>
            <p id="eval-control-plane-coverage-summary" class="muted-copy">
              Observable tasks, workflows, approvals, traces, and sinks feeding this panel appear here.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="eval-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar evals</button>
          <button id="eval-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:evals">Copy ops:evals</button>
        </div>
        <p id="eval-control-plane-status" class="muted-copy section-note">
          Validate token to review this host scorecards, regressions, traces, and baseline.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Scorecards</p>
            <ul id="eval-control-plane-scorecards" class="handoff-list compact">
              <li>Validate token to see main flows and their baselines.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Regressoes</p>
            <ul id="eval-control-plane-regressions" class="handoff-list compact">
              <li>Validate token to see this window biggest bottlenecks.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Datasets, traces and trend</p>
            <ul id="eval-control-plane-datasets" class="handoff-list compact">
              <li>Validate token to review operational datasets, traces, coverage, and comparisons.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="hub-control-plane-card" class="handoff-card">
        <p class="profile-tag">Gateway Boundary</p>
        <h2>Hub + MCP product plane</h2>
        <p class="muted-copy section-note">
          This view combines Integration Hub, plugin plane, platform plane, skill plane, and MCP into one cockpit for discovery, trust, sync, and doctor workflows.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="hub-control-plane-state">Validate token</strong>
            <p id="hub-control-plane-summary" class="muted-copy">
              The Hub + MCP consolidation appears here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Integrations & plugins</p>
            <strong id="hub-control-plane-integrations-state">No reading</strong>
            <p id="hub-control-plane-integrations-summary" class="muted-copy">
              Connectors, trusted plugins, and configurable items appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Platform & skills</p>
            <strong id="hub-control-plane-platform-state">No reading</strong>
            <p id="hub-control-plane-platform-summary" class="muted-copy">
              Remote registry, collections, recipes, and ready skills appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">MCP</p>
            <strong id="hub-control-plane-mcp-state">No reading</strong>
            <p id="hub-control-plane-mcp-summary" class="muted-copy">
              MCP servers, tools, resources, and doctor are consolidated here.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="hub-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar hub</button>
          <button id="hub-control-plane-sync-action" type="button" class="action-button secondary compact-action" hidden>Sincronizar registry</button>
          <button id="hub-control-plane-mcp-doctor-action" type="button" class="action-button secondary compact-action" hidden>run doctor MCP</button>
          <button id="hub-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:hub">Copy ops:hub</button>
        </div>
        <p id="hub-control-plane-status" class="muted-copy section-note">
          Validate token to review surfaces, actions, and highlighted Hub + MCP items.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Surfaces</p>
            <ul id="hub-control-plane-surfaces" class="handoff-list compact">
              <li>Validate token to see Integration Hub, platform, skills, plugins, and MCP in one plan.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="hub-control-plane-actions" class="handoff-list compact">
              <li>Validate token to review sync, doctor, and next ecosystem steps.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Destaques</p>
            <ul id="hub-control-plane-featured" class="handoff-list compact">
              <li>Validate token to review highlighted connectors, plugins, skills, and MCPs.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="qa-control-plane-card" class="handoff-card">
        <p class="profile-tag">QA release</p>
        <h2>QA, budgets and release gates</h2>
        <p class="muted-copy section-note">
          This view combines benchmarks, smokes, regressions, and release gates into one plan to decide whether the host is ready for alpha or beta.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="qa-control-plane-state">Validate token</strong>
            <p id="qa-control-plane-summary" class="muted-copy">
              The QA release consolidation appears here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Benchmarks</p>
            <strong id="qa-control-plane-benchmarks-state">No reading</strong>
            <p id="qa-control-plane-benchmarks-summary" class="muted-copy">
              Boot, runtime flow, and sidecars appear here with budget and report age.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Smokes & regressions</p>
            <strong id="qa-control-plane-regressions-state">No reading</strong>
            <p id="qa-control-plane-regressions-summary" class="muted-copy">
              The critical suite and smoke suite appear here with failures, absence, and stale status.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Release</p>
            <strong id="qa-control-plane-release-state">No reading</strong>
            <p id="qa-control-plane-release-summary" class="muted-copy">
              Alpha and beta appear here with gates ready or pending.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="qa-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar QA</button>
          <button id="qa-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:qa">Copy ops:qa</button>
          <button id="qa-control-plane-copy-alpha" type="button" class="action-button secondary compact-action" data-copy="npm run release:alpha">Copy release:alpha</button>
          <button id="qa-control-plane-copy-beta" type="button" class="action-button secondary compact-action" data-copy="npm run release:beta">Copy release:beta</button>
        </div>
        <p id="qa-control-plane-status" class="muted-copy section-note">
          Validate token to review this host budgets, reports, and release gates.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Budgets</p>
            <ul id="qa-control-plane-benchmarks" class="handoff-list compact">
              <li>Validate token to review boot, runtime flow, and sidecars against versioned budgets.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Smokes and regressions</p>
            <ul id="qa-control-plane-smokes" class="handoff-list compact">
              <li>Validate token to review this host smoke suite and critical regressions.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Release profiles</p>
            <ul id="qa-control-plane-release-gates" class="handoff-list compact">
              <li>Validate token to review alpha and beta gates without manual log reading.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="governance-control-plane-card" class="handoff-card">
        <p class="profile-tag">Governance</p>
        <h2>Governance, tenants and policy</h2>
        <p class="muted-copy section-note">
          This view junta tenants, trust decisions, allowlists, channels, nodes, plugins, platform and transports numa camada unica de governanca operational.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Postura</p>
            <strong id="governance-control-plane-state">Validate token</strong>
            <p id="governance-control-plane-summary" class="muted-copy">
              The consolidated Governance posture appears here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Tenants</p>
            <strong id="governance-control-plane-tenants-state">No reading</strong>
            <p id="governance-control-plane-tenants-summary" class="muted-copy">
              Shared tenants, personal tenants, onboarding, and public servers appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Trust</p>
            <strong id="governance-control-plane-trust-state">No reading</strong>
            <p id="governance-control-plane-trust-summary" class="muted-copy">
              Approvals, MCP, trusted plugins, and sensitive capabilities appear in this summary.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Policy surfaces</p>
            <strong id="governance-control-plane-policy-state">No reading</strong>
            <p id="governance-control-plane-policy-summary" class="muted-copy">
              Channels, nodes, platform, transports, and teams stay connected to the same contract.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="governance-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar governance</button>
          <button id="governance-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:governance">Copy ops:governance</button>
        </div>
        <p id="governance-control-plane-status" class="muted-copy section-note">
          Validate token to review decisions, allowlists, and policy by surface.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Trust decisions</p>
            <ul id="governance-control-plane-decisions" class="handoff-list compact">
              <li>Validate token to see allow/ask/deny/defer/audit decisions.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Policy surfaces</p>
            <ul id="governance-control-plane-surfaces" class="handoff-list compact">
              <li>Validate token to see tenants, trust, channels, nodes, plugins, platform, transports, and teams.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="governance-control-plane-actions" class="handoff-list compact">
              <li>Validate token to review next governance steps.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="replay-learning-control-plane-card" class="handoff-card">
        <p class="profile-tag">Replay learning</p>
        <h2>Replay, artifacts and learning loop</h2>
        <p class="muted-copy section-note">
          This reading turns replay, artifacts, memory, and learning into reusable points for comparison, resumption, and operational promotion.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Replay</p>
            <strong id="replay-learning-state">Validate token</strong>
            <p id="replay-learning-summary" class="muted-copy">
              Timeline, run comparison, and context restore appear here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Artifacts</p>
            <strong id="replay-learning-artifacts-state">No reading</strong>
            <p id="replay-learning-artifacts-summary" class="muted-copy">
              Reusable artifacts and resume prompts remain visible in this slice.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Learning</p>
            <strong id="replay-learning-learning-state">No reading</strong>
            <p id="replay-learning-learning-summary" class="muted-copy">
              Pending, promoted, and high-trust candidates appear with a clear next step.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Memory</p>
            <strong id="replay-learning-memory-state">No reading</strong>
            <p id="replay-learning-memory-summary" class="muted-copy">
              Memory pressure, procedures, and restore points stay connected to the same plan.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="replay-learning-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Replay learning</button>
          <button id="replay-learning-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:replay-learning">Copy ops:replay-learning</button>
        </div>
        <p id="replay-learning-status" class="muted-copy section-note">
          Validate token to review timeline, reusable artifacts, learning promotions, and memory pressure.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="replay-learning-actions" class="handoff-list compact">
              <li>Validate token to review compare, resume, and learning promotions.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Reusable artifacts</p>
            <ul id="replay-learning-artifacts" class="handoff-list compact">
              <li>Validate token to see artifacts with resume prompts.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Timeline</p>
            <ul id="replay-learning-timeline" class="handoff-list compact">
              <li>Validate token para compare recent replay, workflows, and artifacts.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="ecosystem-control-plane-card" class="handoff-card">
        <p class="profile-tag">Ecosystem</p>
        <h2>Ecossistema, SDKs and third-party platform</h2>
        <p class="muted-copy section-note">
          This view combines official SDKs, public guides, publishing, recipes, and the platform plane catalog into one cockpit for integrators and operators.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Ecossistema</p>
            <strong id="ecosystem-control-plane-state">Validate token</strong>
            <p id="ecosystem-control-plane-summary" class="muted-copy">
              SDKs, guides, and publishing appear here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">SDKs</p>
            <strong id="ecosystem-control-plane-sdk-state">No reading</strong>
            <p id="ecosystem-control-plane-sdk-summary" class="muted-copy">
              The TypeScript and Python SDK state is visible here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Registry</p>
            <strong id="ecosystem-control-plane-registry-state">No reading</strong>
            <p id="ecosystem-control-plane-registry-summary" class="muted-copy">
              Remote registry, collections, recipes, and items under review are consolidated here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Publish</p>
            <strong id="ecosystem-control-plane-publish-state">No reading</strong>
            <p id="ecosystem-control-plane-publish-summary" class="muted-copy">
              Prepared bundles, published items, and provenance warnings appear here.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="ecosystem-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Ecosystem</button>
          <button id="ecosystem-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:ecosystem">Copy ops:ecosystem</button>
        </div>
        <p id="ecosystem-control-plane-status" class="muted-copy section-note">
          Validate token to review ecosystem SDKs, guides, recipes, and publish artifacts.
        </p>
        <div class="system-supervisor-detail-grid">
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Actions sugeridas</p>
            <ul id="ecosystem-control-plane-actions" class="handoff-list compact">
              <li>Validate token to review ecosystem SDKs, guides, and next steps.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Guias por tipo</p>
            <ul id="ecosystem-control-plane-guides" class="handoff-list compact">
              <li>Validate token to see client, node, plugin, and recipe in one plan.</li>
            </ul>
          </article>
          <article class="system-supervisor-detail-card">
            <p class="profile-tag">Publish recente</p>
            <ul id="ecosystem-control-plane-publish" class="handoff-list compact">
              <li>Validate token to review publish bundles, signatures, and readiness.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="distributed-runtime-control-plane-card" class="handoff-card">
        <p class="profile-tag">Distributed runtime</p>
        <h2>Distributed runtime and advanced surfaces</h2>
        <p class="muted-copy section-note">
          This view combines advanced channels, Node Mesh fleet, remote transports, and official surfaces into one posture for the distributed runtime.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Distribuido</p>
            <strong id="distributed-runtime-control-plane-state">Validate token</strong>
            <p id="distributed-runtime-control-plane-summary" class="muted-copy">
              Channel Mesh, Node Mesh, transports, and surfaces appear here as soon as the protected shell is unlocked.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Channels</p>
            <strong id="distributed-runtime-channels-state">No reading</strong>
            <p id="distributed-runtime-channels-summary" class="muted-copy">
              The slice of advanced channels, attachments, and threads appears here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Fleet</p>
            <strong id="distributed-runtime-fleet-state">No reading</strong>
            <p id="distributed-runtime-fleet-summary" class="muted-copy">
              Online, queue, stale, and advanced capability coverage appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Transports</p>
            <strong id="distributed-runtime-transports-state">No reading</strong>
            <p id="distributed-runtime-transports-summary" class="muted-copy">
              Remote bridges, sidecars, and node-hosts appear here.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Surfaces</p>
            <strong id="distributed-runtime-surfaces-state">No reading</strong>
            <p id="distributed-runtime-surfaces-summary" class="muted-copy">
              Web shell, CLI, Telegram, Discord, and official remote access appear here.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <button id="distributed-runtime-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Distributed runtime</button>
          <button id="distributed-runtime-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:distributed">Copy ops:distributed</button>
        </div>
        <p id="distributed-runtime-control-plane-status" class="muted-copy section-note">
          Validate token to review distributed runtime channels, fleet, transports, and surfaces.`;
}
