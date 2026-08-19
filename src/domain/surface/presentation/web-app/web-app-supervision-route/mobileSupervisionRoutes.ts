import { randomUUID } from 'node:crypto';
import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';
import { getRequestedBy } from './helpers.js';
import {
  ZavorthMobileSupervisionService,
} from '../../../../../services/ZavorthMobileSupervisionService.js';
import { asErrorLike } from '../../../../../utils/errorLike';

// Singleton – shared across all requests

const mobileService = new ZavorthMobileSupervisionService();
const streamTickets = new Map<string, number>();
const STREAM_TICKET_TTL_MS = 30_000;

// Helpers

function extractMobileToken(ctx: WebAppSupervisionRouteContext): string {
  const fromHeader = String(
    (Array.isArray(ctx.req.headers['x-zavorth-mobile-token'])
      ? ctx.req.headers['x-zavorth-mobile-token'][0]
      : ctx.req.headers['x-zavorth-mobile-token']) || '',
  ).trim();
  return fromHeader;
}

function requireAuth(ctx: WebAppSupervisionRouteContext): boolean {
  const token = extractMobileToken(ctx);
  return mobileService.validateSessionToken(token);
}

function mintStreamTicket(): string {
  pruneStreamTickets();
  const ticket = randomUUID();
  streamTickets.set(ticket, Date.now() + STREAM_TICKET_TTL_MS);
  return ticket;
}

function consumeStreamTicket(ticket: string): boolean {
  pruneStreamTickets();
  const normalized = String(ticket || '').trim();
  const expiresAt = streamTickets.get(normalized);
  if (!expiresAt) return false;
  streamTickets.delete(normalized);
  return expiresAt > Date.now();
}

function pruneStreamTickets(): void {
  const now = Date.now();
  for (const [ticket, expiresAt] of streamTickets.entries()) {
    if (expiresAt <= now) streamTickets.delete(ticket);
  }
}

// Mobile SPA HTML (standalone, inline, no external deps except Google Font)

const MOBILE_SPA_HTML = /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<title>Zavorth · Supervisao Movel</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0d11;--card:rgba(24,28,38,.72);--border:rgba(255,255,255,.08);
  --text:#e2e4ea;--muted:#8b8fa4;--accent:#6c5ce7;--accent-glow:rgba(108,92,231,.35);
  --green:#00b894;--yellow:#fdcb6e;--red:#d63031;--gray:#636e72;
  --radius:14px;--font:'Inter',system-ui,sans-serif;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);-webkit-font-smoothing:antialiased}
#app{max-width:480px;margin:0 auto;padding:16px;min-height:100%}
.glass{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}

/* Login */
#login-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;gap:18px}
#login-screen h1{font-size:1.5rem;font-weight:700;letter-spacing:-.02em}
#login-screen p{font-size:.85rem;color:var(--muted);text-align:center}
#login-screen input{width:100%;max-width:320px;padding:12px 16px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.05);color:var(--text);font-size:.95rem;outline:none;transition:border .2s}
#login-screen input:focus{border-color:var(--accent)}
#login-screen button{width:100%;max-width:320px;padding:12px;border:none;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:.95rem;cursor:pointer;transition:opacity .2s}
#login-screen button:active{opacity:.7}
#login-error{color:var(--red);font-size:.82rem;min-height:1.2em}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin-bottom:12px}
.header h2{font-size:1.1rem;font-weight:700;letter-spacing:-.01em}
.status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;flex-shrink:0}
.status-dot.running{background:var(--green);box-shadow:0 0 8px var(--green)}
.status-dot.awaiting-approval{background:var(--yellow);box-shadow:0 0 8px var(--yellow)}
.status-dot.error{background:var(--red);box-shadow:0 0 8px var(--red)}
.status-dot.idle{background:var(--gray)}
.status-row{display:flex;align-items:center;font-size:.82rem;color:var(--muted)}

