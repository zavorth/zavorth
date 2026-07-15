import { normalizeModelProfile } from './runtime-model-profile';

type RuntimeOperationsPanelsOptions = {
  collectToolExposures: () => any[];
  escapeHtml: (value: unknown) => string;
  eventCountMatching: (pattern: RegExp) => number;
  formatDate: (value: unknown) => string;
  formattedMoney: (value: unknown) => string;
  getCurrentModelLabel: () => string;
  getCurrentModelRouteLabel: () => string;
  getCurrentProviderLabel: () => string;
  getRuns: () => any[];
  getWorkflowJobs: () => any[];
  numberLabel: (value: unknown, fallback?: string) => string;
  pendingApprovalCount: () => number;
  resolveCurrentModelProfile: () => any;
  runArtifactCount: (run: any) => number;
  setLiveStripValue: (selector: string, value: unknown) => void;
  setTableBody: (sectionId: string, html: string) => void;
  setTableHeaders: (sectionId: string, labels: string[]) => void;
  state: any;
  statusBadge: (status: unknown, label: string) => string;
  sumRunNumbers: (paths: string[]) => number;
  text: (value: unknown, fallback?: string) => string;
  totalArtifactCount: () => number;
  updatePlatformAction: (sectionId: string, title: string, detail: string, prompt?: string) => void;
  updatePremiumMetric: (label: string, value: string, sub: string) => void;
  updatePremiumStatus: (label: string, value: string, tone?: string) => void;
  updateSummaryCard: (label: string, value: string, sub: string) => void;
};

