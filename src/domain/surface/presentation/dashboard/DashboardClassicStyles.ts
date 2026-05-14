export const DASHBOARD_CLASSIC_STYLES = `
    :root {
      color-scheme: dark;
      --bg: #09101a;
      --panel: rgba(13, 22, 36, 0.86);
      --line: rgba(255, 255, 255, 0.08);
      --text: #f5f7fb;
      --muted: #9fb0c3;
      --accent: #00e5ff;
      --accent-soft: rgba(0, 229, 255, 0.15);
      --danger: #ff4757;
      --danger-soft: rgba(255, 71, 87, 0.15);
      --success: #2ed573;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; font-family: "Inter", "Segoe UI", sans-serif;
      color: var(--text);
      background: radial-gradient(circle at top right, rgba(0, 229, 255, 0.12), transparent 40%),
                  linear-gradient(180deg, #0b1320 0%, var(--bg) 100%);
      padding: 0;
      overflow-x: hidden;
    }
    .header {
      padding: 24px 32px; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--line);
      backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: space-between;
    }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
    .header h1 span { color: var(--accent); }
    .shell { max-width: 1280px; margin: 32px auto; padding: 0 16px; }
    
    .tabs { display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
    .tab-btn {
      background: transparent; border: none; color: var(--muted); padding: 10px 20px;
      font-size: 16px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: all 0.2s;
    }
    .tab-btn:hover { background: rgba(255,255,255,0.05); color: var(--text); }
    .tab-btn.active { background: var(--accent-soft); color: var(--accent); }
    
    .view { display: none; animation: fadeIn 0.3s ease; }
    .view.active { display: block; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .card {
      background: var(--panel); border: 1px solid var(--line); border-radius: 16px;
      backdrop-filter: blur(16px); padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    
    .grid-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .metric-card { background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 20px; border-radius: 12px; }
    .metric-card strong { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    .metric-card div { font-size: 32px; font-weight: 800; margin: 10px 0 4px; }
    .metric-card small { color: var(--muted); font-size: 14px; }
    .cockpit-grid { display:grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    .cockpit-stack { display:grid; gap: 16px; }
    .cockpit-status {
      display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap;
    }
    .cockpit-headline { font-size: 20px; font-weight: 700; margin: 8px 0 0; line-height: 1.35; }
    .cockpit-list { display:grid; gap: 10px; margin: 0; padding-left: 18px; color: var(--muted); }
    .cockpit-mini-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .cockpit-mini-card { background: rgba(0,0,0,0.2); border: 1px solid var(--line); border-radius: 12px; padding: 16px; display:grid; gap: 6px; }
    .cockpit-mini-card strong { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; }
    .cockpit-mini-card div { font-size: 24px; font-weight: 800; }
    .cockpit-action-list { display:grid; gap: 10px; }
    .cockpit-action-card { background: rgba(0,0,0,0.2); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display:grid; gap: 6px; }
    .cockpit-command { font-family: monospace; font-size: 13px; color: var(--accent); }
    .cockpit-alert-list { display:grid; gap: 10px; }
    .cockpit-alert-card { background: rgba(0,0,0,0.2); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display:grid; gap: 6px; }
    .report-layout { display:grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; }
    .report-text {
      background: rgba(0,0,0,0.22); border: 1px solid var(--line); border-radius: 12px; padding: 18px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; line-height: 1.55;
      white-space: pre-wrap; word-break: break-word; max-height: 520px; overflow-y: auto;
    }
    .report-section { display:grid; gap: 12px; }
    .report-list { display:grid; gap: 10px; }
    .report-card { background: rgba(0,0,0,0.2); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display:grid; gap: 6px; }
    .sidecar-links { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .sidecar-card { background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 20px; border-radius: 12px; display:grid; gap:10px; }
    .sidecar-card strong { font-size: 15px; }
    .sidecar-link { color: var(--accent); text-decoration: none; word-break: break-all; }
    .sidecar-link:hover { text-decoration: underline; }
    @media (max-width: 980px) {
      .cockpit-grid { grid-template-columns: 1fr; }
      .report-layout { grid-template-columns: 1fr; }
    }

    .log-list { max-height: 600px; overflow-y: auto; padding-right: 10px; }
    .log-item { padding: 12px; border-bottom: 1px solid var(--line); font-family: monospace; font-size: 14px; display: flex; gap: 16px; }
    .log-item:last-child { border: none; }
    .log-time { color: var(--muted); min-width: 140px; }
    .log-level { font-weight: bold; width: 60px; text-transform: uppercase; }
    .level-info { color: var(--accent); }
    .level-warn { color: #ffa502; }
    .level-error { color: var(--danger); }
    .level-security { color: #ff4757; }
    .log-msg { color: var(--text); word-break: break-all; }

    .snippet-grid { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }
    .snippet-list { display: flex; flex-direction: column; gap: 8px; max-height: 600px; overflow-y: auto; }
    .snippet-item { 
      padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; background: rgba(0,0,0,0.2);
      cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center;
    }
    .snippet-item:hover { background: rgba(255,255,255,0.05); }
    .snippet-item.active { border-color: var(--accent); background: var(--accent-soft); }
    
    .snippet-editor { display: flex; flex-direction: column; gap: 16px; }
    input.form-input, textarea.form-input {
      width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--line);
      border-radius: 8px; color: var(--text); font-family: monospace; font-size: 14px; transition: 0.2s;
    }
    input.form-input:focus, textarea.form-input:focus { outline: none; border-color: var(--accent); }
    textarea.form-input { min-height: 400px; resize: vertical; }
    
    .btn {
      padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;
      transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-primary { background: var(--accent); color: #000; }
    .btn-primary:hover { background: #00c4db; box-shadow: 0 0 15px var(--accent-soft); }
    .btn-ghost { background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--line); }
    .btn-ghost:hover { background: rgba(255,255,255,0.1); }
    .btn-danger { background: var(--danger-soft); color: var(--danger); }
    .btn-danger:hover { background: var(--danger); color: #fff; }
    
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.1); font-size: 12px; }
    .badge-allowed { background: rgba(46,213,115,0.2); color: var(--success); }
    .badge-blocked { background: var(--danger-soft); color: var(--danger); }
    .badge-warning { background: rgba(255,165,2,0.2); color: #ffa502; }
    .badge-info { background: rgba(0,229,255,0.16); color: var(--accent); }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

    .audit-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .audit-table th { text-align: left; padding: 10px 12px; color: var(--muted); border-bottom: 2px solid var(--line); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
    .audit-table td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
    .audit-table tr:hover td { background: rgba(255,255,255,0.03); }
    .audit-filters { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .audit-filters select, .audit-filters input { padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--line); border-radius: 6px; color: var(--text); font-size: 13px; }
    .audit-filters select:focus, .audit-filters input:focus { outline: none; border-color: var(--accent); }
    .audit-pagination { display: flex; gap: 8px; justify-content: center; margin-top: 16px; align-items: center; }
    .audit-pagination button { padding: 6px 14px; background: rgba(255,255,255,0.08); border: 1px solid var(--line); border-radius: 6px; color: var(--text); cursor: pointer; }
    .audit-pagination button:hover { background: var(--accent-soft); border-color: var(--accent); }
    .audit-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

    .toast {
      position: fixed; bottom: 20px; right: 20px; padding: 16px 24px; background: var(--success); color: #000;
      font-weight: 600; border-radius: 8px; transform: translateY(100px); opacity: 0; transition: 0.3s;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
`.trim();