/* Cards */
.card{padding:14px 16px;margin-bottom:10px}
.card h3{font-size:.88rem;font-weight:600;margin-bottom:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.card-row{display:flex;justify-content:space-between;font-size:.85rem;padding:3px 0}
.card-row .label{color:var(--muted)}

/* Approvals */
.approval-card{padding:14px 16px;margin-bottom:8px;border-left:3px solid var(--yellow)}
.approval-card .desc{font-size:.88rem;margin-bottom:6px}
.approval-card .risk{font-size:.75rem;color:var(--yellow);margin-bottom:10px}
.approval-card .actions{display:flex;gap:8px}
.approval-card .actions button{flex:1;padding:8px;border:none;border-radius:8px;font-weight:600;font-size:.82rem;cursor:pointer;transition:opacity .2s}
.approval-card .actions button:active{opacity:.7}
.btn-approve{background:var(--green);color:#fff}
.btn-reject{background:var(--red);color:#fff}

/* Events */
.event-item{padding:10px 14px;margin-bottom:6px;font-size:.82rem;animation:slideIn .3s ease}
.event-item .ev-type{font-weight:600;color:var(--accent);text-transform:uppercase;font-size:.72rem;letter-spacing:.03em}
.event-item .ev-time{color:var(--muted);font-size:.72rem;float:right}
.event-item .ev-data{margin-top:4px;color:var(--muted);word-break:break-all}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

/* Model Selector */
.model-select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.05);color:var(--text);font-size:.85rem;outline:none;appearance:none;cursor:pointer}

/* Connection banner */
.conn-banner{text-align:center;font-size:.78rem;padding:8px;border-radius:8px;margin-bottom:10px}
.conn-banner.connected{background:rgba(0,184,148,.12);color:var(--green)}
.conn-banner.disconnected{background:rgba(214,48,49,.12);color:var(--red)}

/* Logout */
.logout-btn{display:block;width:100%;padding:10px;margin-top:16px;border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--muted);font-size:.82rem;cursor:pointer;transition:border .2s}
.logout-btn:hover{border-color:var(--red);color:var(--red)}
</style>
</head>
<body>
<div id="app">
  <!-- Login Screen -->
  <div id="login-screen">
    <h1>🛡️ Zavorth Supervisao Movel</h1>
    <p>Mobile agent supervision.<br/>Enter the session token to continue.</p>
    <input id="token-input" type="password" placeholder="Session token" autocomplete="off" />
    <button id="login-btn" onclick="doLogin()">Entrar</button>
    <div id="login-error"></div>
  </div>

  <!-- ZavorthControl (hidden until auth) -->
  <div id="zavorthControl" style="display:none">
    <div class="header glass">
      <div>
        <h2>Supervisao Movel</h2>
        <div class="status-row"><span id="status-dot" class="status-dot idle"></span><span id="status-label">idle</span></div>
      </div>
      <div style="text-align:right">
        <div id="client-count" style="font-size:.75rem;color:var(--muted)">0 clientes</div>
      </div>
    </div>

    <div id="conn-banner" class="conn-banner disconnected">Conectando...</div>

    <!-- Agent Info -->
    <div class="card glass" id="agent-card">
      <h3>Agente</h3>
      <div class="card-row"><span class="label">Tarefa</span><span id="agent-task">—</span></div>
      <div class="card-row"><span class="label">Provider</span><span id="agent-provider">—</span></div>
      <div class="card-row"><span class="label">Modelo</span><span id="agent-model">—</span></div>
      <div class="card-row"><span class="label">Ativo desde</span><span id="agent-up">—</span></div>
      <div class="card-row"><span class="label">Autonomia</span><span id="agent-autonomy">1</span></div>
    </div>

    <!-- Model Switch -->
    <div class="card glass">
      <h3>Trocar Modelo</h3>
      <select id="model-selector" class="model-select" onchange="onModelSwitch()">
        <option value="">— selecione —</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="claude-sonnet-4-20250514">claude-sonnet-4</option>
        <option value="claude-3-5-haiku">claude-3-5-haiku</option>
        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
      </select>
    </div>

    <!-- Pending Approvals -->
    <div id="approvals-section">
      <div class="card glass" style="border:none;background:transparent;padding:14px 2px 4px">
        <h3>Pending Approvals</h3>
      </div>
      <div id="approvals-list"></div>
    </div>

    <!-- Recent Events -->
    <div class="card glass" style="border:none;background:transparent;padding:14px 2px 4px">
      <h3>Recent Events</h3>
    </div>
    <div id="events-list"></div>

    <button class="logout-btn" onclick="doLogout()">End session</button>
  </div>