export function createRuntimeOperationsPanels(options: RuntimeOperationsPanelsOptions) {
  function groupRunsByModel() {
    const groups = new Map();
    for (const run of options.getRuns()) {
      const profile = normalizeModelProfile(run?.modelProfile) || options.resolveCurrentModelProfile();
      const key = profile.modelLabel || 'current model';
      const current = groups.get(key) || {
        model: key,
        runs: 0,
        events: 0,
        artifacts: 0,
        status: 'Ready',
      };
      current.runs += 1;
      current.events += Array.isArray(run?.events) ? run.events.length : 0;
      current.artifacts += options.runArtifactCount(run);
      current.status = options.text(run?.status, current.status);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }

  function updateUsage() {
    const runs = options.getRuns();
    const models = groupRunsByModel();
    const tokenTotal = options.sumRunNumbers([
      'usage.totalTokens',
      'usage.tokens',
      'tokenUsage.totalTokens',
      'tokens.total',
      'tokensUsed',
      'totalTokens',
    ]);
    const costTotal = options.sumRunNumbers(['usage.costUsd', 'costUsd', 'cost.usd', 'billing.costUsd']);
    const toolCalls = options.eventCountMatching(/tool|executor|command|mcp/i);
    const errors = options.eventCountMatching(/failed|error|blocked|rejected|cancelled|canceled/i);

    options.updatePremiumMetric(
      'Tokens',
      options.numberLabel(tokenTotal),
      tokenTotal ? 'measured by runtime' : 'no measured usage',
    );
    options.updatePremiumMetric(
      'Cost',
      options.formattedMoney(costTotal),
      costTotal ? 'reported by provider' : 'waiting for provider proof',
    );
    options.updatePremiumMetric(
      'Calls',
      options.numberLabel(toolCalls),
      toolCalls ? 'tools used' : 'no tools executed',
    );
    options.updatePremiumMetric(
      'Errors',
      options.numberLabel(errors),
      errors ? 'review recent events' : 'no visible errors',
    );
    options.updatePremiumStatus(
      'Usage',
      options.state.zavorthControl?.live ? 'live' : 'local',
      options.state.zavorthControl?.live ? 'ok' : 'info',
    );
    options.updatePremiumStatus('Costs', costTotal ? 'reported' : 'when reported', costTotal ? 'ok' : 'info');
    options.updatePremiumStatus('Secrets', 'redacted', 'ok');
    options.updatePremiumStatus(
      'Export',
      options.totalArtifactCount() ? 'available' : 'manual',
      options.totalArtifactCount() ? 'ok' : 'info',
    );
    options.updatePlatformAction('sector-usage', 'Active model', options.getCurrentModelRouteLabel());
    options.updatePlatformAction(
      'sector-usage',
      'Test route',
      errors ? `${options.numberLabel(errors)} event(s) to review` : 'Ready for a safe check.',
    );
    options.updatePlatformAction(
      'sector-usage',
      'Recent usage',
      `${options.numberLabel(runs.length)} run(s), ${options.numberLabel(tokenTotal)} token(s)`,
    );

    // Dynamically update the neon SVG chart values!
    const chartTokensVal = document.getElementById('zavorth-chart-tokens-val');
    if (chartTokensVal) {
      chartTokensVal.textContent = `${options.numberLabel(tokenTotal)} tokens total`;
    }
    const chartCostVal = document.getElementById('zavorth-chart-cost-val');
    if (chartCostVal) {
      chartCostVal.textContent = `${options.formattedMoney(costTotal)} total`;
    }

    // Scale SVG path based on token total
    const neonPath = document.querySelector('.zavorth-neon-path');
    if (neonPath) {
      const scale = tokenTotal > 0 ? tokenTotal : 2500;
      const points = [
        { x: 0, y: 120 },
        { x: 50, y: 120 - Math.min(100, scale * 0.005 + 10) },
        { x: 100, y: 120 - Math.min(100, scale * 0.003 + 15) },
        { x: 150, y: 120 - Math.min(100, scale * 0.008 + 12) },
        { x: 200, y: 120 - Math.min(100, scale * 0.012 + 20) },
        { x: 250, y: 120 - Math.min(100, scale * 0.015 + 25) },
        { x: 300, y: 120 - Math.min(100, scale * 0.022 + 40) },
        { x: 350, y: 120 - Math.min(100, scale * 0.018 + 45) },
        { x: 400, y: 120 - Math.min(100, scale * 0.035 + 60) },
        { x: 450, y: 120 - Math.min(100, scale * 0.045 + 70) },
        { x: 500, y: 120 - Math.min(100, scale * 0.055 + 85) },
      ];

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      neonPath.setAttribute('d', pathD);

      // Update glow area too!
      const neonArea = document.querySelector('path[fill="url(#token-glow)"]');
      if (neonArea) {
        neonArea.setAttribute('d', `${pathD} L 500 120 L 0 120 Z`);
      }

      // Update dots positions
      const dots = document.querySelectorAll('.zavorth-neon-dot');
      dots.forEach((dot, index) => {
        const p = points[index + 1];
        if (p && dot) {
          dot.setAttribute('cx', String(p.x));
          dot.setAttribute('cy', String(p.y));
        }
      });
    }

    // Scale SVG bar heights based on cost total
    const rects = document.querySelectorAll('.zavorth-neon-rect');
    if (rects.length > 0) {
      const scale = costTotal > 0 ? costTotal : 1.25;
      rects.forEach((rect, index) => {
        const factor = (index + 1) / rects.length;
        const height = Math.min(110, scale * 30 * factor + 8);
        rect.setAttribute('height', String(height));
        rect.setAttribute('y', String(120 - height));
      });
    }

    options.updateSummaryCard(
      'Runs',
      options.numberLabel(runs.length),
      runs.length ? 'live executions registered' : 'no execution registered',
    );
    options.updateSummaryCard('Current Model', options.getCurrentModelLabel(), options.getCurrentProviderLabel());
    options.updateSummaryCard(
      'Artifacts',
      options.numberLabel(options.totalArtifactCount()),
      options.totalArtifactCount() ? 'generated by runtime' : 'no file generated in this session',
    );
    options.updateSummaryCard(
      'Approvals',
      options.numberLabel(options.pendingApprovalCount()),
      options.pendingApprovalCount() ? 'waiting for decision' : 'no pending approvals',
    );

    options.setTableHeaders('sector-usage', ['Model', 'Runs', 'Events', 'Artifacts', 'Status']);
    if (models.length === 0) {
      options.setTableBody(
        'sector-usage',
        `
        <tr>
          <td class="mono">${options.escapeHtml(options.getCurrentModelLabel())}</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>${options.statusBadge(options.state.zavorthControl?.authRequired ? 'auth' : 'ready', options.state.zavorthControl?.authRequired ? 'Protected' : 'Waiting run')}</td>
        </tr>
      `,
      );
      return;
    }

    options.setTableBody(
      'sector-usage',
      models
        .map(
          (entry) => `
      <tr>
        <td class="mono">${options.escapeHtml(entry.model)}</td>
        <td>${options.numberLabel(entry.runs)}</td>
        <td>${options.numberLabel(entry.events)}</td>
        <td>${options.numberLabel(entry.artifacts)}</td>
        <td>${options.statusBadge(entry.status, options.text(entry.status, 'Ready'))}</td>
      </tr>
    `,
        )
        .join(''),
    );
  }

  function updateCron() {
    const jobs = options.getWorkflowJobs();
    options.setTableHeaders('sector-cron', ['Job', 'Type', 'Attempts', 'Next', 'Updated', 'Status']);
    if (jobs.length === 0) {
      options.setTableBody(
        'sector-cron',
        `
        <tr>
          <td class="mono">workflow queue</td>
          <td>local durable</td>
          <td>0</td>
          <td>---</td>
          <td>${options.formatDate(options.state.updatedAt)}</td>
          <td>${options.statusBadge(options.state.zavorthControl?.authRequired ? 'auth' : 'ready', options.state.zavorthControl?.authRequired ? 'Protected' : 'No live jobs')}</td>
        </tr>
      `,
      );
      return;
    }

    options.setTableBody(
      'sector-cron',
      jobs
        .slice(0, 8)
        .map(
          (job) => `
      <tr>
        <td class="mono">${options.escapeHtml(options.text(job.id || job.jobId || job.runId, 'job'))}</td>
        <td>${options.escapeHtml(options.text(job.type || job.kind, 'workflow'))}</td>
        <td>${options.numberLabel(job.attempts || job.attempt || 0)}</td>
        <td>${job.nextRunAt ? options.formatDate(job.nextRunAt) : '---'}</td>
        <td>${options.formatDate(job.updatedAt || job.createdAt)}</td>
        <td>${options.statusBadge(job.status, options.text(job.status, 'Ready'))}</td>
      </tr>
    `,
        )
        .join(''),
    );
  }

  function extractCompanions() {
    const candidates = [
      options.state.companions?.snapshot?.companions,
      options.state.companions?.companions,
      options.state.gatewayRuntime?.snapshot?.companions,
      options.state.gatewayRuntime?.companions,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function trustedWorkspaceRows(): string {
    const rows = Array.from(document.querySelectorAll('.trusted-workspace-card')).map((card) => {
      const label = card.querySelector('strong')?.textContent?.trim() || 'Trusted workspace';
      const workspacePath = card.querySelector('span')?.textContent?.trim() || 'path unavailable';
      return `<div class="workspace-item"><strong>${options.escapeHtml(label)}</strong><span>${options.escapeHtml(workspacePath)}</span></div>`;
    });
    return rows.join('') || '<p class="no-facts-left">No trusted workspace registered yet.</p>';
  }

  function companionRows(companions: any[]): string {
    return (
      companions
        .slice(0, 8)
        .map((node) => {
          const label = options.text(node?.label || node?.id, 'Companion');
          const summary = options.text(node?.summary || node?.details || node?.status, 'No live summary published');
          return `<div class="workspace-item"><strong>${options.escapeHtml(label)}</strong><span>${options.escapeHtml(summary)}</span></div>`;
        })
        .join('') || '<p class="no-facts-left">No consented companion is connected.</p>'
    );
  }

  function memoryFactRows(): string {
    const isBadFactValue = (value: unknown) => {
      const normalized = String(value ?? '').trim();
      return !normalized || /^(nan|null|undefined)$/i.test(normalized);
    };
    const bridgeFacts = Array.isArray((window as any).ZavorthRuntimeBridge?.state?.memoryFacts?.facts)
      ? (window as any).ZavorthRuntimeBridge.state.memoryFacts.facts
      : [];
    const stateFacts = Array.isArray((options.state as any).memoryFacts?.facts)
      ? (options.state as any).memoryFacts.facts
      : [];
    const persistedFacts = [...stateFacts, ...bridgeFacts].filter((fact: any) => {
      const key = fact?.id || fact?.key;
      const content = fact?.content || fact?.summary || fact?.key;
      return !isBadFactValue(key) || !isBadFactValue(content);
    });
    if (persistedFacts.length) {
      return persistedFacts
        .slice(0, 12)
        .map((fact: any) => {
          const rawKey = fact?.id || fact?.key || fact?.content || fact?.summary;
          const key = isBadFactValue(rawKey) ? 'memory-fact' : String(rawKey).trim();
          const content = isBadFactValue(fact?.content || fact?.summary || fact?.key)
            ? 'Persisted memory fact'
            : options.text(fact?.content || fact?.summary || fact?.key, 'Persisted memory fact');
          const type = isBadFactValue(fact?.type) ? 'memory' : options.text(fact?.type, 'memory');
          const metadata = fact?.metadata && typeof fact.metadata === 'object' ? fact.metadata : {};
          const trust = metadata.trust && typeof metadata.trust === 'object' ? metadata.trust : {};
          const source = metadata.source && typeof metadata.source === 'object' ? metadata.source : {};
          const trustLevel = isBadFactValue(trust.level || metadata.provenance || fact?.trustLevel)
            ? 'raw'
            : options.text(trust.level || metadata.provenance || fact?.trustLevel, 'raw');
          const sourceLabel = isBadFactValue(source.surface || metadata.origin || fact?.source)
            ? 'runtime'
            : options.text(source.surface || metadata.origin || fact?.source, 'runtime');
          const confidence = Number(metadata.confidence || fact?.confidence || 0);
          const confidenceLabel =
            Number.isFinite(confidence) && confidence > 0 ? `${Math.round(confidence * 100)}%` : trustLevel;
          return `
          <div class="fact-item" id="memory-fact-${options.escapeHtml(key)}">
            <span>${options.escapeHtml(content)} <small class="fact-item__meta">${options.escapeHtml(type)} - ${options.escapeHtml(sourceLabel)} - ${options.escapeHtml(confidenceLabel)}</small></span>
            <span class="memory-fact-actions">
              <button type="button" class="fact-action-btn" data-memory-action="promote" data-memory-key="${options.escapeHtml(key)}">Promote</button>
              <button type="button" class="fact-action-btn" data-memory-action="correct" data-memory-key="${options.escapeHtml(key)}" data-memory-content="${options.escapeHtml(content)}">Correct</button>
              <button type="button" class="fact-action-btn fact-forget-btn" data-memory-action="forget" data-memory-key="${options.escapeHtml(key)}">Forget</button>
            </span>
          </div>
        `;
        })
        .join('');
    }
    const candidates = [
      options.state.layeredMemory?.summary,
      options.state.layeredMemory?.narrative?.operatorSummary,
      options.state.memoryRecall?.summary,
      options.state.zavorthControl?.snapshot?.memory?.summary,
      options.state.zavorthControl?.snapshot?.memorySummary,
      options.state.zavorthControl?.snapshot?.workspaceMemory?.summary,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const unique = Array.from(new Set(candidates)).slice(0, 8);
    if (!unique.length) {
      return '<p class="no-facts-left">No persisted memory facts are published in this dashboard snapshot.</p>';
    }
    return unique
      .map((fact, index) => {
        const key = `dashboard-fact-${index + 1}`;
        return `
        <div class="fact-item" id="${key}">
          <span>${options.escapeHtml(fact)}</span>
          <button type="button" class="fact-forget-btn" data-memory-key="${options.escapeHtml(key)}">Forget</button>
        </div>
      `;
      })
      .join('');
  }

  function executionEnvironmentRows(backendCount: number): string {
    const rows = [
      `<div class="inspection-fact-row"><span>Approval gate</span><strong>${backendCount ? `${backendCount} backend signal(s)` : 'required'}</strong></div>`,
      `<div class="inspection-fact-row"><span>Runtime mode</span><strong>${options.escapeHtml(options.text(options.state.zavorthControl?.runtimeMode || options.state.zavorthControl?.snapshot?.runtimeMode, 'local guarded'))}</strong></div>`,
      `<div class="inspection-fact-row"><span>Auth</span><strong>${options.state.zavorthControl?.authRequired ? 'protected' : 'unlocked/local'}</strong></div>`,
    ];
    return rows.join('');
  }

  function bindForgetButtons(root: ParentNode) {
    root.querySelectorAll('.fact-action-btn, .fact-forget-btn').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const button = btn as HTMLElement;
        const key = String(button.getAttribute('data-memory-key') || '').trim();
        const action = String(button.getAttribute('data-memory-action') || 'forget').trim();
        const factItem = button.closest('.fact-item') as HTMLElement | null;
        const content =
          action === 'correct'
            ? window.prompt?.(
                'Correct this memory fact:',
                button.getAttribute('data-memory-content') ||
                  factItem?.querySelector('span')?.textContent?.trim() ||
                  '',
              )
            : '';
        if (action === 'correct' && !String(content || '').trim()) return;
        button.setAttribute('disabled', 'true');
        try {
          if (key && (window as any).ZavorthRuntimeBridge?.memoryFactAction) {
            await (window as any).ZavorthRuntimeBridge.memoryFactAction({ action, id: key, content });
          } else if (key && action === 'forget' && (window as any).ZavorthRuntimeBridge?.forgetMemoryFact) {
            await (window as any).ZavorthRuntimeBridge.forgetMemoryFact({ id: key });
          } else if (key && (window as any).ZavorthRuntimeBridge?.sendChat) {
            await (window as any).ZavorthRuntimeBridge.sendChat(`/memory ${action} ${key}`);
            window.emitSignal?.('success', 'Memory action requested', `Sent governed ${action} request for ${key}.`);
          } else {
            window.emitSignal?.(
              'info',
              'Memory action unavailable',
              'No runtime memory bridge is available in this dashboard session.',
            );
          }
          if (action === 'forget') {
            factItem?.classList.add('forgetting');
            setTimeout(() => factItem?.remove(), 500);
          } else {
            button.removeAttribute('disabled');
          }
        } catch (error: unknown) {
          button.removeAttribute('disabled');
          window.emitSignal?.('info', 'Memory action failed', String(error?.message || error || 'Request failed.'));
        }
      });
    });
  }

  function bindMnemosRecall(root: ParentNode) {
    const form = root.querySelector<HTMLFormElement>('[data-mnemos-recall-form]');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>('[name="query"]');
      const result = root.querySelector<HTMLElement>('[data-mnemos-recall-results]');
      const query = String(input?.value || '').trim();
      if (!query || !result) return;
      result.innerHTML = '<div class="mnemos-recall-empty">Searching Knowledge (wiki)…</div>';
      try {
        // Prefer product Knowledge API; fall back to runtime bridge / web mnemos route.
        let hits: any[] = [];
        let ftsNote = '';
        try {
          const res = await fetch(`/api/knowledge/facts?query=${encodeURIComponent(query)}&topK=6`);
          if (res.ok) {
            const payload = await res.json();
            const recall = payload?.recall || payload;
            hits = Array.isArray(recall?.hits) ? recall.hits : Array.isArray(payload?.hits) ? payload.hits : [];
            ftsNote = recall?.summary?.sqliteFtsAvailable === false ? ' · FTS offline (keyword/tag/graph)' : '';
          }
        } catch {
          // fall through
        }
        if (!hits.length) {
          const payload = await (window as any).ZavorthRuntimeBridge?.recallMnemos?.({ query, topK: 6 });
          const recall = payload?.recall || payload;
          hits = Array.isArray(recall?.hits) ? recall.hits : [];
        }
        if (!hits.length) {
          result.innerHTML =
            '<div class="mnemos-recall-empty">No Knowledge hits for this query. Try zavorth knowledge facts "&lt;q&gt;" or ingest wiki pages.</div>';
          return;
        }
        result.innerHTML = `
          <p class="mnemos-recall-empty" style="margin-bottom:8px">Knowledge pillar · read-only · no silent promote${options.escapeHtml(ftsNote)}</p>
          ${hits
            .map(
              (hit: any) => `
          <article class="mnemos-recall-hit">
            <div>
              <strong>${options.escapeHtml(hit.title || hit.pageId || 'Knowledge hit')}</strong>
              <span>${options.escapeHtml(hit.excerpt || '')}</span>
            </div>
            <small>${options.escapeHtml((hit.rankSources || []).join(', ') || 'ranked')} - ${options.escapeHtml(String(hit.score || ''))}</small>
          </article>
        `,
            )
            .join('')}`;
      } catch (error: unknown) {
        const err = error as { message?: string };
        result.innerHTML = `<div class="mnemos-recall-empty">Recall failed: ${options.escapeHtml(err?.message || String(error) || 'request failed')}</div>`;
      }
    });

    const consolidateBtn = root.querySelector<HTMLButtonElement>('[data-knowledge-consolidate]');
    if (consolidateBtn && !consolidateBtn.dataset.bound) {
      consolidateBtn.dataset.bound = '1';
      consolidateBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        const result = root.querySelector<HTMLElement>('[data-mnemos-recall-results]');
        if (!result) return;
        result.innerHTML = '<div class="mnemos-recall-empty">Building consolidate preview…</div>';
        try {
          const res = await fetch('/api/knowledge/consolidate');
          const payload = await res.json();
          if (!res.ok || !payload?.ok) {
            result.innerHTML = `<div class="mnemos-recall-empty">Consolidate preview failed: ${options.escapeHtml(payload?.error || res.statusText)}</div>`;
            return;
          }
          const blockers = Array.isArray(payload.promotionGate?.blockers)
            ? payload.promotionGate.blockers.join(', ')
            : 'preview-only';
          const steps = Array.isArray(payload.nextSteps) ? payload.nextSteps : [];
          result.innerHTML = `
            <article class="mnemos-recall-hit">
              <div>
                <strong>Consolidate preview only</strong>
                <span>${options.escapeHtml(payload.dream?.summary || 'Dream preview')}</span>
              </div>
              <small>candidates=${options.escapeHtml(String(payload.dream?.candidateCount ?? 0))} · quarantine=${options.escapeHtml(String(payload.dream?.quarantineCount ?? 0))} · canApply=false</small>
              <p><small>Blockers: ${options.escapeHtml(blockers)}</small></p>
              <p><small>${options.escapeHtml(payload.promotionGate?.note || 'Never silent-promotes.')}</small></p>
              <ul>${steps.map((s: string) => `<li><small>${options.escapeHtml(s)}</small></li>`).join('')}</ul>
            </article>
          `;
        } catch (error: unknown) {
          const err = error as { message?: string };
          result.innerHTML = `<div class="mnemos-recall-empty">Consolidate failed: ${options.escapeHtml(err?.message || String(error) || 'request failed')}</div>`;
        }
      });
    }
  }

  function updateNodes() {
    const companions = extractCompanions();
    const tools = options.collectToolExposures();
    const haystack = [
      ...tools.map((tool) => `${tool.id} ${tool.title} ${tool.summary}`),
      ...companions.map(
        (node) =>
          `${node?.id || ''} ${node?.label || ''} ${node?.type || ''} ${node?.kind || ''} ${node?.summary || ''}`,
      ),
    ]
      .join(' ')
      .toLowerCase();
    const hasMnemos = /mnemos|memory|vault/.test(haystack);
    const hasSwarm = /swarm|worker|subagent/.test(haystack) || Boolean(options.state.zavorthControl?.snapshot?.swarmV2);
    const hasAcp =
      /\bacp\b|agent communication protocol/.test(haystack) || Boolean(options.state.zavorthControl?.snapshot?.acp);
    const backendCount = companions.length;

    // Feature 8: Interactive Memory Scope Tree
    const treeContainer = document.getElementById('zavorth-memory-tree');
    if (treeContainer && !treeContainer.dataset.treeBound) {
      treeContainer.setAttribute('data-tree-bound', '1');

      treeContainer.innerHTML = `
        <svg viewBox="0 0 500 220" class="zavorth-memory-svg">
          <!-- Wires -->
          <line x1="250" y1="110" x2="130" y2="50" class="zavorth-mem-wire" />
          <line x1="250" y1="110" x2="130" y2="170" class="zavorth-mem-wire" />
          <line x1="250" y1="110" x2="370" y2="50" class="zavorth-mem-wire" />
          <line x1="250" y1="110" x2="370" y2="170" class="zavorth-mem-wire" />
          
          <!-- Center Mind -->
          <g class="zavorth-mem-node is-mind" id="mem-node-mind" transform="translate(250, 110)">
            <circle r="20" />
            <text y="5" class="node-icon">🧠</text>
            <text y="34" class="node-label">Zavorth Core</text>
          </g>
          
          <!-- Workspaces -->
          <g class="zavorth-mem-node is-active" id="mem-node-workspaces" transform="translate(130, 50)">
            <circle r="15" />
            <text y="4" class="node-icon">📁</text>
            <text y="28" class="node-label">Workspaces</text>
          </g>
          
          <!-- Fact Vault -->
          <g class="zavorth-mem-node is-active" id="mem-node-vault" transform="translate(130, 170)">
            <circle r="15" />
            <text y="4" class="node-icon">🛡️</text>
            <text y="28" class="node-label">Fact Vault</text>
          </g>
          
          <!-- Linked Agents -->
          <g class="zavorth-mem-node is-active" id="mem-node-agents" transform="translate(370, 50)">
            <circle r="15" />
            <text y="4" class="node-icon">🤖</text>
            <text y="28" class="node-label">Linked Agents</text>
          </g>
          
          <!-- Safe Environments -->
          <g class="zavorth-mem-node is-active" id="mem-node-environments" transform="translate(370, 170)">
            <circle r="15" />
            <text y="4" class="node-icon">🔒</text>
            <text y="28" class="node-label">Environments</text>
          </g>
        </svg>
      `;

      treeContainer.innerHTML = `
        <div class="zavorth-memory-scope-list" role="list" aria-label="Memory scopes">
          <button class="zavorth-mem-node is-inspected" id="mem-node-vault" type="button"><strong>Fact vault</strong><span>persisted facts, provenance, trust</span></button>
          <button class="zavorth-mem-node" id="mem-node-recall" type="button"><strong>Knowledge</strong><span>Wiki facts · FTS5 · no silent promote</span></button>
          <button class="zavorth-mem-node" id="mem-node-about" type="button"><strong>About you</strong><span>Profile facts · draft → approve</span></button>
          <button class="zavorth-mem-node" id="mem-node-workspaces" type="button"><strong>Workspaces</strong><span>trusted folders and scope</span></button>
          <button class="zavorth-mem-node" id="mem-node-agents" type="button"><strong>Agents</strong><span>consented companions</span></button>
          <button class="zavorth-mem-node" id="mem-node-environments" type="button"><strong>Execution</strong><span>runtime safety boundary</span></button>
        </div>
      `;

      const inspectionBody = document.getElementById('zavorth-memory-inspection-body');

      const nodeDetails: Record<string, string> = {
        'mem-node-mind': `
          <div class="zavorth-inspection-card">
            <h3>Zavorth Core Mind</h3>
            <p>Governed memory coordinator from the current dashboard snapshot.</p>
            <div class="inspection-fact-row"><span>Live</span><strong>${options.state.zavorthControl?.live ? 'yes' : 'local projection'}</strong></div>
            <div class="inspection-fact-row"><span>Updated</span><strong>${options.escapeHtml(options.formatDate(options.state.updatedAt))}</strong></div>
          </div>
        `,
        'mem-node-workspaces': `
          <div class="zavorth-inspection-card">
            <h3>Active Workspaces</h3>
            <p>Trusted folders currently published by the runtime settings API.</p>
            <div class="inspection-workspace-list">
              ${trustedWorkspaceRows()}
            </div>
          </div>
        `,
        'mem-node-vault': `
          <div class="zavorth-inspection-card">
            <h3>Durable Fact Vault</h3>
            <p>Memory facts published by the current runtime snapshot. Actions use the native governed memory contract.</p>
            <div class="inspection-fact-vault" id="fact-vault-list">
              ${memoryFactRows()}
            </div>
          </div>
        `,
        'mem-node-recall': `
          <div class="zavorth-inspection-card">
            <h3>Knowledge (project facts)</h3>
            <p>Local Mnemos wiki recall (FTS + keyword + tag + graph). Read-only — lifecycle never silent-promotes.</p>
            <form class="mnemos-recall-form" data-mnemos-recall-form>
              <input name="query" type="search" placeholder="Search project knowledge…" autocomplete="off">
              <button type="submit">Search</button>
            </form>
            <p style="margin-top:8px">
              <button type="button" class="fact-action-btn" data-knowledge-consolidate>Consolidate preview</button>
            </p>
            <div class="mnemos-recall-results" data-mnemos-recall-results>
              <div class="mnemos-recall-empty">Type a query, or open Consolidate preview (no durable write).</div>
            </div>
            <p class="mnemos-recall-empty" style="margin-top:8px">CLI: zavorth knowledge facts · tool knowledge_recall</p>
          </div>
        `,
        'mem-node-about': `
          <div class="zavorth-inspection-card">
            <h3>About you</h3>
            <p>Operator profile from USER.md, dialectic answers, learning stats, and approved facts. Writes are draft → approve only.</p>
            <div data-about-you-panel>
              <div class="mnemos-recall-empty">Loading profile…</div>
            </div>
            <p style="margin-top:8px">
              <button type="button" class="fact-action-btn" data-about-refresh>Refresh</button>
              <button type="button" class="fact-action-btn" data-about-propose-learning>Propose from workflows</button>
              <button type="button" class="fact-action-btn" data-about-export>Export</button>
            </p>
            <p class="mnemos-recall-empty" style="margin-top:8px">CLI: zavorth knowledge about · inject via ZAVORTH_USER_MODEL=1</p>
          </div>
        `,
        'mem-node-agents': `
          <div class="zavorth-inspection-card">
            <h3>Consented Companions</h3>
            <p>Companion/node profiles from the live gateway snapshot.</p>
            ${companionRows(companions)}
          </div>
        `,
        'mem-node-environments': `
          <div class="zavorth-inspection-card">
            <h3>Safe Environments</h3>
            <p>Execution scope and backend signals from the current runtime snapshot.</p>
            ${executionEnvironmentRows(backendCount)}
          </div>
        `,
      };

      treeContainer.querySelectorAll('.zavorth-mem-node').forEach((node) => {
        node.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          treeContainer.querySelectorAll('.zavorth-mem-node').forEach((n) => n.classList.remove('is-inspected'));
          node.classList.add('is-inspected');

          const id = node.id;
          if (inspectionBody && nodeDetails[id]) {
            inspectionBody.innerHTML = nodeDetails[id];
            if (id === 'mem-node-vault') bindForgetButtons(inspectionBody);
            if (id === 'mem-node-recall') bindMnemosRecall(inspectionBody);
            if (id === 'mem-node-about') bindAboutYouPanel(inspectionBody);
          }
        });
      });
      if (inspectionBody) {
        inspectionBody.innerHTML = nodeDetails['mem-node-vault'];
        bindForgetButtons(inspectionBody);
      }
    }

    function bindAboutYouPanel(root: ParentNode) {
      const panel = root.querySelector<HTMLElement>('[data-about-you-panel]');
      if (!panel) return;

      const load = async () => {
        panel.innerHTML = '<div class="mnemos-recall-empty">Loading profile…</div>';
        try {
          const res = await fetch('/api/knowledge/about?userId=control');
          const data = await res.json();
          if (!res.ok || !data?.ok) {
            panel.innerHTML = `<div class="mnemos-recall-empty">Failed: ${options.escapeHtml(data?.error || res.statusText)}</div>`;
            return;
          }
          const facts = Array.isArray(data.facts) ? data.facts : [];
          const drafts = Array.isArray(data.drafts) ? data.drafts : [];
          panel.innerHTML = `
          <p><strong>${options.escapeHtml(data.displayName || 'Operator')}</strong>
            · inject ${data.injectEnabled ? 'on' : 'off'}
            · facts ${facts.length} · drafts ${drafts.length}</p>
          <p class="mnemos-recall-empty">${options.escapeHtml(data.summary || '')}</p>
          <div class="inspection-fact-vault">
            ${
              facts
                .slice(0, 12)
                .map(
                  (f: any) => `
              <div class="fact-item">
                <div><strong>${options.escapeHtml(f.key)}</strong>: ${options.escapeHtml(f.value)}</div>
                <small>${options.escapeHtml(f.source)} · conf=${options.escapeHtml(String(f.confidence))}</small>
                <button type="button" class="fact-action-btn" data-about-forget data-id="${options.escapeHtml(f.id)}">Forget</button>
              </div>
            `,
                )
                .join('') || '<p class="no-facts-left">No active facts yet.</p>'
            }
          </div>
          ${
            drafts.length
              ? `<h4>Drafts</h4>
            ${drafts
              .map(
                (d: any) => `
              <div class="fact-item">
                <div><strong>${options.escapeHtml(d.key)}</strong>: ${options.escapeHtml(d.value)}</div>
                <button type="button" class="fact-action-btn" data-about-approve data-id="${options.escapeHtml(d.id)}">Approve</button>
                <button type="button" class="fact-action-btn" data-about-reject data-id="${options.escapeHtml(d.id)}">Reject</button>
              </div>
            `,
              )
              .join('')}`
              : ''
          }
        `;
          panel.querySelectorAll('[data-about-forget]').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const id = (btn as HTMLElement).getAttribute('data-id') || '';
              await fetch(`/api/knowledge/about?userId=control&action=forget&id=${encodeURIComponent(id)}`, {
                method: 'POST',
              });
              await load();
            });
          });
          panel.querySelectorAll('[data-about-approve]').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const id = (btn as HTMLElement).getAttribute('data-id') || '';
              await fetch(`/api/knowledge/about?userId=control&action=approve&id=${encodeURIComponent(id)}`, {
                method: 'POST',
              });
              await load();
            });
          });
          panel.querySelectorAll('[data-about-reject]').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const id = (btn as HTMLElement).getAttribute('data-id') || '';
              await fetch(`/api/knowledge/about?userId=control&action=reject&id=${encodeURIComponent(id)}`, {
                method: 'POST',
              });
              await load();
            });
          });
        } catch (error: unknown) {
          const err = error as { message?: string };
          panel.innerHTML = `<div class="mnemos-recall-empty">Failed: ${options.escapeHtml(err?.message || String(error))}</div>`;
        }
      };

      root.querySelector('[data-about-refresh]')?.addEventListener('click', (e) => {
        e.preventDefault();
        void load();
      });
      root.querySelector('[data-about-propose-learning]')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/knowledge/about?userId=control&action=propose-learning', { method: 'POST' });
        await load();
      });
      root.querySelector('[data-about-export]')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const res = await fetch('/api/knowledge/about?userId=control&action=export', { method: 'POST' });
        const data = await res.json();
        window.emitSignal?.('success', 'About you export', String(data?.text || data?.path || 'exported'));
      });
      void load();
    }

    options.setLiveStripValue(
      '[data-memory-live-files]',
      hasMnemos ? 'ready' : options.state.zavorthControl?.authRequired ? 'protected' : 'configurable',
    );
    options.setLiveStripValue('[data-memory-live-agents]', companions.length || (hasAcp ? 1 : 0));
    options.setLiveStripValue('[data-memory-live-env]', backendCount ? `${backendCount} visible` : 'approval gated');

    options.updatePremiumStatus('File memory', hasMnemos ? 'ready' : 'configurable', hasMnemos ? 'ok' : 'info');
    options.updatePremiumStatus('Parallel work', hasSwarm ? 'ready' : 'ready', 'ok');
    options.updatePremiumStatus(
      'External links',
      companions.length || hasAcp ? `${companions.length || 1} profile` : 'consent required',
      companions.length || hasAcp ? 'ok' : 'info',
    );
    options.updatePremiumStatus(
      'Safe execution',
      backendCount ? `${backendCount} visible` : 'approval gated',
      backendCount ? 'ok' : 'warn',
    );
    options.updatePlatformAction(
      'sector-nodes',
      'File memory',
      hasMnemos ? 'Memory tools are visible in the runtime.' : 'Memory scope is configurable.',
    );
    options.updatePlatformAction(
      'sector-nodes',
      'Parallel work',
      hasSwarm ? 'Ready with cost limits and receipts.' : 'Active when a task asks for parallel work.',
    );
    options.updatePlatformAction(
      'sector-nodes',
      'Connect adapter',
      companions.length ? `${companions.length} consented profile(s).` : 'Only from a path you provide.',
    );
    options.updatePlatformAction(
      'sector-nodes',
      'Execution environments',
      backendCount ? `${backendCount} visible backend signal(s).` : 'Shell, files, and remote actions require scope.',
    );

    options.setTableHeaders('sector-nodes', ['Node', 'Type', 'Processes', 'Memory', 'Summary', 'Actions', 'Status']);
    if (companions.length === 0) {
      options.setTableBody(
        'sector-nodes',
        `
        <tr>
          <td class="mono">companions</td>
          <td>Runtime</td>
          <td>0</td>
          <td>---</td>
          <td>${options.state.zavorthControl?.authRequired ? 'Unlock to read live nodes' : 'No live companion/node connected'}</td>
          <td>---</td>
          <td>${options.statusBadge(options.state.zavorthControl?.authRequired ? 'auth' : 'ready', options.state.zavorthControl?.authRequired ? 'Protected' : 'Waiting')}</td>
        </tr>
      `,
      );
      return;
    }

    options.setTableBody(
      'sector-nodes',
      companions
        .slice(0, 8)
        .map((node) => {
          const actions = Array.isArray(node?.actions) ? node.actions.length : 0;
          return `
        <tr>
          <td class="mono">${options.escapeHtml(options.text(node.id, node.label))}</td>
          <td>${options.escapeHtml(options.text(node.type || node.kind || node.label, 'Companion'))}</td>
          <td>${options.numberLabel(node.processCount || node.processes || 0)}</td>
          <td>${node.workingSetMb ? `${options.numberLabel(node.workingSetMb)} MB` : '---'}</td>
          <td>${options.escapeHtml(options.text(node.summary || node.details, 'No summary published'))}</td>
          <td>${options.numberLabel(actions)}</td>
          <td>${options.statusBadge(node.status, options.text(node.status, 'Ready'))}</td>
        </tr>
      `;
        })
        .join(''),
    );
  }

  return {
    updateCron,
    updateNodes,
    updateUsage,
  };
}
