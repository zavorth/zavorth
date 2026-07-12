import{E as e,O as t,S as n,T as r,k as i,n as a,t as o,y as s}from"./runtime-control-XEkF-GlD.js";var c=`zavorth.zavorthControl.webToken`;function l(){try{return String(sessionStorage.getItem(c)||``).trim()}catch{return``}}async function u(e,t={}){let n=l(),r=await fetch(e,{...t,headers:{Accept:`application/json`,...t.body?{"Content-Type":`application/json`}:{},...n?{"X-Zavorth-Token":n}:{},...t.headers||{}}}),i=await r.json().catch(()=>null);if(!r.ok){let t=Error(o(i,`${e} returned HTTP ${r.status}`));throw t.status=r.status,t}return i}function d(e){return e&&e.ok===!0&&`data`in e?e.data:e}function f(e){let t=Number(e||0);return Number.isFinite(t)?String(t):`0`}function p(e){let t=Number(e||0);return!Number.isFinite(t)||t<=0?`draft`:`${Math.round(t*100)}%`}function m(e={}){return(e.quarantined||0)>0?{label:`Needs review`,tone:`warn`}:(e.pending||0)>0?{label:`Review ready`,tone:`info`}:(e.promoted||0)>0||(e.approved||0)>0?{label:`Learning active`,tone:`ok`}:{label:`Idle`,tone:`muted`}}function h(e){let t=e.slice(0,8);return t.length===0?`<div class="learning-empty"><strong>No candidates</strong></div>`:t.map(e=>{let t=String(e.lifecycle||e.reviewState||`draft`).replace(/_/g,` `),n=e.reviewState!==`rejected`&&e.lifecycle!==`trusted_local`&&e.lifecycle!==`published`?`promote`:`approve`;return`
      <article class="learning-candidate" data-learning-candidate="${s(e.id)}">
        <div class="learning-candidate__main">
          <span>${s(e.kind||`learning`)}</span>
          <strong>${s(e.title||`Candidate`)}</strong>
          <p>${s(e.summary||e.source?.objective||``)}</p>
        </div>
        <div class="learning-candidate__side">
          <small>${s(p(e.score))}</small>
          <em>${s(t)}</em>
          <div class="learning-candidate__actions">
            <button type="button" data-learning-action="${n}" data-learning-id="${s(e.id)}">Apply</button>
            <button type="button" data-learning-action="reject" data-learning-id="${s(e.id)}">Forget</button>
          </div>
        </div>
      </article>
    `}).join(``)}function g(e,t,n){let r=t.learning?.summary||t.summary||{},i=m(r),a=Array.isArray(t.learning?.candidates)?t.learning?.candidates||[]:Array.isArray(t.data)?t.data:[],o=t.generatedAt?new Date(t.generatedAt).toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`}):`now`;e.innerHTML=`
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">${s(i.label)}</span>
          <h1>Learning</h1>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>
      </section>
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Learning summary">
        <article class="daily-metric"><span>Pending</span><strong>${f(r.pending)}</strong><small>review</small></article>
        <article class="daily-metric"><span>Trusted</span><strong>${f(r.promoted)}</strong><small>applied</small></article>
        <article class="daily-metric"><span>Hooks</span><strong>${f(r.fromHooks)}</strong><small>signals</small></article>
      </section>

      <section class="daily-panel learning-review" aria-label="Learning candidates">
        <div class="daily-panel__head">
          <div><span>Queue</span><h2>Candidates</h2></div>
          <small class="daily-muted">${s(o)}</small>
        </div>
        <div class="learning-candidates" data-learning-candidates>
          ${h(a)}
        </div>
      </section>
    </div>
  `}function _(e,t){e.innerHTML=`
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">Locked</span>
          <h1>Learning</h1>
          <p>${s(String(t?.message||`Token required.`))}</p>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Help me unlock the local Zavorth dashboard token safely.">Unlock</button>
      </section>
    </div>
  `}async function v(e){e.innerHTML=`
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">Learning</span>
          <h1>Learning</h1>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>
      </section>
      <div class="learning-loading">Loading candidates…</div>
    </div>
  `;try{let[t,n]=await Promise.all([u(`/api/web/learning-dreams`),Promise.resolve(null)]);g(e,d(t),n?d(n):void 0)}catch(t){let n=Number(t?.status||0);if(n===401||n===403){_(e,t);return}g(e,{generatedAt:new Date().toISOString(),summary:{total:0,pending:0,approved:0,rejected:0,promoted:0,published:0,quarantined:0,highConfidence:0},data:[]}),window.emitSignal?.(`info`,`Learning`,String(t?.message||`Warming up.`))}}async function y(e,t,n){let r=e.querySelector(`[data-learning-id="${CSS.escape(t)}"][data-learning-action="${CSS.escape(n)}"]`);r&&(r.disabled=!0);try{await u(`/api/web/learning-dreams/action`,{method:`POST`,body:JSON.stringify({candidateId:t,actionId:n})}),window.emitSignal?.(`info`,`Learning updated`,n===`reject`?`The candidate was forgotten.`:`The candidate was reviewed.`),await v(e)}catch(e){window.emitSignal?.(`error`,`Learning action failed`,String(e?.message||`Try again.`)),r&&(r.disabled=!1)}}function b(){let e=document.querySelector(`[data-learning-dreams-root]`);if(!e)return;let t=()=>{document.getElementById(`sector-dreams`)?.classList.contains(`active`)&&v(e).catch(()=>void 0)};document.querySelectorAll(`[data-sector="dreams"], [data-drawer-sector="dreams"]`).forEach(e=>{e.addEventListener(`click`,()=>{window.setTimeout(t,40)})}),e.addEventListener(`click`,t=>{let n=t.target;if(n?.closest(`[data-learning-refresh]`)){v(e).catch(()=>void 0);return}let r=n?.closest(`[data-learning-action]`);if(!r)return;let i=r.getAttribute(`data-learning-id`)||``,a=r.getAttribute(`data-learning-action`)||``;i&&a&&y(e,i,a).catch(()=>void 0)}),t()}function x(e=document){let t=e.querySelector(`#sector-nodes`)||e,n=t.querySelector(`[data-memory-search]`),r=t.querySelector(`[data-memory-list]`);if(!r)return;let i=String(n?.value||``).trim().toLowerCase();r.querySelectorAll(`[data-memory-item]`).forEach(e=>{let t=String(e.getAttribute(`data-memory-search-text`)||e.textContent||``).toLowerCase();e.hidden=!!i&&!t.includes(i)})}function S(e=document){document.documentElement.dataset.zavorthMemoryBrowserBound!==`1`&&(document.documentElement.dataset.zavorthMemoryBrowserBound=`1`,document.addEventListener(`input`,t=>{(t.target instanceof Element?t.target:null)?.matches?.(`[data-memory-search]`)&&x(e)}),document.addEventListener(`click`,t=>{(t.target instanceof Element?t.target:null)?.closest?.(`[data-memory-search-run]`)&&(t.preventDefault(),x(e))}),x(e))}var C=[{pattern:/\b(delete|remove|rm\b|unlink|drop)\b/i,gate:`destructive`,reason:`would require approval`},{pattern:/\b(write|edit|patch|overwrite|save to|modify file)\b/i,gate:`write`,reason:`would require approval`},{pattern:/\b(network|http|fetch|download|upload|webhook|api call)\b/i,gate:`network`,reason:`would require approval`},{pattern:/\b(shell|terminal|exec|command|powershell|bash|cmd)\b/i,gate:`shell`,reason:`would require approval`},{pattern:/\b(install|npm i|pip install|deploy|sudo)\b/i,gate:`install`,reason:`would require approval`},{pattern:/\b(send|email|message|post to|publish)\b/i,gate:`outbound`,reason:`would require approval`},{pattern:/\b(payment|transfer|transaction|wire)\b/i,gate:`money`,reason:`would require approval`}];function w(e){let t=String(e||``).trim();if(!t)return[];let n=[],r=new Set;for(let e of C)!e.pattern.test(t)||r.has(e.gate)||(r.add(e.gate),n.push({gate:e.gate,reason:e.reason}));return n.length===0&&n.push({gate:`read`,reason:`likely allowed (no write/delete/network/shell signals)`}),n}function T(e,t){let n=e.querySelector(`[data-policy-sim-results]`);if(n){if(t.length===0){n.innerHTML=`<li class="daily-muted">Enter a prompt.</li>`;return}n.innerHTML=t.map(e=>`<li><strong>${E(e.gate)}</strong> — ${E(e.reason)}</li>`).join(``)}}function E(e){return String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function D(e=document){let t=e.querySelectorAll(`[data-policy-simulator]`);t.length&&t.forEach(e=>{if(e.dataset.policySimBound===`1`)return;e.dataset.policySimBound=`1`;let t=()=>{let t=e.querySelector(`[data-policy-sim-input]`);T(e,w(String(t?.value||``).trim()))};e.querySelector(`[data-policy-sim-run]`)?.addEventListener(`click`,e=>{e.preventDefault(),t()}),e.querySelector(`[data-policy-sim-input]`)?.addEventListener(`keydown`,e=>{e.key===`Enter`&&(e.preventDefault(),t())})})}var O=t(`model-pref`),k=`/api/providers/preference`;async function A(){let e=await fetch(k);if(!e.ok)throw Error(`Failed to fetch model preference: ${e.status}`);return e.json()}async function j(e){let t=await fetch(k,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)});if(!t.ok){let e=await t.json().catch(()=>({}));throw Error(e?.error||`Failed to update model preference: ${t.status}`)}return t.json()}function M(e){let t=new FormData(e),n=String(t.get(`channelId`)||``).trim();return{providerId:String(t.get(`providerId`)||``).trim(),modelId:String(t.get(`modelId`)||``).trim()||null,secondaryModelId:String(t.get(`secondaryModelId`)||``).trim()||null,routeId:String(t.get(`routeId`)||``).trim()||null,channelId:n||null,setChannel:!!n}}function N(t,n,r,i=``){t.hidden=!1,t.innerHTML=`
    <div class="daily-route-result__head">
      <strong>${s(e(n))}</strong>
      <button class="cron-action-btn" type="button" id="btn-clear-pref-result">${s(e(`Clear`))}</button>
    </div>
    <div>${r}</div>
    ${i?`<span class="daily-route-result__meta">${i}</span>`:``}
  `}function P(t){if(document.documentElement.dataset.modelPrefBound===`1`)return;let n=document.getElementById(`model-preference-form`),r=document.getElementById(`pref-result-panel`);!n||!r||(document.documentElement.dataset.modelPrefBound=`1`,A().then(e=>{let t=e?.preference||{},n={"pref-provider":t.providerId,"pref-model":t.modelId,"pref-secondary-model":t.secondaryModelId,"pref-route":t.routeId,"pref-channel":e?.channel?.channelId};Object.entries(n).forEach(([e,t])=>{let n=document.getElementById(e);n&&(n.value=t==null||t===``?``:String(t))})}).catch(t=>{O.error(`failed to load initial preference`,t),i(e(`Model preference`),t instanceof Error?t.message:e(`Could not load the saved model preference.`),`info`)}),n.addEventListener(`submit`,async a=>{a.preventDefault();let o=M(n);if(o.providerId)try{let n=await j({...o,confirm:!0,dryRun:!1,directWrite:!0});N(r,`Route saved`,`<p>
          ${s(e(`Primary provider`))}: <strong>${s(n.preference?.providerId||`none`)}</strong><br/>
          ${s(e(`Primary model`))}: <strong>${s(n.preference?.modelId||`none`)}</strong><br/>
          ${s(e(`Secondary model`))}: <strong>${s(n.preference?.secondaryModelId||`none`)}</strong><br/>
          ${s(e(`Primary channel`))}: <strong>${s(n.channel?.channelId||o.channelId||`none`)}</strong>
        </p>`,`${s(e(`Source`))}: ${s(n.source||n.receipt?.id||`preference`)}`),t()}catch(t){let n=t instanceof Error?t.message:String(t);O.error(`failed to save preference`,t),i(e(`Model preference`),n),N(r,`Route not saved`,`<p>${s(n)}</p>`)}}),document.getElementById(`btn-preview-pref`)?.addEventListener(`click`,async()=>{let t=M(n);if(t.providerId)try{let n=await j({...t,confirm:!1,dryRun:!0}),i=n.receipt?.decision||n.decision||`unknown`;N(r,`Route preview`,`<p class="mono">
          ${s(e(`Provider`))}: <strong>${s(n.request?.providerId||`none`)}</strong><br/>
          ${s(e(`Model`))}: <strong>${s(n.request?.modelId||`none`)}</strong><br/>
          ${s(e(`Decision`))}: <strong>${s(i)}</strong><br/>
          ${s(e(`Approval`))}: <strong>${s(n.receipt?.approval?.satisfied?`satisfied`:`pending`)}</strong>
        </p>`,s(n.nextAction||e(`Preview ready.`)))}catch(t){let n=t instanceof Error?t.message:String(t);O.error(`failed to preview preference`,t),i(e(`Model preference`),n),N(r,`Preview unavailable`,`<p>${s(n)}</p>`)}}),document.addEventListener(`click`,e=>{e.target.closest(`#btn-clear-pref-result`)&&(r.hidden=!0,r.innerHTML=``)}))}var F=[{id:`openai`,label:`OpenAI`,models:[`gpt-4o`,`gpt-4o-mini`,`gpt-4.1`],onboardingId:`openai`},{id:`anthropic`,label:`Anthropic`,models:[`claude-sonnet-4-20250514`,`claude-3-5-haiku-latest`],onboardingId:`anthropic`},{id:`gemini`,label:`Google Gemini`,models:[`gemini-2.5-flash`,`gemini-2.5-pro`],onboardingId:`google`},{id:`openrouter`,label:`OpenRouter`,models:[`openrouter/auto`],onboardingId:`openrouter`},{id:`ollama`,label:`Ollama (local)`,models:[`llama3.2`,`qwen2.5`],onboardingId:`ollama`},{id:`xai`,label:`xAI`,models:[`grok-2`],onboardingId:`xai`},{id:`deepseek`,label:`DeepSeek`,models:[`deepseek-chat`],onboardingId:`deepseek`},{id:`mistral`,label:`Mistral`,models:[`mistral-large-latest`],onboardingId:`mistral`},{id:`groq`,label:`Groq`,models:[`llama-3.3-70b-versatile`],onboardingId:`groq`},{id:`custom-openai-compatible`,label:`Custom (OpenAI-compatible)`,models:[],onboardingId:`custom`}],I=[{id:`desktop`,label:`Desktop`,surface:`local`},{id:`cli`,label:`CLI / Code`,surface:`local`},{id:`control`,label:`Control`,surface:`local`},{id:`discord`,label:`Discord`,surface:`external`},{id:`slack`,label:`Slack`,surface:`external`},{id:`telegram`,label:`Telegram`,surface:`external`},{id:`whatsapp`,label:`WhatsApp`,surface:`external`}];function L(){return F.slice()}function R(){return I.slice()}function z(){e(`sector-overview`,`
    <div class="daily-page daily-page--work dashboard-glass" data-zavorth-premium-dashboard-v2>
      ${u(`Work`,``,`
        <button class="daily-button daily-button--primary" type="button" data-dashboard-sector="terminal">Open chat</button>
        <button class="daily-button" type="button" data-dashboard-sector="sales-os">Review</button>
        <button class="daily-button" type="button" data-dashboard-sector="instances">Proof</button>
        <button class="daily-button" type="button" data-dashboard-doctor>Doctor</button>
      `)}
      <section class="next-action-host" data-next-action aria-label="Next action"></section>
      <div class="trust-loop-chrome-host" data-trust-loop-chrome-host aria-label="Trust Loop status"></div>
      <section class="daily-panel daily-panel--attention" aria-label="Attention">
        <div class="daily-panel__head">
          <div><span>Attention</span><h2 data-dashboard-approval-title>Nothing needs you</h2></div>
          <button class="daily-button daily-button--primary" type="button" data-dashboard-sector="sales-os">Review</button>
        </div>
        <div data-attention-list class="daily-list">
          <p class="daily-muted">Nothing needs you</p>
        </div>
      </section>
      <section class="daily-action-row" aria-label="Primary actions">
        <button type="button" data-dashboard-sector="terminal">New chat</button>
        <button type="button" data-dashboard-sector="sales-os">Review</button>
        <button type="button" data-dashboard-sector="instances">Proof</button>
        <button type="button" data-dashboard-doctor>Doctor</button>
        <button type="button" data-dashboard-sector="channels">Channels</button>
        <button type="button" data-dashboard-sector="usage">Models</button>
      </section>
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Work status">
        ${d(`Status`,`<span data-live-runtime-state>Ready</span>`,`<span data-live-runtime-detail>Idle</span>`)}
        ${d(`Approvals pending`,`<span data-sales-os-metric="approvals">0</span>`,`<span data-sales-os-meta="approvals">None</span>`)}
        ${d(`Receipts`,`<span data-dashboard-metric="receipts">0</span>`,`<span data-inbox-metric="receipts">0</span>`)}
        ${d(`Errors`,`<span data-dashboard-metric="errors">0</span>`,`Trace`)}
        ${d(`Trust`,`<span class="session-trust-score" data-session-trust-score><strong data-session-trust-value>—</strong> <span data-session-trust-label></span></span>`,`Session`)}
      </section>
      <section class="workboard-lite" data-workboard-lite aria-label="Workboard">
        <div class="workboard-lite__col" data-workboard-col="pending">
          <h3>Pending</h3>
          <ul data-workboard-list="pending"><li class="daily-muted">—</li></ul>
        </div>
        <div class="workboard-lite__col" data-workboard-col="running">
          <h3>Running</h3>
          <ul data-workboard-list="running"><li class="daily-muted">—</li></ul>
        </div>
        <div class="workboard-lite__col" data-workboard-col="done">
          <h3>Done</h3>
          <ul data-workboard-list="done"><li class="daily-muted">—</li></ul>
        </div>
      </section>
      <div class="agent-os-live-summary" hidden aria-hidden="true">Runtime summary is available to the live bridge.</div>
      <section class="daily-layout daily-layout--main" aria-label="Work overview">
        <article class="daily-panel daily-panel--primary">
          <div class="daily-panel__head">
            <div>
              <span>Now</span>
              <h2 data-dashboard-runtime-title>No task running</h2>
            </div>
            <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
          </div>
          <p class="daily-muted" data-dashboard-runtime-text>Ready.</p>
          <div class="zavorth-gantt-chart" data-dashboard-timeline aria-label="Runtime trace timeline">
            <div class="zavorth-gantt-empty">
              <span class="zavorth-gantt-empty-dot"></span>
              <span>No trace yet.</span>
            </div>
          </div>
          <details class="daily-disclosure daily-disclosure--quiet">
            <summary>Logs</summary>
            <div class="zavorth-console-panel daily-console">
              <div class="zavorth-console-header">
                <span class="zavorth-console-dot"></span>
                <span class="zavorth-console-title">Live log</span>
                <button class="zavorth-console-clear" type="button">Clear</button>
              </div>
              <div class="zavorth-console-body" id="zavorth-console-events">
                <div class="zavorth-console-line zavorth-console-line--system">
                  <span class="zavorth-console-time">[00:00]</span>
                  <span class="zavorth-console-tag">[SESSION]</span>
                  <span class="zavorth-console-text">Dashboard connected.</span>
                </div>
              </div>
            </div>
          </details>
        </article>
        <aside class="daily-stack">
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>System</span><h2>Connection</h2></div></div>
            <div class="daily-key-value">
              ${f(`Runtime`,`<span data-live-runtime-state>Ready</span>`)}
              ${f(`Gateway`,`<span data-live-gateway-state>Local</span>`)}
              ${f(`Route`,`<span data-live-gateway-detail>Web</span>`)}
              ${f(`Sync`,`<span data-live-sync-detail>Starting</span>`)}
              ${f(`Mode`,`<span data-runtime-engine-active>Lite</span>`)}
            </div>
            <p class="daily-muted" hidden data-dashboard-approval-text>Nothing pending.</p>
          </article>
          <article class="daily-panel" data-policy-simulator>
            <div class="daily-panel__head"><div><span>Policy</span><h2>Simulator</h2></div></div>
            <div class="policy-sim-row">
              <input type="text" data-policy-sim-input placeholder="What if I ask..." aria-label="Policy what-if prompt" autocomplete="off">
              <button class="daily-button" type="button" data-policy-sim-run>Simulate</button>
            </div>
            <ul class="policy-sim-results" data-policy-sim-results>
              <li class="daily-muted">Predicted gates appear here.</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  `),e(`sector-channels`,`
    <div class="daily-page">
      ${u(`Channels`,``,`<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Connect a channel. Show only missing credentials and the next setup step.">Connect</button><button class="daily-button" type="button" data-dashboard-prompt="Test configured channels and show only failures or missing credentials.">Test</button>`)}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Channel status">
        ${d(`Connected`,`Local`,`Web / terminal`)}
        ${d(`Remote`,`Optional`,`Token / webhook`)}
        ${d(`Last message`,`None`,`—`)}
      </section>
      <section class="daily-panel daily-panel--list daily-panel--flush">
        <div class="daily-panel__head">
          <div><span>Channels</span><h2>Routes</h2></div>
        </div>
        <div class="daily-list daily-list--compact">
          ${p(`Dashboard`,`Local`,`Ready`,`ok`,`Open`,`Test`,`Open the local dashboard chat.`)}
          ${p(`Telegram`,`Bot token`,`Set up`,`warn`,`Connect`,`Test`,`Connect Telegram. Show only missing credentials.`)}
          ${p(`Discord`,`Bot / app`,`Set up`,`warn`,`Connect`,`Test`,`Connect Discord. Show only missing credentials.`)}
          ${p(`Slack`,`Workspace`,`Set up`,`warn`,`Connect`,`Test`,`Connect Slack. Show only missing credentials.`)}
          ${p(`WhatsApp`,`Bridge`,`Set up`,`warn`,`Connect`,`Test`,`Connect WhatsApp. Show only missing credentials.`)}
          ${p(`Email`,`Mailbox`,`Set up`,`warn`,`Connect`,`Test`,`Connect email. Show only missing credentials.`)}
          ${p(`Signal`,`Bridge`,`Set up`,`warn`,`Connect`,`Test`,`Connect Signal. Show only missing credentials.`)}
          ${p(`Teams`,`App`,`Set up`,`warn`,`Connect`,`Test`,`Connect Teams. Show only missing credentials.`)}
        </div>
      </section>
    </div>
  `),e(`sector-sales-os`,`
    <div class="daily-page">
      ${u(`Approvals`,``,`<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Show pending approvals with approve, reject and limit controls.">Review</button>`)}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Approval status">
        ${d(`Pending`,`<span data-sales-os-metric="approvals">0</span>`,`<span data-sales-os-meta="approvals">None</span>`)}
      </section>
      <section class="daily-panel daily-panel--primary">
        <div class="daily-panel__head">
          <div><span>Queue</span><h2 data-dashboard-approval-title>No decision waiting</h2></div>
          <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
        </div>
        <div data-approvals-queue class="daily-list">
          <p class="daily-muted" data-dashboard-approval-text>Nothing pending.</p>
          <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
        </div>
      </section>
    </div>
  `),e(`sector-instances`,`
    <div class="daily-page">
      ${u(`Receipts`,``,`
        <button class="daily-button daily-button--primary" type="button" data-export-receipts data-dashboard-prompt="Export recent receipts and run history.">Export</button>
        <button class="daily-button" type="button" data-dashboard-sector="terminal">Open chat</button>
      `)}
      <div data-trust-loop-host class="trust-loop-host" aria-live="polite"></div>
      <section class="daily-panel daily-panel--primary">
        <div class="daily-panel__head">
          <div><span>History</span><h2 data-history-title>No completed work yet</h2></div>
        </div>
        <p class="daily-muted" data-history-summary hidden></p>
        <div class="data-table-wrap" data-receipts-list>
          <table class="data-table">
            <thead>
              <tr><th>Item</th><th>Source</th><th>Artifacts</th><th>Decision</th><th>Updated</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td class="mono">none yet</td><td>Web</td><td>0</td><td>—</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `),e(`sector-sessions`,`
    <div class="daily-page">
      ${u(`Sessions`,``,`<button class="daily-button daily-button--primary" type="button" data-dashboard-sector="terminal">Open chat</button>`)}
      <section class="daily-toolbar" aria-label="Session filters">
        <input type="search" placeholder="Search sessions" aria-label="Search sessions" data-session-search>
      </section>
      <section class="daily-panel daily-panel--flush">
        <div class="data-table-wrap">
          <table class="data-table" data-sessions-table>
            <thead>
              <tr><th>Session</th><th>Channel</th><th>Events</th><th>Receipts</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td class="mono">main</td><td>Web</td><td>0</td><td>0</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `),e(`sector-usage`,`
    <div class="daily-page">
      ${u(`Models`,``,`<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Test the active provider route with a sanitized request.">Test route</button>`)}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Model status">
        ${d(`Active route`,`Auto`,`<span data-provider-picker="active">Configured</span>`)}
        ${d(`Fallbacks`,`<span data-provider-picker="fallbacks">Live</span>`,`Ready routes`)}
        ${d(`Proof`,`<span data-provider-picker="proof">Sanitized</span>`,`Redacted`)}
      </section>
      <section class="daily-panel daily-panel--list daily-panel--flush">
        <div class="daily-panel__head">
          <div><span>Catalog</span><h2>Routes</h2></div>
          <button class="daily-button" type="button" data-dashboard-prompt="Show the active model route, fallback, and anything that still needs setup.">Details</button>
        </div>
        <div class="daily-provider-summary" data-provider-model-catalog-summary>
          <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
          <div class="info-row"><span class="info-row__label">Ready</span><span class="info-row__value mono">loading</span></div>
          <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
          <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
        </div>
        <div class="daily-card-feed" data-provider-model-catalog-list></div>
      </section>
    </div>
  `),e(`sector-agents`,`
    <div class="daily-page runtime-adapter-dashboard">
      ${u(`Agents`,`Use local runtime adapters through governed policies.`,`<button class="daily-button daily-button--primary" type="button" data-runtime-adapter-action="refresh">Sync</button>`)}
      <section class="daily-stat-row" aria-label="Runtime adapter status">
        ${d(`Profiles`,`<span data-runtime-adapter-metric="profiles">0</span>`,`<span data-runtime-adapter-meta="profiles">registered</span>`)}
        ${d(`Live`,`<span data-runtime-adapter-metric="live">0</span>`,`<span data-runtime-adapter-meta="live">approval gated</span>`)}
        ${d(`Sandbox`,`<span data-runtime-adapter-metric="sandbox">0</span>`,`<span data-runtime-adapter-meta="sandbox">isolated</span>`)}
        ${d(`Receipt`,`<span data-runtime-adapter-metric="receipt">none</span>`,`<span data-runtime-adapter-meta="receipt">latest</span>`)}
      </section>
      <section class="daily-layout daily-layout--main">
        <article class="daily-panel daily-panel--primary">
          <div class="daily-panel__head">
            <div><span>Profiles</span><h2>Registered helpers</h2></div>
            <button class="daily-button" type="button" data-runtime-adapter-action="refresh">Refresh</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Adapter</th>
                  <th>Sandbox</th>
                  <th>Live</th>
                  <th>Receipt</th>
                  <th>Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr><td class="mono">none</td><td>waiting</td><td>not declared</td><td>disabled</td><td>none</td><td>register first</td></tr>
              </tbody>
            </table>
          </div>
          <div class="card-grid card-grid--quiet" data-runtime-adapter-grid hidden></div>
        </article>
        <aside class="daily-stack">
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Register</span><h2>New helper</h2></div></div>
            <form class="runtime-adapter-form" data-runtime-adapter-register-form>
              <label><span>Id</span><input name="id" type="text" placeholder="local-helper"></label>
              <label><span>Label</span><input name="label" type="text" placeholder="Local helper"></label>
              <div class="runtime-adapter-form__row">
                <label><span>Adapter</span><select name="adapter"><option value="cli">CLI</option><option value="http">HTTP</option><option value="acp">ACP</option><option value="mcp">MCP</option></select></label>
                <label><span>Prompt</span><select name="promptMode"><option value="stdin">stdin</option><option value="arg">arg</option><option value="json">json</option></select></label>
              </div>
              <label><span>Command</span><input name="command" type="text" placeholder="agent"></label>
              <label><span>Root</span><input name="root" type="text" placeholder="C:\\project"></label>
              <button class="daily-button daily-button--wide" type="button" data-runtime-adapter-action="register">Register</button>
            </form>
          </article>
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Run</span><h2>Preview first</h2></div></div>
            <div class="runtime-adapter-console">
              <label><span>Profile</span><select data-runtime-adapter-profile-select><option value="">No profile registered</option></select></label>
              <label><span>Prompt</span><textarea data-runtime-adapter-prompt rows="3" placeholder="Ask the helper to inspect this workspace."></textarea></label>
              <label class="runtime-adapter-check"><input data-runtime-adapter-approve-execution type="checkbox"> <span>Approve this run</span></label>
              <div class="runtime-adapter-actions">
                <button type="button" data-runtime-adapter-action="preview">Preview</button>
                <button type="button" data-runtime-adapter-action="invoke">Run</button>
              </div>
            </div>
          </article>
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Receipt</span><h2 data-runtime-adapter-receipt-status>none</h2></div></div>
            <div class="runtime-adapter-receipt">
              <span data-runtime-adapter-receipt-profile>no profile</span>
              <p data-runtime-adapter-receipt-summary>No receipt has been written yet.</p>
              <code data-runtime-adapter-receipt-command>waiting for next action</code>
            </div>
          </article>
        </aside>
      </section>
    </div>
  `),e(`sector-skills`,`
    <div class="daily-page">
      ${u(`Skills`,`Enable and use installed capabilities.`,`<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Suggest the best Zavorth skill for my current task and explain the risk before using it.">Suggest</button>`)}
      <section class="daily-toolbar skill-toolbar skill-toolbar--quiet">
        <input type="search" placeholder="Search skills" aria-label="Search skills" data-skill-search>
        <button type="button" class="is-active" data-skill-filter="all">All</button>
        <button type="button" data-skill-filter="ready">Ready</button>
        <button type="button" data-skill-filter="setup">Set up</button>
        <button type="button" data-skill-filter="approval">Approval</button>
      </section>
      <section class="daily-panel daily-panel--list">
        <div class="daily-panel__head">
          <div><span>Installed</span><h2>5 skills</h2></div>
          <small class="daily-muted"><span data-tools-live-ready>0 ready</span></small>
        </div>
        <section class="premium-skill-list premium-skill-list--quiet">
          ${g(`Review workspace`,`Ready`,`Reads the project and highlights risks without editing files.`,`ok`,`ready`,`Review my workspace in read-only mode and show the highest-risk items first.`)}
          ${g(`Understand files`,`Needs scope`,`Uses only approved folders to explain documents.`,`info`,`setup`,`Show me how to configure a safe folder scope for file memory.`)}
          ${g(`Tool curator`,`Preview`,`Suggests improvements before anything changes.`,`info`,`approval`,`Open the tool curator in preview mode and show only safe suggestions.`)}
          ${g(`Transactions`,`Simulation`,`Previews and audits transactions; real money stays blocked.`,`warn`,`approval`,`Simulate a transaction and list risks without executing anything real.`)}
          ${g(`Connect adapter`,`Consent`,`Creates a profile only from a path you provide.`,`info`,`approval`,`Explain how to connect an runtime adapter with consent and a limited scope.`)}
        </section>
      </section>
    </div>
  `),e(`sector-nodes`,`
    <div class="daily-page">
      ${u(`Memory`,``,`<button class="daily-button daily-button--primary" type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>`)}
      <section class="daily-panel daily-panel--search">
        <input type="search" placeholder="Search memory" aria-label="Search memory" data-memory-search>
        <button class="daily-button" type="button" data-memory-search-run data-prompt="Search Zavorth memory for the typed topic and show provenance.">Search</button>
      </section>
      <section class="daily-action-row" aria-label="Memory actions">
        <button type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>
        <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
        <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
      </section>
      <section class="daily-panel daily-panel--list daily-panel--flush" aria-label="Memory browser">
        <div class="daily-panel__head"><div><span>Mnemos</span><h2>Facts</h2></div></div>
        <ul class="memory-browser-list" data-memory-list>
          <li class="memory-browser-item" data-memory-item data-memory-search-text="facts provenance trust vault">
            <strong>Facts</strong><span>Provenance / trust</span>
            <div class="memory-browser-actions">
              <button type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>
              <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
              <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
            </div>
          </li>
          <li class="memory-browser-item" data-memory-item data-memory-search-text="recall local search mnemos fts">
            <strong>Recall</strong><span>Local search</span>
            <div class="memory-browser-actions">
              <button type="button" data-prompt="Recall useful memory with provenance.">Search</button>
              <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
              <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
            </div>
          </li>
          <li class="memory-browser-item" data-memory-item data-memory-search-text="folders workspaces scope">
            <strong>Folders</strong><span>Allowed scope</span>
            <div class="memory-browser-actions">
              <button type="button" data-prompt="Show trusted folder scopes for memory.">Search</button>
              <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
              <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
            </div>
          </li>
        </ul>
      </section>
      <section class="daily-layout daily-layout--main">
        <article class="daily-panel daily-panel--primary">
          <div class="daily-panel__head">
            <div><span>Scopes</span><h2>Active memory</h2></div>
          </div>
          <div class="zavorth-memory-mesh-panel">
            <div id="zavorth-memory-tree" class="zavorth-memory-tree">
              <div class="zavorth-memory-scope-list" role="list" aria-label="Memory scopes">
                <button class="zavorth-mem-node is-inspected" id="mem-node-vault" type="button"><strong>Facts</strong><span>Provenance and trust</span></button>
                <button class="zavorth-mem-node" id="mem-node-recall" type="button"><strong>Recall</strong><span>Local search</span></button>
                <button class="zavorth-mem-node" id="mem-node-workspaces" type="button"><strong>Folders</strong><span>Allowed scope</span></button>
                <button class="zavorth-mem-node" id="mem-node-agents" type="button"><strong>Agents</strong><span>Consented links</span></button>
                <button class="zavorth-mem-node" id="mem-node-environments" type="button"><strong>Execution</strong><span>Safety boundary</span></button>
              </div>
            </div>
            <div id="zavorth-memory-inspection-panel" class="zavorth-memory-inspection-panel">
              <div class="zavorth-memory-inspection-header">
                <span class="zavorth-memory-inspection-dot"></span>
                <span>Inspector</span>
              </div>
              <div class="zavorth-memory-inspection-body" id="zavorth-memory-inspection-body">
                <div class="zavorth-memory-inspection-empty">
                  <span>Select a scope</span>
                </div>
              </div>
            </div>
          </div>
        </article>
        <aside class="daily-stack">
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Status</span><h2>Memory</h2></div></div>
            <div class="daily-key-value">
              ${f(`File memory`,`<span data-memory-live-files>Configurable</span>`)}
              ${f(`Linked agents`,`<span data-memory-live-agents>0</span>`)}
              ${f(`Execution`,`<span data-memory-live-env>Approval gated</span>`)}
            </div>
          </article>
          <article class="daily-panel">
            <div class="daily-panel__head"><div><span>Pairing</span><h2>Trusted device</h2></div></div>
            <button class="daily-button daily-button--wide" id="zavorth-otp-generate-btn" type="button">Generate key</button>
            <div class="zavorth-otp-display" id="zavorth-otp-key-display" style="display: none;">
              <span class="zavorth-otp-code" id="zavorth-otp-code-val">000-000</span>
              <span class="zavorth-otp-timer" id="zavorth-otp-timer-val">Expires in 60s</span>
            </div>
            <div class="zavorth-pairing-status" id="zavorth-otp-status" style="display: none;">
              <span class="zavorth-pairing-status-dot"></span>
              <span id="zavorth-otp-status-text">Ready to pair.</span>
            </div>
          </article>
        </aside>
      </section>
    </div>
  `),e(`sector-dreams`,`
    <div class="daily-page learning-page" data-learning-dreams-root>
      ${u(`Learning`,``,`<button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>`)}
      <div class="learning-loading">Loading candidates…</div>
    </div>
  `),e(`sector-canvas`,`
    <div class="daily-page z-canvas-page">
      ${u(`Canvas`,`Preview UI, diffs and sandbox output before applying changes.`,`<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Open Z-Canvas for the current request and show preview, diff, logs and risks before applying anything.">Open preview</button>`)}
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Canvas status">
        ${d(`Preview`,`Sandbox`,`isolated frame`)}
        ${d(`Diff`,`Gated`,`approval before apply`)}
        ${d(`Network`,`Blocked`,`unless allowed`)}
        ${d(`Receipt`,`On`,`every apply`)}
      </section>
      <section class="z-canvas-shell" data-canvas-root>
        <div class="z-canvas-loading">Open a preview from chat or a pending action.</div>
      </section>
    </div>
  `),e(`sector-config`,`
    <div class="daily-page settings-minimal-page">
      ${u(`Settings`,`Model, channels, security, profile and appearance.`,`<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Run settings health and show only missing setup.">Check</button>`)}
      <section class="daily-settings-shell" aria-label="Settings">
        <nav class="daily-settings-nav" aria-label="Settings sections">
          <a href="#settings-general">General</a>
          <a href="#settings-model">Model</a>
          <a href="#settings-channels">Channels</a>
          <a href="#settings-security">Security</a>
          <a href="#settings-advanced">Advanced</a>
        </nav>
        <div class="daily-settings-content">
          <section class="daily-settings-group" id="settings-general">
            <h2>General</h2>
            <div class="daily-settings-row daily-settings-row--with-action">
              <div><strong>Language</strong><span>Use system language or choose one.</span></div>
              <label class="settings-minimal-select">
                <select data-zavorth-locale-select>
                  ${n.map(e=>`<option value="${e.code}" ${e.code===r()?`selected`:``}>${e.label}</option>`).join(``)}
                </select>
              </label>
              <button class="daily-button" type="button" data-zavorth-locale-apply>Apply</button>
            </div>
            <div class="daily-settings-row">
              <div><strong>Active engine</strong><span>Current runtime mode.</span></div>
              <strong class="settings-minimal-current" data-runtime-engine-active>Lite</strong>
            </div>
          </section>

          <section class="daily-settings-group" id="settings-model">
            <div class="daily-settings-group__head">
              <h2>Model</h2>
              <button class="daily-button" type="button" data-dashboard-prompt="Test the active model route with sanitized proof.">Test</button>
            </div>
            <div class="daily-settings-row">
              <div><strong>Active route</strong><span data-provider-picker="active">Configured route</span></div>
              <strong class="settings-minimal-current" data-provider-picker="fallbacks">Live routes</strong>
            </div>
            <form id="model-preference-form" class="daily-settings-form daily-route-form">
              <label class="settings-minimal-select">
                <span>Primary provider</span>
                <select id="pref-provider" name="providerId" required>
                  <option value="">Not configured</option>
                  ${L().map(e=>`<option value="${s(e.id)}">${s(e.label)}</option>`).join(``)}
                </select>
              </label>
              <label class="settings-minimal-select">
                <span>Primary model</span>
                <input id="pref-model" name="modelId" type="text" placeholder="e.g. gpt-4o-mini" autocomplete="off">
              </label>
              <label class="settings-minimal-select">
                <span>Secondary model</span>
                <input id="pref-secondary-model" name="secondaryModelId" type="text" placeholder="Used if primary model fails" autocomplete="off">
              </label>
              <label class="settings-minimal-select">
                <span>Route id (optional)</span>
                <input id="pref-route" name="routeId" type="text" placeholder="optional route id" autocomplete="off">
              </label>
              <label class="settings-minimal-select">
                <span>Primary channel</span>
                <select id="pref-channel" name="channelId">
                  <option value="">Not configured</option>
                  ${R().map(e=>`<option value="${s(e.id)}">${s(e.label)}</option>`).join(``)}
                </select>
              </label>
              <div class="daily-route-form__actions">
                <button class="daily-button" type="submit">Save route</button>
                <button class="daily-button" type="button" id="btn-preview-pref">Preview</button>
              </div>
              <div id="pref-result-panel" class="daily-route-result" hidden aria-live="polite"></div>
            </form>
            <details class="daily-disclosure">
              <summary>Provider catalog</summary>
              <div class="daily-provider-summary" data-provider-model-catalog-summary>
                <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Live</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
              </div>
              <div class="daily-card-feed" data-provider-model-catalog-list></div>
            </details>
          </section>

          <section class="daily-settings-group" id="settings-channels">
            <div class="daily-settings-group__head">
              <h2>Channels</h2>
              <button class="daily-button" type="button" data-dashboard-sector="channels">Manage</button>
            </div>
            <p class="daily-settings-hint">Primary channel is set with the Model route form above. Connectors below are optional.</p>
            ${m(`Telegram`,`Connect`)}
            ${m(`Discord`,`Connect`)}
            ${m(`Slack`,`Connect`)}
            ${m(`WhatsApp`,`Connect`)}
          </section>

          <section class="daily-settings-group" id="settings-security">
            <h2>Security</h2>
            <div class="daily-settings-row">
              <div><strong>Execution policy</strong><span>Risky work requires preview.</span></div>
              <strong class="settings-minimal-current">Approval</strong>
            </div>
            <details class="daily-disclosure">
              <summary>Execution engines</summary>
              <div class="runtime-engine-panel" aria-label="Runtime engines">
                <div class="runtime-engine-grid settings-engine-list" data-runtime-engine-cards data-runtime-engine-layout="compact"></div>
              </div>
            </details>
            <details class="daily-disclosure">
              <summary>Trusted folders</summary>
              <div class="trusted-workspace-panel settings-trusted-panel" aria-label="Trusted workspaces">
                <form class="trusted-workspace-form" data-trusted-workspace-form>
                  <label><span>Folder path</span><input name="path" type="text" placeholder="C:\\projects\\playground" autocomplete="off"></label>
                  <label><span>Label</span><input name="label" type="text" placeholder="Playground" autocomplete="off"></label>
                  <label><span>State</span><select name="state"><option value="trusted">Trusted</option><option value="sensitive">Sensitive</option><option value="untrusted">Untrusted</option></select></label>
                  <button type="submit">Add folder</button>
                </form>
                <div class="trusted-workspace-list" data-trusted-workspaces-list></div>
              </div>
            </details>
          </section>

          <section class="daily-settings-group" id="settings-advanced">
            <h2>Advanced</h2>
            <details class="daily-disclosure">
              <summary>Activation diagnostics</summary>
              <div class="daily-provider-summary" data-provider-activation-summary>
                <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">loading</span></div>
                <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">loading</span></div>
              </div>
              <div class="daily-card-feed" data-provider-activation-list></div>
            </details>
            <details class="daily-disclosure zavorth-config-details">
              <summary>Runtime JSON</summary>
              <div class="zavorth-config-editor-wrapper">
                <textarea class="zavorth-config-textarea" id="zavorth-config-editor-textarea" autocomplete="off" spellcheck="false">{
  "zavorthControl": {
    "live": true,
    "theme": "dark",
    "safety": "high"
  }
}</textarea>
                <div class="zavorth-config-editor-actions">
                  <span class="zavorth-config-editor-status" id="zavorth-config-status">JSON status: OK</span>
                  <button class="daily-button" id="zavorth-config-save-btn" type="button">Save</button>
                </div>
              </div>
            </details>
          </section>
        </div>
      </section>
    </div>
  `),e(`sector-docs`,`
    <div class="premium-page">
      <section class="premium-hero premium-hero--compact">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Docs</span>
          <h1 class="premium-title">Use the product first, docs second.</h1>
          <p class="premium-subtitle">Short references explain setup, models, approvals, memory, tools, and safe execution.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Tell me the shortest path to use Zavorth today.">Quickstart</button>
      </section>
      <section class="premium-grid">
        ${h(`Quickstart`,`2 minutes`,`ok`,`Open, choose a goal, verify provider and run the first safe task.`)}
        ${h(`Approvals`,`Important`,`warn`,`Understand allow always, scoped approvals and break-glass mode.`)}
        ${h(`Mnemos`,`Guided`,`info`,`Configure folders and ask about files safely.`)}
        ${h(`Models`,`Catalog`,`info`,`See which routes are configured, provable and live.`)}
      </section>
    </div>
  `),e(`sector-cron`,`
    <div class="premium-page">
      <section class="premium-hero premium-hero--compact">
        <div>
          <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Automations</span>
          <h1 class="premium-title">Scheduled work stays explicit.</h1>
          <p class="premium-subtitle">Recurring jobs, monitors and reminders are visible, revocable and policy checked.</p>
        </div>
        <button class="operator-primary-action" type="button" data-dashboard-prompt="Show scheduled tasks and whether any are risky or noisy.">Check automations</button>
      </section>
      <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Automation</th><th>Type</th><th>Next</th><th>Status</th></tr></thead><tbody>
        <tr><td class="mono">none visible</td><td>local</td><td>-</td><td><span class="badge badge--info"><span class="badge__dot"></span>Waiting</span></td></tr>
      </tbody></table></div>
    </div>
  `),window.ZavorthControlChat?.refreshDashboard?.(),i(),o(),c(),a(),D(),S(),t(),window.ZavorthLocale?.apply();function e(e,t){let n=document.getElementById(e);n&&(n.innerHTML=t)}function t(){let e=document.querySelector(`#zavorth-memory-inspection-body .zavorth-memory-inspection-empty`);e&&(e.innerHTML=`<span>Select a scope</span>`)}document.documentElement.dataset.zavorthDataPromptBound!==`1`&&(document.documentElement.dataset.zavorthDataPromptBound=`1`,document.addEventListener(`click`,e=>{let t=e.target instanceof Element?e.target:null;if(t?.closest?.(`[data-dashboard-prompt]`))return;let n=t?.closest?.(`[data-prompt]`);if(!n||n.closest(`#neural-feed, .compose-dock, #suggestion-chips`))return;let r=n.getAttribute(`data-prompt`)||``;if(!r)return;e.preventDefault();let i=document.getElementById(`compose-input`);document.querySelector(`[data-sector="terminal"]`)?.click(),(i instanceof HTMLTextAreaElement||i instanceof HTMLInputElement)&&(i.value=r,i.dispatchEvent(new Event(`input`,{bubbles:!0})),i.focus())}));function i(){document.documentElement.dataset.zavorthDashboardActionsBound!==`1`&&(document.documentElement.dataset.zavorthDashboardActionsBound=`1`,document.addEventListener(`click`,e=>{let t=e.target instanceof Element?e.target:null,n=t?.closest?.(`[data-dashboard-sector]`);if(n){let t=n.getAttribute(`data-dashboard-sector`);t&&(e.preventDefault(),document.querySelector(`[data-sector="${t}"]`)?.click(),window.emitSignal?.(`info`,`Opened`,`${t.replace(/-/g,` `)} is now active.`));return}let r=t?.closest?.(`[data-dashboard-prompt]`);if(!r)return;let i=r.getAttribute(`data-dashboard-prompt`)||``;if(!i)return;e.preventDefault();let a=document.getElementById(`compose-input`);document.querySelector(`[data-sector="terminal"]`)?.click(),(a instanceof HTMLTextAreaElement||a instanceof HTMLInputElement)&&(a.value=i,a.dispatchEvent(new Event(`input`,{bubbles:!0})),a.focus(),window.emitSignal?.(`success`,`Action ready`,`Review or send the prepared prompt from Inbox.`))}))}function o(){if(document.documentElement.dataset.zavorthSkillFiltersBound===`1`)return;document.documentElement.dataset.zavorthSkillFiltersBound=`1`,document.addEventListener(`input`,e=>{(e.target instanceof Element?e.target:null)?.matches?.(`[data-skill-search]`)&&l()}),document.addEventListener(`click`,e=>{let t=(e.target instanceof Element?e.target:null)?.closest?.(`[data-skill-filter]`);t&&(e.preventDefault(),t.closest(`.skill-toolbar`)?.querySelectorAll(`[data-skill-filter]`).forEach(e=>{e.classList.toggle(`is-active`,e===t)}),l())});let e=document.querySelector(`#sector-skills .premium-skill-list`);e&&typeof MutationObserver<`u`&&new MutationObserver(()=>l()).observe(e,{childList:!0})}function c(){document.documentElement.dataset.zavorthLocaleSettingsBound!==`1`&&(document.documentElement.dataset.zavorthLocaleSettingsBound=`1`,document.addEventListener(`click`,e=>{if(!(e.target instanceof Element?e.target:null)?.closest?.(`[data-zavorth-locale-apply]`))return;let t=document.querySelector(`[data-zavorth-locale-select]`);t instanceof HTMLSelectElement&&(window.ZavorthLocale?.set(t.value),window.emitSignal?.(`success`,`Language updated`,`The dashboard language was applied.`))}))}function l(){let e=document.getElementById(`sector-skills`);if(!e)return;let t=String(e.querySelector(`[data-skill-search]`)?.value||``).trim().toLowerCase(),n=e.querySelector(`[data-skill-filter].is-active`)?.getAttribute(`data-skill-filter`)||`all`;e.querySelectorAll(`[data-skill-row]`).forEach(e=>{let r=String(e.getAttribute(`data-skill-search-text`)||e.textContent||``).toLowerCase(),i=String(e.getAttribute(`data-skill-status`)||``).toLowerCase(),a=!t||r.includes(t),o=n===`all`||i===n;e instanceof HTMLElement&&(e.hidden=!(a&&o))})}function u(e,t,n=``){return`<section class="daily-header">
      <div>
        <span class="daily-kicker"><span class="dashboard-live-dot"></span>${e}</span>
        <h1>${e}</h1>
        ${t?`<p>${t}</p>`:``}
      </div>
      ${n?`<div class="daily-header__actions">${n}</div>`:``}
    </section>`}function d(e,t,n){return`<article class="daily-metric"><span>${e}</span><strong>${t}</strong><small>${n}</small></article>`}function f(e,t){return`<div class="daily-key-value__row"><span>${e}</span><strong>${t}</strong></div>`}function p(e,t,n,r,i,a,o){return`<article class="daily-channel-row daily-channel-row--${r}">
      <span class="daily-status-dot" aria-hidden="true"></span>
      <div class="daily-row__main">
        <h2>${e}<small>${t}</small></h2>
      </div>
      <span class="daily-status daily-status--${r}">${n}</span>
      <div class="daily-row__actions">
        <button type="button" class="daily-button" data-dashboard-prompt="${o}">${i}</button>
        <button type="button" class="daily-button daily-button--ghost" data-dashboard-prompt="Show setup status, last error and next step for ${e}.">${a}</button>
      </div>
    </article>`}function m(e,t){return`<div class="daily-settings-row">
      <div><strong>${e}</strong><span>Optional channel</span></div>
      <button class="daily-button" type="button" data-dashboard-prompt="Configure ${e} and show only the missing credential or webhook.">${t}</button>
    </div>`}function h(e,t,n,r){return`<article class="premium-card premium-card--${n}"><div class="premium-card__top"><h2>${e}</h2><span>${t}</span></div><p>${r}</p></article>`}function g(e,t,n,r,i,a){let o=`${e} ${t} ${n}`.toLowerCase(),s=i===`ready`;return`<article class="skill-row skill-row--${r}" data-skill-row data-skill-status="${i}" data-skill-search-text="${o}">
      <div class="daily-row__main"><h2>${e}</h2><p>${n}</p></div>
      <span class="daily-status daily-status--${r}">${t}</span>
      <button type="button" class="daily-skill-toggle" aria-pressed="${s?`true`:`false`}" aria-label="${s?`Disable`:`Enable`} ${e}" data-dashboard-prompt="${s?`Disable ${e} after confirming impact.`:`Enable or configure ${e}. Show only the missing setup and risk.`}"><span></span></button>
      <button type="button" class="skill-row__use" data-dashboard-prompt="${a}">Use</button>
    </article>`}}z(),b(),P(()=>window.ZavorthControlChat?.refreshDashboard?.());