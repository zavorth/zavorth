export function buildRuntimeShellHtmlPart1(input: { externalWebClientUrl: string; externalDocsUrl: string; legacyBannerBlock: string }): string {
  const { externalWebClientUrl, externalDocsUrl, legacyBannerBlock } = input;
  return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zavorth Runtime</title>
    <base href="/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="module" src="/app.js"></script>
  </head>
  <body data-external-web-client-url="${externalWebClientUrl}" data-external-docs-url="${externalDocsUrl}">
    <main id="runtime-handoff" class="runtime-handoff-shell">
      ${legacyBannerBlock}
      <section class="hero-card">
        <p class="eyebrow">Zavorth Runtime</p>
        <h1>Runtime, terminal and API live here.</h1>
        <p class="hero-copy">
          This official repo is the home of the Zavorth runtime, CLI and API.
          The main entry is <code>/zavorthControl</code>.
          This shell is an internal maintenance fallback: it summarizes runtime, sessions, approvals
          and the operational mesh when the canonical zavorthControl assets are unavailable.
        </p>
        <div class="status-grid">
          <article class="status-pill">
            <span class="label">Web runtime</span>
            <strong id="runtime-shell-status">Checking</strong>
          </article>
          <article class="status-pill">
            <span class="label">Web auth</span>
            <strong id="runtime-shell-auth">Checking</strong>
          </article>
          <article class="status-pill">
            <span class="label">API base</span>
            <strong id="runtime-shell-origin">Detecting</strong>
          </article>
          <article class="status-pill">
            <span class="label">Gateway</span>
            <strong id="runtime-shell-gateway">Checking</strong>
          </article>
          <article class="status-pill">
            <span class="label">Quick mesh</span>
            <strong id="runtime-shell-mesh">Detecting</strong>
          </article>
        </div>
        <div class="action-row hero-actions">
          <button type="button" class="action-button" data-copy="npm run ops:go">Copy npm run ops:go</button>
          <button type="button" class="action-button secondary" data-copy="npm run cli -- status">Copy CLI status</button>
          <a id="open-zavorthControl" class="action-button secondary" href="/zavorthControl">Open zavorthControl</a>
        </div>
        <p class="muted-copy hero-note">
          Main path: <code>npm run ops:go</code>. If you operate from terminal only, use
          <code>npm run cli -- status</code>, <code>npm run cli -- doctor</code> e <code>npm run cli:repl</code>.
        </p>
      </section>

      <section id="operator-cockpit-card" class="handoff-card">
        <p class="profile-tag">Cockpit</p>
        <h2>Cockpit do operador</h2>
        <p class="muted-copy section-note">
          Estes nove blocos sao a leitura canonica do Zavorth neste host: runtime, sessions, approvals, resources, companions, health, nodes, transports e integrations.
        </p>
        <div class="ops-summary-grid cockpit-summary-grid">
          <article id="cockpit-runtime-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Runtime</p>
            <strong id="cockpit-runtime-state">Verificando</strong>
            <p id="cockpit-runtime-summary" class="muted-copy">
              O resumo do runtime aparece aqui assim que o host responder.
            </p>
          </article>
          <article id="cockpit-sessions-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Sessions</p>
            <strong id="cockpit-sessions-state">Valide o token</strong>
            <p id="cockpit-sessions-summary" class="muted-copy">
              A sessao ativa, o historico e o envio cruzado aparecem aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article id="cockpit-approvals-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Approvals</p>
            <strong id="cockpit-approvals-state">Valide o token</strong>
            <p id="cockpit-approvals-summary" class="muted-copy">
              A fila de aprovacoes desta sessao aparece aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article id="cockpit-resources-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Resources</p>
            <strong id="cockpit-resources-state">Valide o token</strong>
            <p id="cockpit-resources-summary" class="muted-copy">
              Memoria, pressao do host e top consumers aparecem aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article id="cockpit-companions-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Companions</p>
            <strong id="cockpit-companions-state">Valide o token</strong>
            <p id="cockpit-companions-summary" class="muted-copy">
              WSL, Docker Desktop, ZavorthBridge e Codex aparecem aqui com status e acoes seguras.
            </p>
          </article>
          <article id="cockpit-health-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Health</p>
            <strong id="cockpit-health-state">Valide o token</strong>
            <p id="cockpit-health-summary" class="muted-copy">
              Warnings de runtime e proximas acoes aparecem aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article id="cockpit-nodes-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Nodes</p>
            <strong id="cockpit-nodes-state">Valide o token</strong>
            <p id="cockpit-nodes-summary" class="muted-copy">
              O resumo da frota, do pairing e da fila do Node Mesh aparece aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article id="cockpit-transports-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Transports</p>
            <strong id="cockpit-transports-state">Valide o token</strong>
            <p id="cockpit-transports-summary" class="muted-copy">
              O resumo do plano remoto aparece aqui quando o shell protegido for liberado.
            </p>
          </article>
          <article id="cockpit-integrations-card" class="ops-summary-card cockpit-mini-card">
            <p class="profile-tag">Integrations</p>
            <strong id="cockpit-integrations-state">Valide o token</strong>
            <p id="cockpit-integrations-summary" class="muted-copy">
              Plugins, hooks e workspaces carregados aparecem aqui quando o shell protegido for liberado.
            </p>
          </article>
        </div>
        <div id="operator-action-rail" class="action-row action-rail">
          <button type="button" class="action-button" data-cockpit-action="refresh">Atualizar cockpit</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-card">Ir para sessions</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-approvals-card">Ir para approvals</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-resources-card">Ir para resources</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-companions-card">Ir para companions</button>
          <button type="button" class="action-button secondary" data-cockpit-target="session-workspace-health-card">Ir para health</button>
          <button type="button" class="action-button secondary" data-cockpit-target="ops-nodes-card">Ir para nodes</button>
          <button type="button" class="action-button secondary" data-cockpit-target="ops-transports-card">Ir para transports</button>
          <button type="button" class="action-button secondary" data-cockpit-target="ops-extensions-card">Ir para integrations</button>
          <button type="button" class="action-button secondary" data-copy="npm run cli -- status">Copiar status CLI</button>
          <button type="button" class="action-button secondary" data-copy="npm run cli -- doctor">Copiar doctor CLI</button>
        </div>
        <p id="operator-cockpit-status" class="muted-copy section-note">
          Valide o token para transformar este resumo em cockpit operacional completo.
        </p>
      </section>

      <section class="handoff-card">
        <p class="profile-tag">Agora</p>
        <h2>Melhor proximo passo</h2>
        <p id="priority-summary" class="hero-copy">
          Valide o token para ver a recomendacao oficial deste host.
        </p>
        <p id="priority-reason" class="muted-copy section-note">
          O shell usa o manifesto oficial para dizer o que fazer agora, por que este e o melhor caminho
          e o que acontece depois.
        </p>
        <div class="action-row priority-actions">
          <button
            id="priority-primary-action"
            type="button"
            class="action-button"
            hidden
          >Executar agora</button>
          <button
            id="priority-primary-copy"
            type="button"
            class="action-button"
            data-copy=""
            hidden
          >Copiar comando principal</button>
          <a id="priority-primary-open" class="action-button" href="#" hidden>Abrir agora</a>
          <button
            id="priority-secondary-copy"
            type="button"
            class="action-button secondary"
            data-copy=""
            hidden
          >Copiar rota secundaria</button>
          <a id="priority-secondary-open" class="action-button secondary" href="#" hidden>Abrir rota secundaria</a>
        </div>
        <ul id="priority-next-steps" class="handoff-list compact">
          <li>Valide o token para destravar a recomendacao oficial deste host.</li>
        </ul>
        <div class="priority-profile-grid">
          <article class="priority-profile-card">
            <p class="profile-tag">Dev</p>
            <strong id="priority-dev-summary">Ative o shell protegido para ver a rota ideal de desenvolvimento.</strong>
            <button
              id="priority-dev-action"
              type="button"
              class="action-button secondary compact-action"
              data-copy="npm run ops:go"
            >Copiar rota Dev</button>
          </article>
          <article class="priority-profile-card">
            <p class="profile-tag">Operator</p>
            <strong id="priority-operator-summary">Ative o shell protegido para ver a rota ideal de operacao.</strong>
            <button
              id="priority-operator-action"
              type="button"
              class="action-button secondary compact-action"
              data-copy="npm run ops:ready"
            >Copiar rota Operator</button>
          </article>
          <article class="priority-profile-card">
            <p class="profile-tag">Headless</p>
            <strong id="priority-headless-summary">Ative o shell protegido para ver a rota ideal de terminal.</strong>
            <button
              id="priority-headless-action"
              type="button"
              class="action-button secondary compact-action"
              data-copy="npm run cli -- status"
            >Copiar rota Headless</button>
          </article>
        </div>
      </section>

      <section id="product-command-rail-card" class="handoff-card">
        <p class="profile-tag">Trilha oficial</p>
        <h2>Comandos de produto</h2>
        <p class="muted-copy section-note">
          A mesma jornada da CLI fica aqui para operar sem procurar alias: onboard, go, chat, status e doctor.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Onboard</p>
            <strong><code>zavorth onboard</code></strong>
            <p class="muted-copy">Prepara provider, host e acesso inicial.</p>
            <button id="product-command-onboard" type="button" class="action-button secondary compact-action" data-copy="npm run onboard">Copiar onboard</button>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Go</p>
            <strong><code>zavorth go</code></strong>
            <p class="muted-copy">Abre a melhor superficie local disponivel.</p>
            <button id="product-command-go" type="button" class="action-button secondary compact-action" data-copy="npm run ops:go">Copiar go</button>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Chat</p>
            <strong><code>zavorth chat</code></strong>
            <p class="muted-copy">Entra no terminal conversacional oficial.</p>
            <button id="product-command-chat" type="button" class="action-button secondary compact-action" data-copy="npm run cli -- chat">Copiar chat</button>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Status</p>
            <strong><code>zavorth status</code></strong>
            <p class="muted-copy">Mostra a leitura curta do momento.</p>
            <button id="product-command-status" type="button" class="action-button secondary compact-action" data-copy="npm run cli -- status">Copiar status</button>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Doctor</p>
            <strong><code>zavorth doctor</code></strong>
            <p class="muted-copy">Mostra bloqueios e proximo passo claro.</p>
            <button id="product-command-doctor" type="button" class="action-button secondary compact-action" data-copy="npm run cli -- doctor">Copiar doctor</button>
          </article>
        </div>
      </section>

      <section class="handoff-card">
        <h2>Outras rotas disponiveis</h2>
        <p class="muted-copy section-note">
          Se voce nao quiser seguir a recomendacao principal, escolha o caminho que combina com o seu papel.
        </p>
        <div class="profile-grid">
          <article class="profile-card">
            <p class="profile-tag">Dev</p>
            <h3 id="alt-dev-title">Suba o runtime e valide o contrato</h3>
            <p id="alt-dev-summary">Melhor para quem esta desenvolvendo no repo oficial.</p>
            <ul id="alt-dev-steps" class="handoff-list compact">
              <li><code>npm install</code></li>
              <li><code>npm run setup</code></li>
              <li><code>npm run ops:go</code></li>
            </ul>
            <button id="alt-dev-action" type="button" class="action-button secondary compact-action" data-copy="npm run ops:go">Copiar fluxo Dev</button>
          </article>
          <article class="profile-card">
            <p class="profile-tag">Operator</p>
            <h3 id="alt-operator-title">Prepare o host e valide a malha</h3>
            <p id="alt-operator-summary">Melhor para quem vai operar nodes, channels e transportes.</p>
            <ul id="alt-operator-steps" class="handoff-list compact">
              <li><code>npm run ops:ready</code></li>
              <li><code>npm run cli:fast -- doctor --json</code></li>
              <li><code>npm run test:nodes:smoke</code></li>
            </ul>
            <button id="alt-operator-action" type="button" class="action-button secondary compact-action" data-copy="npm run ops:ready">Copiar fluxo Operator</button>
          </article>
          <article class="profile-card">
            <p class="profile-tag">Headless</p>
            <h3 id="alt-headless-title">Use o Zavorth so por terminal</h3>
            <p id="alt-headless-summary">Melhor para automacao local, REPL e operacao sem shell grafico.</p>
            <ul id="alt-headless-steps" class="handoff-list compact">
              <li><code>npm run cli -- status</code></li>
              <li><code>npm run cli:repl</code></li>
              <li><code>npm run nodes:doctor -- --json</code></li>
            </ul>
            <button id="alt-headless-action" type="button" class="action-button secondary compact-action" data-copy="npm run cli -- status">Copiar fluxo Headless</button>
          </article>
        </div>
      </section>

      <section class="handoff-card">
        <h2>Desbloquear orientacoes do runtime</h2>
        <p class="muted-copy">
          Valide o token para ver a recomendacao oficial, a jornada de instalacao e o estado remoto deste host.
          O token nao sai da maquina; ele fica apenas no navegador atual.
        </p>
        <div class="auth-row">
          <input id="runtime-auth-token" class="auth-input" type="password" placeholder="Cole o token web do Zavorth" autocomplete="off" />
          <button id="runtime-auth-validate" type="button" class="action-button">Validar token</button>
        </div>
        <p id="runtime-auth-copy" class="muted-copy">
          Dica: depois de validar, o shell carrega o manifesto oficial, a install journey e o estado do acesso remoto.
        </p>
      </section>

      <section class="handoff-card">
        <h2>Outras entradas</h2>
        <div class="action-row">
          <a id="open-external-web-client" class="action-button" hidden href="#">Abrir cliente web externo</a>
          <a id="open-external-docs" class="action-button secondary" hidden href="#">Abrir docs publicas</a>
          <a class="action-button secondary" href="/api/v1/gateway/status">Ver status publico do gateway</a>
          <a class="action-button secondary" href="/api/v1/nodes">Ver nodes em JSON</a>
        </div>
        <p id="external-web-copy" class="muted-copy">
          Configure <code>ZAVORTH_EXTERNAL_WEB_CLIENT_URL</code> quando quiser ligar um cliente web externo ao mesmo runtime.
        </p>
      </section>

      <section class="handoff-grid">
        <article class="handoff-card">
          <h2>O que fica no repo oficial</h2>
          <ul class="handoff-list">
            <li>Runtime do agente</li>
            <li>CLI e terminal oficiais</li>
            <li>API HTTP e SSE</li>
            <li>Workflows, approvals, continuidade e artefatos</li>
          </ul>
        </article>
        <article class="handoff-card">
          <h2>Como operar agora</h2>
          <ul class="handoff-list">
            <li>Entrada principal: <code>npm run ops:go</code></li>
            <li>Ready check: <code>npm run ops:ready</code></li>
            <li>CLI: <code>npm run cli -- status</code></li>
            <li>ZavorthControl web: <code>/zavorthControl</code></li>
          </ul>
        </article>
        <article class="handoff-card">
          <h2>Snapshot rapido</h2>
          <ul class="handoff-list">
            <li>Gateway: <strong id="gateway-status-detail">Verificando</strong></li>
            <li>Dominios inicializados: <strong id="gateway-domain-detail">Detectando</strong></li>
            <li>Nodes visiveis: <strong id="node-count-detail">Detectando</strong></li>
            <li>Transportes: <strong id="transport-count-detail">Detectando</strong></li>
          </ul>
        </article>
        <article class="handoff-card">
          <h2>Fronteira do produto</h2>
          <ul class="handoff-list">
            <li><code>/zavorthControl</code> = entrada principal do Zavorth web</li>
            <li><code>/satellite</code> = superficie movel/PWA quando configurada</li>
            <li><code>/api/*</code> = contrato de runtime para CLI, web e clientes futuros</li>
            <li><code>/app</code> e <code>/classic</code> = removidos; use <code>/zavorthControl</code></li>
            <li><code>zavorth-web</code> = cliente externo, quando configurado</li>
            <li>Terminal e API continuam no centro do repositorio oficial</li>
          </ul>
        </article>
      </section>

      <section class="handoff-grid">
        <article id="manifest-card" class="handoff-card">
          <h2>Entradas e superficies</h2>
          <p class="muted-copy section-note">Use este card para entender por onde cada superficie entra no produto.</p>
          <ul id="manifest-launchers" class="handoff-list">
            <li>Valide o token para ver as entradas oficiais deste host e quais superficies ja estao prontas.</li>
          </ul>
        </article>
        <article id="journey-card" class="handoff-card">
          <h2>Preparar este host</h2>
          <p id="journey-card-note" class="muted-copy section-note">Use este caminho quando o runtime local ainda nao estiver pronto ou quando este host ainda precisar trust.</p>
          <div class="action-row compact-remote-actions">
            <button id="journey-trust-action" type="button" class="action-button" hidden>Autorizar este host</button>
            <button id="journey-refresh-action" type="button" class="action-button secondary" hidden>Atualizar host</button>
          </div>
          <p id="journey-action-status" class="muted-copy section-note">Valide o token para usar as acoes do host oficial.</p>
          <ul id="install-journey" class="handoff-list">
            <li>Valide o token para ver as etapas do caminho oficial deste host.</li>
          </ul>
        </article>
        <article id="remote-card" class="handoff-card">
          <h2>Abrir acesso remoto</h2>
          <p id="remote-card-note" class="muted-copy section-note">Use este caminho quando voce quiser operar fora desta maquina ou publicar o shell remoto oficial.</p>
          <div class="action-row compact-remote-actions">
            <button id="remote-recommended-action" type="button" class="action-button" hidden>Executar proximo passo remoto</button>
            <button id="remote-verify-action" type="button" class="action-button secondary" hidden>Verificar remoto</button>
          </div>
          <p id="remote-action-status" class="muted-copy section-note">Valide o token para usar a acao guiada do remoto oficial.</p>
          <ul id="remote-access-summary" class="handoff-list">
            <li>Valide o token para ver o estado remoto oficial, o comando recomendado e os proximos passos.</li>
          </ul>
        </article>
      </section>

      <section id="automation-control-plane-card" class="handoff-card">
        <p class="profile-tag">Scheduled runs</p>
        <h2>Automations e scheduled runs</h2>
        <p class="muted-copy section-note">
          Esta leitura junta automacoes naturais, manutencao recorrente, entregas por surface e o estado dos scheduled runs em um cockpit unico.
        </p>
        <div class="ops-summary-grid">
          <article class="ops-summary-card">
            <p class="profile-tag">Automations</p>
            <strong id="automation-control-plane-state">Valide o token</strong>
            <p id="automation-control-plane-summary" class="muted-copy">
              O plano oficial de automacoes aparece aqui assim que o shell protegido for liberado.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Tasks</p>
            <strong id="automation-control-plane-tasks-state">Sem leitura</strong>
            <p id="automation-control-plane-tasks-summary" class="muted-copy">
              Agendamentos ativos, pausados e com falha recente aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Maintenance</p>
            <strong id="automation-control-plane-maintenance-state">Sem leitura</strong>
            <p id="automation-control-plane-maintenance-summary" class="muted-copy">
              A manutencao recorrente e seu proximo disparo aparecem aqui.
            </p>
          </article>
          <article class="ops-summary-card">
            <p class="profile-tag">Deliveries</p>
            <strong id="automation-control-plane-deliveries-state">Sem leitura</strong>
            <p id="automation-control-plane-deliveries-summary" class="muted-copy">
              App, email e webhook recentes aparecem como entregas supervisionadas.
            </p>
          </article>
        </div>
        <div class="action-row compact-remote-actions">
          <input id="automation-control-plane-intent" type="text" class="field-input compact-inline-input" placeholder="Ex.: todo dia as 9h verifique meus canais no app" />
          <button id="automation-control-plane-create-action" type="button" class="action-button" hidden>Criar automacao</button>
          <button id="automation-control-plane-refresh-action" type="button" class="action-button secondary compact-action" hidden>Atualizar Scheduled runs</button>
          <button id="automation-control-plane-maintenance-on-action" type="button" class="action-button secondary compact-action" hidden>Ligar maintenance</button>
          <button id="automation-control-plane-maintenance-off-action" type="button" class="action-button secondary compact-action" hidden>Desligar maintenance</button>
          <button id="automation-control-plane-maintenance-run-action" type="button" class="action-button secondary compact-action" hidden>Rodar maintenance</button>
          <button id="automation-control-plane-copy-command" type="button" class="action-button secondary compact-action" data-copy="npm run ops:automations">Copiar ops:automations</button>
        </div>
        <p id="automation-control-plane-status" class="muted-copy section-note">
          Valide o token para criar automacoes, revisar deliveries e operar maintenance.
        </p>
        <div class="system-overlord-detail-grid">
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Acoes sugeridas</p>
            <ul id="automation-control-plane-actions" class="handoff-list compact">
              <li>Valide o token para revisar o proximo passo das automacoes.</li>
            </ul>
          </article>
          <article class="system-overlord-detail-card">
            <p class="profile-tag">Tasks</p>
            <ul id="automation-control-plane-tasks" class="handoff-list compact">
              <li>Valide o token para ver os scheduled runs deste host.</li>
            </ul>`;
}