</div>

<script>
(function(){
  var token='';
  var sse=null;
  var reconnectTimer=null;
  var BASE=location.origin;

  window.doLogin=function(){
    var inp=document.getElementById('token-input');
    var err=document.getElementById('login-error');
    var t=inp.value.trim();
    if(!t){err.textContent='Token required.';return}
    fetch(BASE+'/api/web/mobile/auth',{headers:{'X-Zavorth-Mobile-Token':t}})
      .then(function(r){return r.json()})
      .then(function(d){
        if(d.ok&&d.authenticated){
          token=t;
          localStorage.setItem('zv_mobile_token',t);
          showZavorthControl();
        }else{err.textContent='Token invalid ou expirado.';}
      })
      .catch(function(){err.textContent='Connection error.';});
  };

  window.doLogout=function(){
    token='';
    localStorage.removeItem('zv_mobile_token');
    if(sse){sse.close();sse=null;}
    document.getElementById('zavorthControl').style.display='none';
    document.getElementById('login-screen').style.display='flex';
  };

  function showZavorthControl(){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('zavorthControl').style.display='block';
    fetchStatus();
    connectSSE();
  }

  function fetchStatus(){
    fetch(BASE+'/api/web/mobile/status',{headers:{'X-Zavorth-Mobile-Token':token}})
      .then(function(r){return r.json()})
      .then(function(d){if(d.ok)renderSnapshot(d.snapshot);})
      .catch(function(){});
  }

  function renderSnapshot(s){
    setStatus(s.status);
    document.getElementById('client-count').textContent=s.connectedClients+' clientes';
    var a=s.agentStatus||{};
    document.getElementById('agent-task').textContent=a.currentTask||'—';
    document.getElementById('agent-provider').textContent=a.provider||'—';
    document.getElementById('agent-model').textContent=a.model||'—';
    document.getElementById('agent-up').textContent=a.upSince...new Date(a.upSince).toLocaleTimeString():'—';
    document.getElementById('agent-autonomy').textContent=a.autonomyLevel||'1';
    renderApprovals(s.pendingApprovals||[]);
    renderEvents(s.recentEvents||[]);
  }

  function setStatus(st){
    var dot=document.getElementById('status-dot');
    dot.className='status-dot '+(st||'idle');
    document.getElementById('status-label').textContent=st||'idle';
  }

  function renderApprovals(list){
    var c=document.getElementById('approvals-list');
    if(!list.length){c.innerHTML='<div style="font-size:.82rem;color:var(--muted);padding:4px 2px">No pending approvals.</div>';return}
    c.innerHTML=list.map(function(a){
      return '<div class="approval-card glass">'
        +'<div class="desc">'+esc(a.description)+'</div>'
        +'<div class="risk">Risk: '+esc(a.riskLevel)+'</div>'
        +'<div class="actions">'
        +'<button class="btn-approve" onclick="doAction(\\'approve\\',\\''+esc(a.id)+'\\')">Approve</button>'
        +'<button class="btn-reject" onclick="doAction(\\'reject\\',\\''+esc(a.id)+'\\')">Reject</button>'
        +'</div></div>';
    }).join('');
  }

  function renderEvents(list){
    var c=document.getElementById('events-list');
    c.innerHTML=list.slice(0,30).map(function(e){
      return '<div class="event-item glass">'
        +'<span class="ev-type">'+esc(e.type)+'</span>'
        +'<span class="ev-time">'+new Date(e.timestamp).toLocaleTimeString()+'</span>'
        +'<div class="ev-data">'+esc(JSON.stringify(e.data).substring(0,200))+'</div>'
        +'</div>';
    }).join('');
  }

  window.doAction=function(actionId,targetId){
    fetch(BASE+'/api/web/mobile/action',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Zavorth-Mobile-Token':token},
      body:JSON.stringify({actionId:actionId,targetId:targetId})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.ok)fetchStatus();
    }).catch(function(){});
  };

  window.onModelSwitch=function(){
    var sel=document.getElementById('model-selector');
    var model=sel.value;
    if(!model)return;
    doAction('steer',model);
    sel.value='';
  };

  function connectSSE(){
    if(sse){sse.close();sse=null;}
    clearTimeout(reconnectTimer);
    var banner=document.getElementById('conn-banner');
    banner.className='conn-banner disconnected';
    banner.textContent='Conectando...';
    fetch(BASE+'/api/web/mobile/stream-ticket',{headers:{'X-Zavorth-Mobile-Token':token}})
      .then(function(r){return r.json()})
      .then(function(d){
        if(!d.ok||!d.ticket){throw new Error('ticket')}
        sse=new EventSource(BASE+'/api/web/mobile/stream...ticket='+encodeURIComponent(d.ticket));
        sse.onopen=function(){
          banner.className='conn-banner connected';
          banner.textContent='Connected - stream active';
        };
        sse.addEventListener('agent-log',onSSE);
        sse.addEventListener('receipt',onSSE);
        sse.addEventListener('approval-pending',onSSE);
        sse.addEventListener('approval-resolved',onSSE);
        sse.addEventListener('status-change',onSSE);
        sse.addEventListener('provider-switch',onSSE);
        sse.onerror=function(){
          banner.className='conn-banner disconnected';
          banner.textContent='Disconnected - reconnecting...';
          if(sse){sse.close();sse=null;}
          reconnectTimer=setTimeout(connectSSE,3000);
        };
      })
      .catch(function(){
        banner.className='conn-banner disconnected';
        banner.textContent='Mobile session not authenticated.';
      });
  }
  function onSSE(ev){
    try{
      var data=JSON.parse(ev.data);
      if(data.type==='status-change'&&data.data)setStatus(data.data.status);
      if(data.type==='approval-pending'||data.type==='approval-resolved')fetchStatus();
      prependEvent(data);
    }catch(e){/* SSE parse error ignored — non-critical UI update */}
  }

  function prependEvent(e){
    var c=document.getElementById('events-list');
    var div=document.createElement('div');
    div.className='event-item glass';
    div.innerHTML='<span class="ev-type">'+esc(e.type)+'</span>'
      +'<span class="ev-time">'+new Date(e.timestamp).toLocaleTimeString()+'</span>'
      +'<div class="ev-data">'+esc(JSON.stringify(e.data).substring(0,200))+'</div>';
    c.insertBefore(div,c.firstChild);
    while(c.children.length>30)c.removeChild(c.lastChild);
  }

  function esc(s){
    if(!s)return'';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Auto-login from localStorage
  var saved=localStorage.getItem('zv_mobile_token');
  if(saved){
    document.getElementById('token-input').value=saved;
    window.doLogin();
  }
})();
</script>
</body>
</html>`;

// Route handler

export const handleMobileSupervisionRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const { req, res, url, pathname, deps } = ctx;

  // GET /api/web/mobile — Serve the SPA HTML
  if (pathname === '/api/web/mobile' && req.method === 'GET') {
    const html = Buffer.from(MOBILE_SPA_HTML, 'utf-8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': html.byteLength,
      'Cache-Control': 'no-store',
    });
    res.end(html);
    return true;
  }

  // GET /api/web/mobile/auth — Check session validity
  if (pathname === '/api/web/mobile/auth' && req.method === 'GET') {
    const authenticated = requireAuth(ctx);
    deps.writeJson(res, { ok: true, authenticated }, 200);
    return true;
  }

  // POST /api/web/mobile/auth — Generate a new session token
  if (pathname === '/api/web/mobile/auth' && req.method === 'POST') {
    // Require operator approval token header
    const expected = String(
      process.env.ZAVORTH_OPERATOR_APPROVAL_TOKEN
      || process.env.ZAVORTH_RUNTIME_ADAPTER_API_APPROVAL_TOKEN
      || process.env.ZAVORTH_ZAVORTH_CONTROL_OPERATOR_TOKEN
      || '',
    ).trim();
    const provided = String(
      (Array.isArray(req.headers['x-zavorth-operator-approval'])
        ? req.headers['x-zavorth-operator-approval'][0]
        : req.headers['x-zavorth-operator-approval']) || '',
    ).trim();
    if (expected.length < 16 || provided !== expected) {
      deps.writeJson(
        res,
        { ok: false, error: 'Operator token required to generate mobile session.' },
        403,
      );
      return true;
    }
    const sessionToken = mobileService.generateSessionToken();
    const requestedBy = getRequestedBy(ctx);
    deps.writeJson(
      res,
      {
        ok: true,
        token: sessionToken,
        requestedBy,
        expiresInMs: 24 * 60 * 60 * 1000,
        safety: {
          redactionEnabled: true,
          approvalRequired: true,
          receiptGenerated: true,
        },
      },
      200,
    );
    return true;
  }

  // GET /api/web/mobile/status — ZavorthControl snapshot JSON
  if (pathname === '/api/web/mobile/status' && req.method === 'GET') {
    if (!requireAuth(ctx)) {
      deps.writeJson(res, { ok: false, error: 'Mobile session not authenticated.' }, 401);
      return true;
    }
    deps.writeJson(res, { ok: true, snapshot: mobileService.buildSnapshot() }, 200);
    return true;
  }

  // GET /api/web/mobile/stream-ticket — Short-lived SSE ticket
  if (pathname === '/api/web/mobile/stream-ticket' && req.method === 'GET') {
    if (!requireAuth(ctx)) {
      deps.writeJson(res, { ok: false, error: 'Mobile session not authenticated.' }, 401);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      ticket: mintStreamTicket(),
      expiresInMs: STREAM_TICKET_TTL_MS,
      safety: {
        primaryTokenInUrl: false,
        singleUse: true,
      },
    }, 200);
    return true;
  }

  // GET /api/web/mobile/stream — SSE endpoint
  if (pathname === '/api/web/mobile/stream' && req.method === 'GET') {
    if (!consumeStreamTicket(String(url.searchParams.get('ticket') || ''))) {
      deps.writeJson(res, { ok: false, error: 'Mobile session not authenticated.' }, 401);
      return true;
    }
    const clientId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Send initial ping
    res.write(`event: ping\ndata: ${JSON.stringify({ clientId, connectedAt: new Date().toISOString() })}\n\n`);
    mobileService.addClient(clientId, res);
    // Keep connection open — Node will handle close via res 'close' event
    return true;
  }

  // POST /api/web/mobile/action — Mobile operator actions
  if (pathname === '/api/web/mobile/action' && req.method === 'POST') {
    if (!requireAuth(ctx)) {
      deps.writeJson(res, { ok: false, error: 'Mobile session not authenticated.' }, 401);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const actionId = String(body.actionId || '').trim().toLowerCase();
    const targetId = String(body.targetId || '').trim();
    const note = String(body.note || '').trim() || null;

    if (!actionId || !targetId) {
      deps.writeJson(
        res,
        { ok: false, error: 'actionId and targetId are required.' },
        400,
      );
      return true;
    }

    if (actionId === 'approve' || actionId === 'reject') {
      const resolved = mobileService.resolveApproval(targetId, actionId as 'approve' | 'reject');
      if (!resolved) {
        deps.writeJson(
          res,
          { ok: false, error: 'Approval not found.' },
          404,
        );
        return true;
      }
      deps.writeJson(
        res,
        {
          ok: true,
          actionId,
          targetId,
          note,
          requestedBy: getRequestedBy(ctx),
          snapshot: mobileService.buildSnapshot(),
          receipt: {
            type: 'approval-decision',
            surface: 'mobile',
            decision: actionId,
            targetId,
            timestamp: new Date().toISOString(),
          },
        },
        200,
      );
      return true;
    }

    if (actionId === 'steer') {
      mobileService.broadcast({
        id: `steer-${Date.now()}`,
        type: 'provider-switch',
        timestamp: new Date().toISOString(),
        data: { requestedModel: targetId, requestedBy: getRequestedBy(ctx), note },
        redacted: false,
      });
      deps.writeJson(
        res,
        {
          ok: true,
          actionId,
          targetId,
          note,
          requestedBy: getRequestedBy(ctx),
          receipt: {
            type: 'steer-command',
            surface: 'mobile',
            requestedModel: targetId,
            timestamp: new Date().toISOString(),
          },
        },
        200,
      );
      return true;
    }

    deps.writeJson(
      res,
      { ok: false, error: 'actionId invalid. Esperado: approve, reject, steer.' },
      400,
    );
    return true;
  }

  return false;
};
